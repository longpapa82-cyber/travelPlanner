import {
  Injectable,
  Logger,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  User,
  SubscriptionTier,
  SubscriptionPlatform,
} from '../users/entities/user.entity';
import {
  AI_TRIPS_FREE_LIMIT,
  AI_TRIPS_PREMIUM_LIMIT,
  PLAN_TYPE_BY_PRODUCT_ID,
} from './constants';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { isOperationalAdmin } from '../common/utils/admin-check';
import { safeForLog } from '../common/utils/sanitize';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';
import { RevenueCatClient, RcApiUnavailableError } from './revenuecat.client';

const PREMIUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SANDBOX_YEARLY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * V189.1 P1-Security (C-2): bound RC webhook `expiration_at_ms` to a
 * sane upper limit. The webhook secret is rotated infrequently and is
 * the only thing standing between an attacker with leaked credentials
 * and a forged INITIAL_PURCHASE event with `expiration_at_ms = Number.
 * MAX_SAFE_INTEGER` — which would mark the user PREMIUM forever.
 *
 * 5 years is well past any legitimate Google Play / Apple subscription
 * (max term is 1 year for both). Anything beyond is unilaterally clamped
 * to (now + 1 year), the longest legitimate term. The clamp also catches
 * timestamp-vs-milliseconds confusion bugs where a seconds-based value
 * gets mis-parsed as milliseconds.
 */
const MAX_LEGITIMATE_EXPIRATION_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const parseExpirationAt = (rawMs: unknown, logger: Logger): Date => {
  const fallback = () => new Date(Date.now() + ONE_YEAR_MS);
  if (rawMs === null || rawMs === undefined || rawMs === '') return fallback();
  // Stringify once for parsing/logging. For objects this yields
  // '[object Object]' (same as the prior String(rawMs) behaviour), which
  // parseInt then turns into NaN and the guard below rejects.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const rawStr = String(rawMs);
  const ms = typeof rawMs === 'number' ? rawMs : parseInt(rawStr, 10);
  if (!Number.isFinite(ms) || ms <= 0) {
    logger.warn(`expiration_at_ms invalid (${rawStr}); falling back to now+1y`);
    return fallback();
  }
  const now = Date.now();
  if (ms - now > MAX_LEGITIMATE_EXPIRATION_MS) {
    logger.error(
      `expiration_at_ms ${ms} exceeds 5y bound — clamping to now+1y. ` +
        'Possible forged webhook event or seconds-vs-ms confusion.',
    );
    return fallback();
  }
  return new Date(ms);
};

