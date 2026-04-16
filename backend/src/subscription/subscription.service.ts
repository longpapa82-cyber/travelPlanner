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
import { AI_TRIPS_FREE_LIMIT, AI_TRIPS_PREMIUM_LIMIT } from './constants';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';

const PREMIUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SANDBOX_YEARLY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// V115 (Gate 7 H-1 fix): no hardcoded fallback. Mirror admin.guard.ts.
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly aiTripsFreeLimit: number;
  private readonly aiTripsPremiumLimit: number;
  private readonly paddle: Paddle | null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

    const isAdmin =
      !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
    const isPremium = this.isUserPremium(user);
    const effectiveLimit = isPremium
      ? this.aiTripsPremiumLimit
      : this.aiTripsFreeLimit;
    const aiTripsRemaining = Math.max(
      0,
      effectiveLimit - user.aiTripsUsedThisMonth,
    );

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

  async handleRevenueCatEvent(event: Record<string, any>): Promise<void> {
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

        // Detect plan type from product identifier (e.g. "premium_monthly", "premium_yearly")
        const productId: string = (
          event.product_id ||
          event.product_identifier ||
          ''
        ).toLowerCase();
        const planType: 'monthly' | 'yearly' | undefined = productId.includes(
          'year',
        )
          ? 'yearly'
          : productId.includes('month')
            ? 'monthly'
            : undefined;

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
        this.logger.log(`User ${user.id} upgraded to PREMIUM (${eventType})`);
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
}
