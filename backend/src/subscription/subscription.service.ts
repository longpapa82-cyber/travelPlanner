import {
  Injectable,
  Logger,
  Inject,
  ForbiddenException,
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

const AI_TRIPS_FREE_LIMIT_DEFAULT = 3;
const PREMIUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly aiTripsFreeLimit: number;

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
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
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
    let user = await this.userRepository.findOne({
      where: { revenuecatAppUserId: appUserId },
    });
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
        this.logger.log(
          `User ${user.id} downgraded to FREE (${eventType})`,
        );
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
