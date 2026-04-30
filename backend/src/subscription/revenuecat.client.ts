/**
 * V199 (Invariant 50): RC REST API client for synchronous entitlement verification.
 *
 * Motivation: webhook events are async and can be delayed, lost, or
 * deduplicated by the idempotency table. preflight must verify entitlements
 * from RC backend directly — not solely from our own DB — so that
 * "DB free + RC active" races (Bug 1, V198) are caught at purchase time.
 *
 * Endpoint used: GET /v1/subscribers/{app_user_id}
 *   Returns the full subscriber object including `subscriber.entitlements`.
 *   Active entitlements have `expires_date > now` (or null for lifetime).
 *
 * Failure policy: fail-close (Invariant 54). Any RC API error causes
 * preflight to block the purchase — false-positive (blocking a real user)
 * is recoverable; false-negative (double billing) is not.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface RcActiveEntitlement {
  productIdentifier: string;
  expiresDate: Date | null;
  isSandbox: boolean;
}

@Injectable()
export class RevenueCatClient {
  private readonly logger = new Logger(RevenueCatClient.name);
  private readonly http: AxiosInstance | null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('REVENUECAT_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'REVENUECAT_API_KEY not set — RC entitlement verification disabled. ' +
          'preflight will rely on DB tier only (degraded mode).',
      );
      this.http = null;
      this.enabled = false;
      return;
    }

    // RC REST API /v1/subscribers endpoint uses Secret Key authentication.
    // X-Platform header must NOT be sent — it triggers 403 because the server
    // interprets it as a platform SDK key request (different auth scheme).
    this.http = axios.create({
      baseURL: 'https://api.revenuecat.com/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 3000,
    });
    this.enabled = true;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Fetches active entitlements for the given RC app user ID.
   *
   * Returns an empty array when:
   *  - RC API key not configured (degraded mode)
   *  - RC API returns 404 (user not found in RC — no entitlements)
   *  - RC API times out or returns 5xx (fail-close: caller must treat as "active")
   *
   * Throws RcApiUnavailableError on network/server errors so caller can
   * implement fail-close.
   */
  async getActiveEntitlements(
    rcAppUserId: string,
  ): Promise<RcActiveEntitlement[]> {
    if (!this.http || !this.enabled) {
      return [];
    }

    let response: any;
    try {
      response = await this.http.get(
        `/subscribers/${encodeURIComponent(rcAppUserId)}`,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        // User not found in RC — no subscription history. Treat as clean.
        return [];
      }
      // 429, 500, timeout, network — escalate as unavailable so caller fails closed
      throw new RcApiUnavailableError(
        `RC API unavailable (status=${status ?? 'network'})`,
        err,
      );
    }

    const entitlements: Record<string, any> =
      response.data?.subscriber?.entitlements ?? {};
    const now = new Date();
    const active: RcActiveEntitlement[] = [];

    for (const [, ent] of Object.entries(entitlements)) {
      const expiresDate = ent.expires_date ? new Date(ent.expires_date) : null;
      // Active if no expiry (lifetime) or expiry is in the future
      if (expiresDate === null || expiresDate > now) {
        active.push({
          productIdentifier: ent.product_identifier ?? '',
          expiresDate,
          isSandbox: !!ent.is_sandbox,
        });
      }
    }

    return active;
  }
}

export class RcApiUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RcApiUnavailableError';
  }
}
