/**
 * V169 (F4): Post-purchase webhook lag insurance.
 *
 * The handoff chain after a successful Google Play / App Store purchase is:
 *   app → RevenueCat SDK → RevenueCat server → TravelPlanner webhook
 *     → DB update → /subscription/status
 * Typical round-trip is 1–5s, but we've observed up to ~10s during Alpha.
 * Without this polling, the paywall closes, the user lands on
 * SubscriptionScreen, and sees stale `subscriptionTier: 'free'` for a few
 * seconds before the next organic refresh — indistinguishable from the
 * V169 "구독 안됨 → 갑자기 월간 결제" bug.
 *
 * This helper polls /subscription/status (via AuthContext.refreshUser which
 * calls /auth/me, returning the same five subscription fields) until the
 * server confirms premium or we give up.
 */
import apiService from './api';
import { addBreadcrumb } from '../common/sentry';

const DEFAULT_MAX_ATTEMPTS = 15;
const DEFAULT_INTERVAL_MS = 1_000;

export interface PollResult {
  confirmed: boolean;
  attempts: number;
  elapsedMs: number;
}

/**
 * Poll `/subscription/status` until it reports premium, or until we run out
 * of attempts. Each attempt is separated by `intervalMs`.
 *
 * Does not throw on transient errors — individual poll failures are logged
 * as breadcrumbs but do not abort the loop. Only the final verdict matters.
 */
export async function pollSubscriptionStatus(
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onSuccess?: () => void | Promise<void>;
  } = {},
): Promise<PollResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const status = await apiService.getSubscriptionStatus();
      if (status?.isPremium) {
        addBreadcrumb({
          category: 'subscription',
          message: 'polling.confirmed',
          data: { attempt, elapsedMs: Date.now() - startedAt },
        });
        if (options.onSuccess) {
          await options.onSuccess();
        }
        return {
          confirmed: true,
          attempts: attempt,
          elapsedMs: Date.now() - startedAt,
        };
      }
    } catch (err: any) {
      addBreadcrumb({
        category: 'subscription',
        message: 'polling.attempt-failed',
        level: 'warning',
        data: { attempt, error: err?.message ?? 'unknown' },
      });
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  addBreadcrumb({
    category: 'subscription',
    message: 'polling.timeout',
    level: 'warning',
    data: { attempts: maxAttempts, elapsedMs: Date.now() - startedAt },
  });
  return {
    confirmed: false,
    attempts: maxAttempts,
    elapsedMs: Date.now() - startedAt,
  };
}
