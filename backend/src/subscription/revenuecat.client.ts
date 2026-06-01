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

export interface RcSubscriberInfo {
  activeEntitlements: RcActiveEntitlement[];
  /** ISO-8601 string set by us at withdrawal time, null if never set */
  deletedAt: string | null;
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
  /**
   * V210 (P0-2): Deletes the RC subscriber record so the alias chain is
   * severed on account withdrawal. Fail-close: caller must NOT block DB
   * deletion on RC failure — call after the DB transaction commits.
   *
   * RC REST API: DELETE /v1/subscribers/{app_user_id}
   * Returns true on success, false on 404 (already gone), throws on 5xx/network.
   */
  async deleteSubscriber(rcAppUserId: string): Promise<boolean> {
    if (!this.http || !this.enabled) {
      return false;
    }

    try {
      await this.http.delete(`/subscribers/${encodeURIComponent(rcAppUserId)}`);
      this.logger.log(`[RC] Subscriber deleted: rcAppUserId=${rcAppUserId}`);
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        // Already gone — idempotent success
        return true;
      }
      this.logger.error(
        `[RC] deleteSubscriber failed (status=${status ?? 'network'}): rcAppUserId=${rcAppUserId}`,
        err?.message,
      );
      throw new RcApiUnavailableError(
        `RC deleteSubscriber unavailable (status=${status ?? 'network'})`,
        err,
      );
    }
  }

  /**
   * V213 (P0-2): Sets a custom attribute on the RC subscriber.
   * Used to mark `$deleted_at` at withdrawal time so preflightPurchase
   * can detect phantom entitlements after account re-creation.
   */
  async setSubscriberAttribute(
    rcAppUserId: string,
    key: string,
    value: string,
  ): Promise<void> {
    if (!this.http || !this.enabled) {
      return;
    }

    try {
      await this.http.post(
        `/subscribers/${encodeURIComponent(rcAppUserId)}/attributes`,
        { attributes: { [key]: { value } } },
      );
    } catch (err: any) {
      const status = err?.response?.status;
      // Non-critical — log but do not throw. Deletion still proceeds.
      this.logger.warn(
        `[RC] setSubscriberAttribute failed (status=${status ?? 'network'}): ` +
          `rcAppUserId=${rcAppUserId} key=${key}`,
        err?.message,
      );
    }
  }

  /**
   * Fetches active entitlements AND the `$deleted_at` attribute for
   * phantom detection. Returns combined RcSubscriberInfo.
   */
  async getSubscriberInfo(rcAppUserId: string): Promise<RcSubscriberInfo> {
    if (!this.http || !this.enabled) {
      return { activeEntitlements: [], deletedAt: null };
    }

    let response: any;
    try {
      response = await this.http.get(
        `/subscribers/${encodeURIComponent(rcAppUserId)}`,
      );
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        return { activeEntitlements: [], deletedAt: null };
      }
      throw new RcApiUnavailableError(
        `RC API unavailable (status=${status ?? 'network'})`,
        err,
      );
    }

    const subscriber = response.data?.subscriber ?? {};
    const entitlements: Record<string, any> = subscriber.entitlements ?? {};
    const subscriptions: Record<string, any> = subscriber.subscriptions ?? {};
    const attributes: Record<string, any> =
      subscriber.subscriber_attributes ?? {};

    const deletedAt: string | null = attributes['$deleted_at']?.value ?? null;

    const now = new Date();
    const activeEntitlements: RcActiveEntitlement[] = [];

    for (const [, ent] of Object.entries(entitlements)) {
      const expiresDate = ent.expires_date ? new Date(ent.expires_date) : null;
      if (expiresDate === null || expiresDate > now) {
        // is_sandbox is on the subscriptions object, not entitlements.
        // Cross-reference via product_identifier to get the correct flag.
        const productId: string = ent.product_identifier ?? '';
        const subInfo = subscriptions[productId] ?? {};
        activeEntitlements.push({
          productIdentifier: productId,
          expiresDate,
          isSandbox: !!subInfo.is_sandbox,
        });
      }
    }

    return { activeEntitlements, deletedAt };
  }

  async getActiveEntitlements(
    rcAppUserId: string,
  ): Promise<RcActiveEntitlement[]> {
    const info = await this.getSubscriberInfo(rcAppUserId);
    return info.activeEntitlements;
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
