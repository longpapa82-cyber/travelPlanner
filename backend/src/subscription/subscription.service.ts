import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Paddle, Environment, EventName } from '@paddle/paddle-node-sdk';
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
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';

const PREMIUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SANDBOX_YEARLY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly aiTripsFreeLimit: number;
  private readonly aiTripsPremiumLimit: number;
  private readonly paddle: Paddle | null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProcessedWebhookEvent)
    private readonly processedWebhookEventRepository: Repository<ProcessedWebhookEvent>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
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

    const paddleKey = this.configService.get<string>('PADDLE_API_KEY');
    this.paddle = paddleKey
      ? new Paddle(paddleKey, {
          environment:
            this.configService.get<string>('NODE_ENV') === 'production'
              ? Environment.production
              : Environment.sandbox,
        })
      : null;

    if (!this.paddle) {
      this.logger.warn('Paddle not configured — web payments disabled');
    }
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

    // Admin accounts are exempt from billing. PaywallModal is allowed to
    // open for them (V184 invariant 32) for QA testing, but the actual
    // server-side purchase must be blocked. Real charging is also blocked
    // by Play Console license tester registration.
    if (isOperationalAdmin(user.email, user.role)) {
      return {
        canPurchase: false,
        reason: 'admin_no_purchase',
        currentPlan: null,
        activeSkus: [],
      };
    }

    // The user is already premium → block. The client's resolvePurchaseAction
    // can use this to drive the "이미 구독 중" or "switch plan" UX without
    // touching RC SDK.
    if (user.subscriptionTier === SubscriptionTier.PREMIUM) {
      const currentPlan =
        (user.subscriptionPlanType as 'monthly' | 'yearly' | null) || null;
      this.logger.log(
        `Preflight DENY: user ${userId} already premium (plan=${currentPlan}, sku=${sku})`,
      );
      return {
        canPurchase: false,
        reason: 'already_subscribed',
        currentPlan,
        activeSkus: currentPlan ? [`premium_${currentPlan}`] : [],
      };
    }

    this.logger.log(
      `Preflight ALLOW: user ${userId} tier=free, sku=${sku}`,
    );
    return {
      canPurchase: true,
      reason: 'free_tier',
      currentPlan: null,
      activeSkus: [],
    };
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
    // V186 (Invariant 40): IDEMPOTENCY GUARD — first line of defense.
    //
    // V185 reproduced CATASTROPHIC simultaneous yearly + monthly purchase
    // (single user, both charged) because RevenueCat retried webhook
    // events without a server-side dedup key. Every replay of the same
    // INITIAL_PURCHASE re-applied the entitlement and reset
    // aiTripsUsedThisMonth, and two near-simultaneous product purchases
    // generated separate events that BOTH passed through.
    //
    // We use INSERT ... ON CONFLICT DO NOTHING to make this physically
    // idempotent at the DB level. If event.id is missing (legacy or
    // malformed payload), we fall through to the legacy logic but log a
    // warning — better than silently dropping.
    const eventId = event.id;
    if (eventId) {
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

        // raw count of rows actually inserted; 0 => duplicate event
        const insertedRows = (result.raw as any[])?.length ?? 0;
        if (insertedRows === 0) {
          this.logger.log(
            `RevenueCat event ${eventId} already processed (idempotency hit), skipping`,
          );
          return;
        }
      } catch (err: any) {
        // If the idempotency table itself fails (DB down), we still want
        // to process the event rather than drop it — the next retry will
        // catch the duplicate. Log loudly.
        this.logger.error(
          `Idempotency check failed for event ${eventId}: ${err?.message}`,
        );
      }
    } else {
      this.logger.warn(
        'RevenueCat event without event.id — cannot dedup; processing anyway',
      );
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
        const expiresAt = event.expiration_at_ms
          ? new Date(parseInt(event.expiration_at_ms, 10))
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

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
          ...(planType && { subscriptionPlanType: planType }),
          ...(purchasedAt && { subscriptionStartedAt: purchasedAt }),
          revenuecatAppUserId: appUserId,
          ...(eventType === 'INITIAL_PURCHASE' && { aiTripsUsedThisMonth: 0 }),
        });

        // Update cache
        await this.cacheManager.set(
          `premium:${user.id}`,
          'true',
          PREMIUM_CACHE_TTL,
        );
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
        const cancelExpiresAt = event.expiration_at_ms
          ? new Date(parseInt(event.expiration_at_ms, 10))
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

  // ─── Paddle Integration ──────────────────────────────────

  async getPaddleCheckoutConfig(
    userId: string,
    plan: 'monthly' | 'yearly',
  ): Promise<{ priceId: string }> {
    if (!this.paddle) {
      throw new BadRequestException('Paddle is not configured');
    }

    const priceId =
      plan === 'monthly'
        ? this.configService.get<string>('PADDLE_PRICE_MONTHLY')
        : this.configService.get<string>('PADDLE_PRICE_YEARLY');

    if (!priceId) {
      throw new BadRequestException(
        `Paddle price not configured for ${plan} plan`,
      );
    }

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    this.logger.log(
      `Paddle checkout config requested for user ${userId}, plan: ${plan}`,
    );
    return { priceId };
  }

  async handlePaddleWebhook(rawBody: string, signature: string): Promise<void> {
    if (!this.paddle) {
      throw new BadRequestException('Paddle is not configured');
    }

    const webhookSecret = this.configService.get<string>(
      'PADDLE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      this.logger.error('PADDLE_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook not configured');
    }

    let event: any;
    try {
      event = await this.paddle.webhooks.unmarshal(
        rawBody,
        webhookSecret,
        signature,
      );
    } catch (err: any) {
      this.logger.warn(
        `Paddle webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Paddle webhook received: ${event.eventType}`);

    switch (event.eventType) {
      case EventName.SubscriptionActivated:
      case EventName.TransactionCompleted: {
        await this.handlePaddleSubscriptionActivated(event.data);
        break;
      }
      case EventName.SubscriptionUpdated: {
        await this.handlePaddleSubscriptionUpdated(event.data);
        break;
      }
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue: {
        await this.handlePaddleSubscriptionEnded(event.data, event.eventType);
        break;
      }
      default:
        this.logger.log(`Unhandled Paddle event: ${event.eventType}`);
    }
  }

  private async handlePaddleSubscriptionActivated(data: any): Promise<void> {
    const userId = data.customData?.userId;
    if (!userId) {
      this.logger.warn('Paddle event without userId in customData');
      return;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });
    if (!user) {
      this.logger.warn(`Paddle event for unknown user: ${userId}`);
      return;
    }

    const nextBilledAt = data.nextBilledAt || data.next_billed_at;
    const expiresAt = nextBilledAt
      ? new Date(nextBilledAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const paddleCustomerId = data.customerId || data.customer_id || null;

    // Detect plan type by comparing line item priceId with configured prices
    const monthlyPriceId = this.configService.get<string>(
      'PADDLE_PRICE_MONTHLY',
    );
    const yearlyPriceId = this.configService.get<string>('PADDLE_PRICE_YEARLY');
    const items: any[] = data.items || data.line_items || [];
    const matchedPriceId = items
      .map((it: any) => it?.price?.id || it?.priceId || it?.price_id)
      .find((id: string | undefined) => !!id);
    const planType: 'monthly' | 'yearly' | undefined =
      matchedPriceId === yearlyPriceId
        ? 'yearly'
        : matchedPriceId === monthlyPriceId
          ? 'monthly'
          : undefined;

    await this.userRepository.update(user.id, {
      subscriptionTier: SubscriptionTier.PREMIUM,
      subscriptionPlatform: SubscriptionPlatform.WEB,
      subscriptionExpiresAt: expiresAt,
      subscriptionStartedAt: new Date(),
      ...(planType && { subscriptionPlanType: planType }),
      ...(paddleCustomerId && { paddleCustomerId }),
    });

    await this.cacheManager.set(
      `premium:${user.id}`,
      'true',
      PREMIUM_CACHE_TTL,
    );
    this.logger.log(`User ${user.id} upgraded to PREMIUM via Paddle`);
  }

  private async handlePaddleSubscriptionUpdated(data: any): Promise<void> {
    const userId = data.customData?.userId;
    const paddleCustomerId = data.customerId || data.customer_id;

    // Try to find user by customData.userId first, then by paddleCustomerId
    let user: User | null = null;
    if (userId) {
      user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id'],
      });
    }
    if (!user && paddleCustomerId) {
      user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.paddleCustomerId')
        .where('user.paddleCustomerId = :paddleCustomerId', {
          paddleCustomerId,
        })
        .getOne();
    }

    if (!user) {
      this.logger.warn(
        `Paddle subscription.updated for unknown user/customer: ${userId || paddleCustomerId}`,
      );
      return;
    }

    const status = data.status;
    if (status === 'active' || status === 'trialing') {
      const nextBilledAt = data.nextBilledAt || data.next_billed_at;
      const expiresAt = nextBilledAt
        ? new Date(nextBilledAt)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.userRepository.update(user.id, {
        subscriptionTier: SubscriptionTier.PREMIUM,
        subscriptionPlatform: SubscriptionPlatform.WEB,
        subscriptionExpiresAt: expiresAt,
      });
      await this.cacheManager.set(
        `premium:${user.id}`,
        'true',
        PREMIUM_CACHE_TTL,
      );
      this.logger.log(`User ${user.id} Paddle subscription renewed`);
    } else {
      await this.userRepository.update(user.id, {
        subscriptionTier: SubscriptionTier.FREE,
      });
      await this.cacheManager.del(`premium:${user.id}`);
      this.logger.log(`User ${user.id} Paddle subscription ended (${status})`);
    }
  }

  private async handlePaddleSubscriptionEnded(
    data: any,
    eventType: string,
  ): Promise<void> {
    const userId = data.customData?.userId;
    const paddleCustomerId = data.customerId || data.customer_id;

    let user: User | null = null;
    if (userId) {
      user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id'],
      });
    }
    if (!user && paddleCustomerId) {
      user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.paddleCustomerId')
        .where('user.paddleCustomerId = :paddleCustomerId', {
          paddleCustomerId,
        })
        .getOne();
    }

    if (!user) {
      this.logger.warn(
        `Paddle ${eventType} for unknown user/customer: ${userId || paddleCustomerId}`,
      );
      return;
    }

    await this.userRepository.update(user.id, {
      subscriptionTier: SubscriptionTier.FREE,
    });
    await this.cacheManager.del(`premium:${user.id}`);
    this.logger.log(
      `User ${user.id} downgraded to FREE via Paddle (${eventType})`,
    );
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
}
