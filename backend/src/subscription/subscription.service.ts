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

const AI_TRIPS_FREE_LIMIT_DEFAULT = 3;
const PREMIUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS || 'a090723@naver.com,longpapa82@gmail.com'
)
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly aiTripsFreeLimit: number;
  private readonly paddle: Paddle | null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.aiTripsFreeLimit = parseInt(
      this.configService.get<string>('AI_TRIPS_FREE_LIMIT') ||
        String(AI_TRIPS_FREE_LIMIT_DEFAULT),
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

  async getSubscriptionStatus(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'subscriptionTier',
        'subscriptionPlatform',
        'subscriptionExpiresAt',
        'aiTripsUsedThisMonth',
      ],
    });

    if (!user) {
      return {
        tier: SubscriptionTier.FREE,
        isPremium: false,
        aiTripsUsed: 0,
        aiTripsLimit: this.aiTripsFreeLimit,
        aiTripsRemaining: this.aiTripsFreeLimit,
      };
    }

    const isPremium = this.isUserPremium(user);
    const aiTripsRemaining = isPremium
      ? -1 // unlimited
      : Math.max(0, this.aiTripsFreeLimit - user.aiTripsUsedThisMonth);

    return {
      tier: isPremium ? SubscriptionTier.PREMIUM : SubscriptionTier.FREE,
      isPremium,
      platform: user.subscriptionPlatform,
      expiresAt: user.subscriptionExpiresAt,
      aiTripsUsed: user.aiTripsUsedThisMonth,
      aiTripsLimit: isPremium ? -1 : this.aiTripsFreeLimit,
      aiTripsRemaining,
    };
  }

  async checkAiTripLimit(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
  }> {
    // Admin users are exempt from AI trip limits
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email'],
    });
    if (user?.email && ADMIN_EMAILS.includes(user.email)) {
      return { allowed: true, remaining: -1 };
    }

    const status = await this.getSubscriptionStatus(userId);

    if (status.isPremium) {
      return { allowed: true, remaining: -1 };
    }

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

  async handleRevenueCatEvent(event: {
    type: string;
    app_user_id?: string;
    product_id?: string;
    store?: string;
    expiration_at_ms?: string;
  }): Promise<void> {
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
      user = await this.userRepository.findOne({
        where: { id: appUserId },
      });
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

        await this.userRepository.update(user.id, {
          subscriptionTier: SubscriptionTier.PREMIUM,
          subscriptionPlatform:
            storeToPlatform[event.store || ''] || user.subscriptionPlatform,
          subscriptionExpiresAt: expiresAt,
          revenuecatAppUserId: appUserId,
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

      case 'CANCELLATION':
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
      event = await this.paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
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

    await this.userRepository.update(user.id, {
      subscriptionTier: SubscriptionTier.PREMIUM,
      subscriptionPlatform: SubscriptionPlatform.WEB,
      subscriptionExpiresAt: expiresAt,
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