// Redis cache key for preflight RC-check result (30s TTL — shorter than
// PREMIUM_CACHE_TTL because this guards purchase entry, not status display)
const PREFLIGHT_RC_CACHE_TTL = 30 * 1000;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly aiTripsFreeLimit: number;
  private readonly aiTripsPremiumLimit: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProcessedWebhookEvent)
    private readonly processedWebhookEventRepository: Repository<ProcessedWebhookEvent>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly rcClient: RevenueCatClient,
  ) {
    this.aiTripsFreeLimit = parseInt(
      this.configService.get<string>('AI_TRIPS_FREE_LIMIT') ||
        String(AI_TRIPS_FREE_LIMIT),
      10,
    );
    this.aiTripsPremiumLimit = parseInt(
      this.configService.get<string>('AI_TRIPS_PREMIUM_LIMIT') ||
        String(AI_TRIPS_PREMIUM_LIMIT),
      10,
    );
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'subscriptionTier',
        'subscriptionPlatform',
        'subscriptionExpiresAt',
        'subscriptionStartedAt',
        'subscriptionPlanType',
        'aiTripsUsedThisMonth',
      ],
    });

    if (!user) {
      return {
        tier: SubscriptionTier.FREE,
        isPremium: false,
        isAdmin: false,
        aiTripsUsed: 0,
        aiTripsLimit: this.aiTripsFreeLimit,
        aiTripsRemaining: this.aiTripsFreeLimit,
        isSandbox: false,
      };
    }

    // V172 (B-2): unified operational-admin check (DB role OR env email).
    // Used here purely as a UI flag and to drive `aiTripsLimit` for admins.
    // Security gates (AdminGuard, throttler exemption) intentionally use
    // `isSecurityAdmin` (DB role only) instead.
    const isAdmin = isOperationalAdmin(user.email, user.role);
    const isPremium = this.isUserPremium(user);
    // V174 (P0-3): admin users bypass the counter entirely in
    // `trips.service.ts` (no increment, no limit check). The frontend
    // needs a matching unlimited-sentinel here so the UI does not keep
    // showing "3/3 remaining" while the server lets generations continue.
    const ADMIN_UNLIMITED = 9999;
    const effectiveLimit = isAdmin
      ? ADMIN_UNLIMITED
      : isPremium
        ? this.aiTripsPremiumLimit
        : this.aiTripsFreeLimit;
    const aiTripsRemaining = isAdmin
      ? ADMIN_UNLIMITED
      : Math.max(0, effectiveLimit - user.aiTripsUsedThisMonth);

    // Sandbox detection: Google Play License Tester accelerates yearly
    // subscriptions to ~30-minute cycles. If a yearly plan's lifespan from
    // startedAt→expiresAt is under 7 days, flag as sandbox so the UI can
    // show a "(테스트 구매)" badge without hiding the real dates.
    const isSandbox =
      user.subscriptionPlanType === 'yearly' &&
      !!user.subscriptionStartedAt &&
      !!user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt).getTime() -
        new Date(user.subscriptionStartedAt).getTime() <
        SANDBOX_YEARLY_THRESHOLD_MS;

    return {
      tier: isPremium ? SubscriptionTier.PREMIUM : SubscriptionTier.FREE,
      isPremium,
      isAdmin,
      platform: user.subscriptionPlatform,
      expiresAt: user.subscriptionExpiresAt ?? undefined,
      startedAt: user.subscriptionStartedAt ?? undefined,
      planType: user.subscriptionPlanType ?? undefined,
      aiTripsUsed: user.aiTripsUsedThisMonth,
      aiTripsLimit: effectiveLimit,
      aiTripsRemaining,
      isSandbox,
    };
  }

  /**
   * V186 (Invariant 41): server-authoritative purchase preflight.
   *
   * Called by PaywallModal BEFORE invoking Google Play Billing's
   * `purchasePackage`. The client MUST honor the response — if
   * `canPurchase: false`, the purchase flow is blocked.
   *
   * Why this exists:
   *   The V174~V185 6-cycle of fixes for "phantom subscription" all
   *   trusted RC SDK's `getCustomerInfo()` for client-side gating. RC
   *   SDK has device-cache + alias chain staleness that the client can
   *   never fully sanitize. V185 boog: simultaneous yearly + monthly
   *   purchase succeeded because the client gate (server tier === free)
   *   passed for both attempts before either webhook landed.
   *
   * This shifts the entire decision to the server, which:
   *   1. Reads its own DB (single source of truth for `subscriptionTier`)
   *   2. Checks for admin (admins can never be charged)
   *   3. Returns `canPurchase` + `reason` + `currentPlan` (if any)
   *
   * Future: integrate Google Play Developer API
   * `androidpublisher.purchases.subscriptionsv2.get` to also verify
   * against Google's authoritative entitlement record. For V186 the
   * server tier + admin check eliminates the V185 race window.
   */
  /**
   * V199 (Invariants 50–54): dual-source preflight.
   *
   * Layer 1 — DB tier: fast path. If the DB already shows premium (and not
   *   expired), block immediately without calling RC.
   *
   * Layer 2 — RC backend: authoritative. If DB is free, we query RC REST API
   *   to check whether the user has any active entitlements that our webhook
   *   handler hasn't processed yet (race window, dedup bypass, transient DB
   *   error). This catches both V198 bugs:
   *     Bug 1: yearly EXPIRATION sets DB=free but RC still active → monthly
   *            purchase was allowed. Now blocked at RC layer.
   *     Bug 2: TRANSFER processed DB=premium → correctly blocked (layer 1).
   *            If TRANSFER race: DB=free but RC=active → blocked at layer 2.
   *
   * Auto-reconcile: "DB free + RC active" is a phantom-subscription symptom.
   *   We update DB + cache immediately and log for Sentry visibility.
   *
   * Fail-close (Invariant 54): RC API unavailable → block purchase.
   *   False-positive (user blocked temporarily) is recoverable; false-negative
   *   (double billing) is not.
   *
   * reason enum exposed to frontend for message branching (Invariant 53):
   *   'already_subscribed'     → DB-confirmed premium
   *   'rc_entitlement_active'  → RC shows active, DB was stale (reconciled)
   *   'verification_unavailable' → RC API down, fail-close
   *   'free_tier'              → clean, proceed with purchase
   */
  async preflightPurchase(
    userId: string,
    sku?: string,
  ): Promise<{
    canPurchase: boolean;
    reason: string;
    currentPlan: 'monthly' | 'yearly' | null;
    activeSkus: string[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'subscriptionTier',
        'subscriptionPlanType',
        'subscriptionExpiresAt',
        'revenuecatAppUserId',
        'createdAt',
      ],
    });

    if (!user) {
      return {
        canPurchase: false,
        reason: 'user_not_found',
        currentPlan: null,
        activeSkus: [],
      };
    }

    // Invariants 32 + 43: admin status does NOT gate purchase entry.
    // Log only for audit; real charge blocked by Play Console license tester.
    if (isOperationalAdmin(user.email, user.role)) {
      this.logger.log(
        `Preflight: admin user ${userId} entering purchase flow (license tester gate enforces no real charge)`,
      );
    }

    // ── Layer 1: DB tier (fast path) ──────────────────────────────────────
    if (this.isUserPremium(user)) {
      const currentPlan =
        (user.subscriptionPlanType as 'monthly' | 'yearly' | null) || null;
      this.logger.log(
        `Preflight DENY [db]: user ${userId} already premium ` +
          `(plan=${currentPlan}, sku=${safeForLog(sku, 50)})`,
      );
      return {
        canPurchase: false,
        reason: 'already_subscribed',
        currentPlan,
        activeSkus: currentPlan ? [`premium_${currentPlan}`] : [],
      };
    }

    // ── Layer 2: RC backend authoritative check ───────────────────────────
    if (!this.rcClient.isEnabled) {
      // RC API key not configured — degraded mode, rely on DB only.
      this.logger.warn(
        `Preflight ALLOW [db-only/degraded]: user ${userId} tier=free, ` +
          `RC verification disabled, sku=${safeForLog(sku, 50)}`,
      );
      return {
        canPurchase: true,
        reason: 'free_tier',
        currentPlan: null,
        activeSkus: [],
      };
    }

    const rcUserId = user.revenuecatAppUserId || userId;

    // Short-circuit: check if we already fetched RC result for this user
    // recently (30s cache) to avoid hammering RC on rapid retaps.
    const cacheKey = `preflight:rc:${userId}`;
    const cachedRcActive = await this.cacheManager.get<string>(cacheKey);

    let rcActiveSkus: string[] = [];

    // V213: cache stores JSON with skus + deletedAt for phantom detection
    // V216: also store isSandboxOnly to filter sandbox-only entitlements in production
    interface RcCacheEntry {
      skus: string[];
      deletedAt: string | null;
      isSandboxOnly?: boolean;
    }
    let rcDeletedAt: string | null = null;
    let rcIsSandboxOnly = false;

    if (cachedRcActive !== null && cachedRcActive !== undefined) {
      const parsed: RcCacheEntry = cachedRcActive
        ? JSON.parse(cachedRcActive)
        : { skus: [], deletedAt: null };
      rcActiveSkus = parsed.skus ?? (parsed as unknown as string[]); // backward compat
      rcDeletedAt = parsed.deletedAt ?? null;
      rcIsSandboxOnly = parsed.isSandboxOnly ?? false;
    } else {
      try {
        const info = await this.rcClient.getSubscriberInfo(rcUserId);
        // V216: sandbox-only entitlements should not block production purchases.
        // A Sandbox TestFlight entitlement (isSandbox=true) can remain active
        // after the user cancels in Google Play — they are separate billing systems.
        // Filter out sandbox entitlements from the active SKU list for production preflight.
        const allActive = info.activeEntitlements;
        const prodActive = allActive.filter((e) => !e.isSandbox);
        rcIsSandboxOnly = allActive.length > 0 && prodActive.length === 0;
        rcActiveSkus = prodActive.map((e) => e.productIdentifier);
        rcDeletedAt = info.deletedAt;
        const entry: RcCacheEntry = {
          skus: rcActiveSkus,
          deletedAt: rcDeletedAt,
          isSandboxOnly: rcIsSandboxOnly,
        };
        await this.cacheManager.set(
          cacheKey,
          JSON.stringify(entry),
          PREFLIGHT_RC_CACHE_TTL,
        );
      } catch (err) {
        if (err instanceof RcApiUnavailableError) {
          // Invariant 54: fail-close on RC unavailability
          this.logger.error(
            `Preflight DENY [rc-unavailable/fail-close]: user ${userId} — ${err.message}`,
          );
          return {
            canPurchase: false,
            reason: 'verification_unavailable',
            currentPlan: null,
            activeSkus: [],
          };
        }
        throw err;
      }
    }

    // V216: log when sandbox-only entitlements were filtered out
    if (rcIsSandboxOnly) {
      this.logger.warn(
        `Preflight ALLOW [sandbox-filtered]: user ${userId} had sandbox-only RC entitlements. ` +
          `Filtered for production preflight — sandbox and production are separate billing systems.`,
      );
    }

    if (rcActiveSkus.length > 0) {
      // V213 (P0-2): If $deleted_at is set on the RC subscriber and is older
      // than this user's account (user was created after deletion), the
      // entitlement is a phantom from a previous account. Allow purchase.
      if (rcDeletedAt) {
        const userCreatedAt = user.createdAt as Date | undefined;
        const deletedAtMs = new Date(rcDeletedAt).getTime();
        const userCreatedMs = userCreatedAt ? userCreatedAt.getTime() : 0;
        if (deletedAtMs < userCreatedMs) {
          this.logger.warn(
            `Preflight ALLOW [phantom-detected]: user=${userId} RC deleted_at=${rcDeletedAt} ` +
              `is before user.createdAt — entitlement is from a prior deleted account. Skipping block.`,
          );
          // Fall through to the ALLOW path below
        } else {
          // deleted_at exists but is newer — ambiguous; block conservatively
          this.logger.warn(
            `Preflight DENY [rc-deleted-marker]: user=${userId} RC shows deleted_at=${rcDeletedAt} ` +
              `and active skus=${JSON.stringify(rcActiveSkus)}. Blocking conservatively.`,
          );
          return {
            canPurchase: false,
            reason: 'rc_entitlement_active',
            currentPlan: this.inferPlanFromSkus(rcActiveSkus),
            activeSkus: rcActiveSkus,
          };
        }
      } else {
        // Invariant 51: active RC entitlement without deleted_at → block.
        // V213 (P0-1): No DB reconcile — DB remains free.
        const activePlan = this.inferPlanFromSkus(rcActiveSkus);
        this.logger.warn(
          `Preflight DENY [rc]: user ${userId} DB=free but RC shows active ` +
            `products=${JSON.stringify(rcActiveSkus)}, sku=${safeForLog(sku, 50)}. ` +
            `Blocking (no DB reconcile). Investigate if recurring.`,
        );
        return {
          canPurchase: false,
          reason: 'rc_entitlement_active',
          currentPlan: activePlan,
          activeSkus: rcActiveSkus,
        };
      }
    }

    this.logger.log(
      `Preflight ALLOW [rc-verified]: user ${userId} tier=free, ` +
        `RC confirmed no active entitlements, sku=${safeForLog(sku, 50)}`,
    );
    return {
      canPurchase: true,
      reason: 'free_tier',
      currentPlan: null,
      activeSkus: [],
    };
  }

  private inferPlanFromSkus(skus: string[]): 'monthly' | 'yearly' | null {
    for (const sku of skus) {
      const plan = PLAN_TYPE_BY_PRODUCT_ID[sku.toLowerCase()];
      if (plan) return plan;
    }
    return null;
  }

  private async reconcileFromRcEntitlements(
    userId: string,
    activeSkus: string[],
  ): Promise<void> {
    const activePlan = this.inferPlanFromSkus(activeSkus);
    // Use a 1-year fallback expiry; the next RENEWAL/EXPIRATION webhook
    // will correct this to the real date.
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await this.userRepository.update(userId, {
      subscriptionTier: SubscriptionTier.PREMIUM,
      subscriptionExpiresAt: expiresAt,
      ...(activePlan && { subscriptionPlanType: activePlan }),
    });
    await this.cacheManager.set(`premium:${userId}`, 'true', PREMIUM_CACHE_TTL);
    this.logger.warn(
      `[subscription] phantom_subscription_recovered: user=${userId} ` +
        `rc_skus=${JSON.stringify(activeSkus)} plan=${activePlan ?? 'unknown'}. ` +
        'DB reconciled. Next webhook will correct expiresAt.',
    );
  }

  async checkAiTripLimit(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
  }> {
    const status = await this.getSubscriptionStatus(userId);

    return {
      allowed: status.aiTripsRemaining > 0,
      remaining: status.aiTripsRemaining,
    };
  }

  async incrementAiTripCount(userId: string): Promise<void> {
    await this.userRepository.increment(
      { id: userId },
      'aiTripsUsedThisMonth',
      1,
    );
  }

  /**
   * V172 (B-1): Saga compensation for `incrementAiTripCount`.
   *
   * Called by `TripsService.restoreAiQuota` after an AI trip creation
   * fails (Phase B fallback to empty, Phase C save error, or user cancel).
   * `GREATEST(... - 1, 0)` is the safety net — even if a future caller
   * forgets the `quotaRefunded` idempotency check, the counter can never
   * go below zero. The monthly cron then resets to 0 normally.
   */
  async decrementAiTripCount(userId: string): Promise<void> {
    await this.userRepository
      .createQueryBuilder()
      .update('users')
      .set({
        aiTripsUsedThisMonth: () => 'GREATEST("aiTripsUsedThisMonth" - 1, 0)',
      })
      .where('id = :userId', { userId })
      .execute();
  }

  async handleRevenueCatEvent(event: Record<string, any>): Promise<void> {
    // V187 P0-D (Invariant 40 강화): atomic idempotency.
    //
    // V186's first-cut idempotency had two race windows:
    //
    //   1. INSERT and the entitlement update were separate operations. If
    //      the process crashed between them, the next retry saw the
    //      idempotency row, skipped, and the user was never upgraded.
    //
    //   2. The catch block "fell through" to the handler on idempotency
    //      DB failure, defeating the dedup guard entirely — every retry
    //      that hit a transient DB hiccup would re-apply entitlements.
    //
    // V187 wraps the dedup INSERT and (resolved below) the user-update
    // call in a single transaction. We also fail loudly with a 5xx if
    // the dedup table itself is unreachable, so RevenueCat retries the
    // event — that is the correct semantics, not "drop the guard".
    //
    // `result.raw` shape: TypeORM 0.3 + pg returns `[]` when the conflict
    // path took effect, `[{}]` when the row was newly inserted. Some pg
    // configurations (older drivers) return `undefined` instead of `[]`.
    // We treat any falsy / zero-length raw as a duplicate.
    const eventId = event.id;
    if (!eventId) {
      // Without an event id we cannot dedup. RevenueCat always sends one
      // for real events; missing id implies test/malformed payload.
      this.logger.warn(
        'RevenueCat event without event.id — cannot dedup; processing anyway',
      );
    } else {
      let insertedRows = 0;
      try {
        const result = await this.processedWebhookEventRepository
          .createQueryBuilder()
          .insert()
          .values({
            eventId: String(eventId),
            source: 'rc',
            eventType: event.type || null,
            userId: null, // resolved below; we update after handler completes
          })
          .orIgnore() // INSERT ... ON CONFLICT DO NOTHING
          .execute();

        const raw = result?.raw;
        insertedRows = Array.isArray(raw)
          ? raw.length
          : raw && typeof raw === 'object' && 'rowCount' in raw
            ? ((raw as { rowCount?: number }).rowCount ?? 0)
            : 0;
      } catch (err: unknown) {
        // Re-throw as 5xx so RevenueCat retries the webhook. Silently
        // falling through here was the V186 design flaw — it converted
        // every transient DB error into a permanent dedup bypass.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Idempotency check failed for event ${eventId}: ${message}`,
        );
        throw new InternalServerErrorException(
          `Webhook dedup table unavailable for event ${eventId}; client should retry`,
        );
      }

      if (insertedRows === 0) {
        this.logger.log(
          `RevenueCat event ${eventId} already processed (idempotency hit), skipping`,
        );
        return;
      }
    }

    // Invariant 49 (V197): TRANSFER events use transferred_to/transferred_from
    // instead of app_user_id. Handle them before the app_user_id guard to
    // prevent the early-return that was silently dropping all TRANSFER events
    // and causing the 7th phantom subscription recurrence (V196).
    //
    // RC TRANSFER payload: { type: 'TRANSFER', transferred_to: [newId],
    //   transferred_from: [oldId], product_id, expiration_at_ms, ... }
    if (event.type === 'TRANSFER') {
      await this.handleTransferEvent(event, eventId);
      return;
    }

    const appUserId = event.app_user_id;
    if (!appUserId) {
      this.logger.warn('RevenueCat event without app_user_id, skipping');
      return;
    }

    // Find user by RevenueCat app user ID or by our user ID
    let user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.revenuecatAppUserId')
      .where('user.revenuecatAppUserId = :appUserId', { appUserId })
      .getOne();
    if (!user) {
      // appUserId might be our UUID user ID; guard against invalid UUID format
      // which would cause a PostgreSQL cast error
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(appUserId)) {
        user = await this.userRepository.findOne({
          where: { id: appUserId },
        });
      }
    }
    // RC may send the anonymous ID ($RCAnonymousID:xxx) when logIn() alias
    // hasn't propagated yet. Try to find the user via the RC alias API.
    if (!user && appUserId.startsWith('$RCAnonymousID:')) {
      this.logger.warn(
        `[webhook] RC anonymous ID received: ${appUserId}. ` +
          'Attempting alias lookup via RC API.',
      );
      try {
        const info = await this.rcClient.getSubscriberInfo(appUserId);
        // RC subscriber object carries `other_purchases` keyed by our UUID
        // when an alias chain exists. We can't easily extract it here without
        // the raw RC response. Instead, log and let syncFromRc handle it.
        this.logger.warn(
          `[webhook] Anonymous ID has ${info.activeEntitlements.length} active entitlements. ` +
            'syncFromRc will reconcile on next client call.',
        );
      } catch {
        // RC API unavailable — continue, user will remain null, webhook skipped
      }
    }

    if (!user) {
      this.logger.warn(
        `RevenueCat event for unknown user: ${appUserId}, type: ${event.type}`,
      );
      return;
    }

    const eventType = event.type;
    this.logger.log(
      `Processing RevenueCat event: ${eventType} for user ${user.id}`,
    );

    const storeToPlatform: Record<string, SubscriptionPlatform> = {
      APP_STORE: SubscriptionPlatform.IOS,
      PLAY_STORE: SubscriptionPlatform.ANDROID,
      STRIPE: SubscriptionPlatform.WEB,
    };

    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION': {
        const expiresAt = parseExpirationAt(
          event.expiration_at_ms,
          this.logger,
        );

        // V169 (B1): Explicit mapping instead of substring heuristic.
        // See PLAN_TYPE_BY_PRODUCT_ID for the whitelist.
        const productId: string = (
          event.product_id ||
          event.product_identifier ||
          ''
        ).toLowerCase();
        const planType = this.resolvePlanType(productId, eventType);

        const purchasedAt = event.purchased_at_ms
          ? new Date(parseInt(event.purchased_at_ms, 10))
          : eventType === 'INITIAL_PURCHASE'
            ? new Date()
            : undefined;

        await this.userRepository.update(user.id, {
          subscriptionTier: SubscriptionTier.PREMIUM,
          subscriptionPlatform:
            storeToPlatform[event.store || ''] || user.subscriptionPlatform,
          subscriptionExpiresAt: expiresAt,
          subscriptionIsSandbox: event.environment === 'SANDBOX',
          ...(planType && { subscriptionPlanType: planType }),
          ...(purchasedAt && { subscriptionStartedAt: purchasedAt }),
          revenuecatAppUserId: appUserId,
          ...(eventType === 'INITIAL_PURCHASE' && { aiTripsUsedThisMonth: 0 }),
        });

        // Update premium cache and invalidate preflight RC cache so the
        // next purchase attempt re-fetches RC truth instead of serving a
        // stale "no active entitlements" result that would allow a second
        // simultaneous SKU purchase (Invariant 51 cross-SKU block).
        await this.cacheManager.set(
          `premium:${user.id}`,
          'true',
          PREMIUM_CACHE_TTL,
        );
        await this.cacheManager.del(`preflight:rc:${user.id}`);
        // V169 (F5): structured log so ops can correlate webhook receipt
        // with the client-side polling window. The `planType=unknown` case
        // is the loud signal for a missing SKU in PLAN_TYPE_BY_PRODUCT_ID.
        this.logger.log(
          `[subscription] user=${user.id} upgraded to PREMIUM ` +
            `event=${eventType} productId=${productId || 'missing'} ` +
            `planType=${planType ?? 'unknown'} expiresAt=${expiresAt.toISOString()}`,
        );
        break;
      }

      case 'CANCELLATION': {
        // CANCELLATION means auto-renew was turned off, but the current period
        // is still valid.  Keep PREMIUM until expiration_at_ms, then EXPIRATION
        // event will fire.  Only update the expiry so isUserPremium() naturally
        // downgrades once the period ends.
        // V189.1: bound CANCELLATION expiration too — same forged-event
        // surface as INITIAL_PURCHASE.
        const cancelExpiresAt = event.expiration_at_ms
          ? parseExpirationAt(event.expiration_at_ms, this.logger)
          : null;
        if (cancelExpiresAt && cancelExpiresAt > new Date()) {
          await this.userRepository.update(user.id, {
            subscriptionExpiresAt: cancelExpiresAt,
          });
          // Keep cache valid only until expiry
          const remainingMs = cancelExpiresAt.getTime() - Date.now();
          await this.cacheManager.set(
            `premium:${user.id}`,
            'true',
            Math.min(remainingMs, PREMIUM_CACHE_TTL),
          );
          this.logger.log(
            `User ${user.id} CANCELLATION — premium until ${cancelExpiresAt.toISOString()}`,
          );
        } else {
          // No future expiry or already past — downgrade immediately
          await this.userRepository.update(user.id, {
            subscriptionTier: SubscriptionTier.FREE,
          });
          await this.cacheManager.del(`premium:${user.id}`);
          this.logger.log(
            `User ${user.id} downgraded to FREE (CANCELLATION, no remaining period)`,
          );
        }
        break;
      }

      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        await this.userRepository.update(user.id, {
          subscriptionTier: SubscriptionTier.FREE,
        });

        // Invalidate cache
        await this.cacheManager.del(`premium:${user.id}`);
        this.logger.log(`User ${user.id} downgraded to FREE (${eventType})`);
        break;
      }

      default:
        this.logger.log(`Unhandled RevenueCat event type: ${eventType}`);
    }

    // V196: backfill userId on the idempotency row now that we know user.id.
    // The INSERT above used null to avoid a chicken-and-egg dependency;
    // update it here so ops can correlate webhook events to users in DB.
    if (eventId) {
      await this.processedWebhookEventRepository
        .createQueryBuilder()
        .update()
        .set({ userId: user.id })
        .where('"eventId" = :eventId', { eventId: String(eventId) })
        .execute();
    }
  }

  // Invariant 49 (V197): TRANSFER events have no app_user_id; they carry
  // transferred_to (array of new RC appUserIds) and transferred_from (array
  // of old RC appUserIds). We resolve the receiving user via transferred_to,
  // rebind revenuecatAppUserId, and apply the entitlement immediately.
  private async handleTransferEvent(
    event: Record<string, any>,
    eventId: string | undefined,
  ): Promise<void> {
    const transferredTo: string[] = Array.isArray(event.transferred_to)
      ? event.transferred_to
      : event.transferred_to
        ? [event.transferred_to]
        : [];

    if (transferredTo.length === 0) {
      this.logger.warn(
        `[subscription] TRANSFER event has no transferred_to — cannot resolve user. eventId=${eventId ?? 'none'}`,
      );
      return;
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let user: User | null = null;
    let matchedAppUserId: string | null = null;

    for (const candidateId of transferredTo) {
      // Try by revenuecatAppUserId first
      user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.revenuecatAppUserId')
        .where('user.revenuecatAppUserId = :id', { id: candidateId })
        .getOne();

      if (!user && uuidRegex.test(candidateId)) {
        // candidateId may be our own UUID (RC uses it as appUserId by default)
        user = await this.userRepository.findOne({
          where: { id: candidateId },
        });
      }

      if (user) {
        matchedAppUserId = candidateId;
        break;
      }
    }

    if (!user) {
      this.logger.warn(
        `[subscription] TRANSFER: no matching user for transferred_to=${JSON.stringify(transferredTo)}. eventId=${eventId ?? 'none'}`,
      );
      return;
    }

    const transferExpiresAt = event.expiration_at_ms
      ? parseExpirationAt(event.expiration_at_ms, this.logger)
      : null;
    const productId = (
      event.product_id ||
      event.product_identifier ||
      ''
    ).toLowerCase();
    const planType = productId
      ? this.resolvePlanType(productId, 'TRANSFER')
      : undefined;

    const update: Partial<User> = {
      revenuecatAppUserId: matchedAppUserId ?? user.revenuecatAppUserId,
    };

    if (transferExpiresAt && transferExpiresAt > new Date()) {
      update.subscriptionTier = SubscriptionTier.PREMIUM;
      update.subscriptionExpiresAt = transferExpiresAt;
      update.subscriptionIsSandbox = event.environment === 'SANDBOX';
      if (planType) update.subscriptionPlanType = planType;
      const remainingMs = transferExpiresAt.getTime() - Date.now();
      await this.cacheManager.set(
        `premium:${user.id}`,
        'true',
        Math.min(remainingMs, PREMIUM_CACHE_TTL),
      );
    } else {
      // Expired or missing expiry — clear any stale premium state
      update.subscriptionTier = SubscriptionTier.FREE;
      await this.cacheManager.del(`premium:${user.id}`);
    }

    await this.userRepository.update(user.id, update);

    if (eventId) {
      await this.processedWebhookEventRepository
        .createQueryBuilder()
        .update()
        .set({ userId: user.id })
        .where('"eventId" = :eventId', { eventId: String(eventId) })
        .execute();
    }

    this.logger.log(
      `[subscription] TRANSFER processed: user=${user.id} ` +
        `rcId=${matchedAppUserId} tier=${update.subscriptionTier} ` +
        `expiresAt=${transferExpiresAt?.toISOString() ?? 'none'}`,
    );
  }

  async isPremiumUser(userId: string): Promise<boolean> {
    // Check Redis cache first
    const cached = await this.cacheManager.get<string>(`premium:${userId}`);
    if (cached !== null && cached !== undefined) {
      return cached === 'true';
    }

    // Cache miss — check DB
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'subscriptionTier', 'subscriptionExpiresAt'],
    });

    const isPremium = user ? this.isUserPremium(user) : false;

    // Cache the result
    await this.cacheManager.set(
      `premium:${userId}`,
      isPremium ? 'true' : 'false',
      PREMIUM_CACHE_TTL,
    );

    return isPremium;
  }

  async restoreSubscription(userId: string): Promise<{ restored: boolean }> {
    // Force refresh from DB (clear cache)
    await this.cacheManager.del(`premium:${userId}`);
    const status = await this.getSubscriptionStatus(userId);
    return { restored: status.isPremium };
  }

  private isUserPremium(user: Partial<User>): boolean {
    return (
      user.subscriptionTier === SubscriptionTier.PREMIUM &&
      (!user.subscriptionExpiresAt ||
        new Date(user.subscriptionExpiresAt) > new Date())
    );
  }

  /**
   * V169 (B1): Lookup plan type from the explicit SKU whitelist.
   *
   * Returns undefined for unknown SKUs (callers already spread the result
   * with `...(planType && { ... })` so the DB is left untouched). Unknown
   * SKUs also emit a warning so ops can add them to PLAN_TYPE_BY_PRODUCT_ID
   * before users see stale planType in the UI.
   *
   * Exposed as a private method (not a bare function) so the Logger
   * context matches the rest of the service for log correlation.
   */
  private resolvePlanType(
    productId: string,
    eventType: string,
  ): 'monthly' | 'yearly' | undefined {
    if (!productId) return undefined;
    const match = PLAN_TYPE_BY_PRODUCT_ID[productId];
    if (match) return match;
    // Last-resort heuristic so a brand-new SKU doesn't wipe out an existing
    // planType mid-renewal. Still log loudly so we get a signal.
    const fallback: 'monthly' | 'yearly' | undefined =
      productId.includes('year') || productId.includes('annual')
        ? 'yearly'
        : productId.includes('month')
          ? 'monthly'
          : undefined;
    this.logger.warn(
      `Unmapped subscription SKU "${productId}" on ${eventType} — ` +
        `falling back to heuristic planType=${fallback ?? 'unknown'}. ` +
        `Add this SKU to PLAN_TYPE_BY_PRODUCT_ID in subscription/constants.ts.`,
    );
    return fallback;
  }

  // ─── Cron ────────────────────────────────────────────────

  // Reset AI trip counters on the 1st of each month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyAiTripCounters(): Promise<void> {
    const result = await this.userRepository.update(
      {},
      { aiTripsUsedThisMonth: 0 },
    );
    this.logger.log(
      `Monthly AI trip counter reset — ${result.affected ?? 0} users`,
    );
  }

  /**
   * V186 (Invariant 40): purge processed_webhook_events older than 30
   * days. Bounds table size while still catching late RC retries
   * (RevenueCat documented retry window is up to 7 days; 30 is safe margin).
   */
  @Cron('30 4 * * *') // daily at 04:30
  async cleanupOldProcessedWebhookEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.processedWebhookEventRepository
      .createQueryBuilder()
      .delete()
      .where('"processedAt" < :cutoff', { cutoff })
      .execute();
    this.logger.log(
      `Purged ${result.affected ?? 0} processed_webhook_events older than 30 days`,
    );
  }

  /**
   * RC SDK가 이미 entitlement를 확인한 상태에서 서버 DB가 아직 free인 경우
   * RC REST API에서 직접 subscriber 정보를 가져와 DB를 강제 동기화합니다.
   *
   * 사용 시점: finalizePurchase polling 60초 타임아웃 후 클라이언트가 호출.
   * RC → DB 경로: REST API getSubscriberInfo → parseEntitlement → userRepository.update
   */
  async syncFromRc(userId: string): Promise<{ synced: boolean; tier: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'subscriptionTier', 'revenuecatAppUserId'],
    });

    if (!user) {
      return { synced: false, tier: 'free' };
    }

    // RC 앱 유저 ID: 우리 UUID 우선, 없으면 DB 저장된 RC ID
    const rcAppUserId = user.revenuecatAppUserId || String(userId);

    let subscriberInfo;
    try {
      subscriberInfo = await this.rcClient.getSubscriberInfo(rcAppUserId);
    } catch {
      this.logger.warn(`[syncFromRc] RC API unavailable for user=${userId}`);
      return { synced: false, tier: user.subscriptionTier };
    }

    // Accept both production and sandbox entitlements — TestFlight builds
    // always produce sandbox entitlements (isSandbox=true). Filtering them
    // out caused syncFromRc to always return synced=false for TestFlight
    // testers, resulting in infinite loading after purchase.
    // The subscriptionIsSandbox flag keeps sandbox purchases out of the
    // revenue dashboard (already filtered there).
    const allActive = subscriberInfo.activeEntitlements;
    const isSandboxOnly =
      allActive.length > 0 && allActive.every((e) => e.isSandbox);

    if (allActive.length === 0) {
      this.logger.log(`[syncFromRc] No active entitlements for user=${userId}`);
      return { synced: false, tier: user.subscriptionTier };
    }

    // 만료일 중 가장 늦은 것 사용 (null = 영구)
    const expiresAt = allActive.reduce((latest: Date | null, e) => {
      if (e.expiresDate === null) return null;
      if (latest === null) return latest;
      return e.expiresDate > latest ? e.expiresDate : latest;
    }, allActive[0].expiresDate);

    await this.userRepository.update(userId, {
      subscriptionTier: SubscriptionTier.PREMIUM,
      subscriptionPlatform: SubscriptionPlatform.IOS,
      subscriptionExpiresAt:
        expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      subscriptionStartedAt: new Date(),
      subscriptionIsSandbox: isSandboxOnly,
    });

    await this.cacheManager.set(`premium:${userId}`, 'true', PREMIUM_CACHE_TTL);
    await this.cacheManager.del(`preflight:rc:${userId}`);

    this.logger.log(
      `[syncFromRc] Synced user=${userId} to PREMIUM from RC direct API. ` +
        `entitlements=${allActive.length} isSandbox=${isSandboxOnly} expiresAt=${expiresAt?.toISOString() ?? 'lifetime'}`,
    );

    return { synced: true, tier: 'premium' };
  }
}
