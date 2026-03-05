import {
  Injectable,
  Logger,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  User,
  SubscriptionTier,
  SubscriptionPlatform,
} from '../users/entities/user.entity';

const AI_TRIPS_FREE_LIMIT_DEFAULT = 3;
const PREMIUM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || 'a090723@naver.com,longpapa82@gmail.com')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly aiTripsFreeLimit: number;
  private readonly stripe: Stripe | null;

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

    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeKey
      ? new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' })
      : null;

    if (!this.stripe) {
      this.logger.warn('Stripe not configured — web payments disabled');
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

  // ─── Stripe Integration ───────────────────────────────────

  async createStripeCheckoutSession(
    userId: string,
    plan: 'monthly' | 'yearly',
  ): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const priceId =
      plan === 'monthly'
        ? this.configService.get<string>('STRIPE_PRICE_MONTHLY')
        : this.configService.get<string>('STRIPE_PRICE_YEARLY');

    if (!priceId) {
      throw new BadRequestException(`Stripe price not configured for ${plan} plan`);
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'stripeCustomerId'],
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Reuse or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await this.userRepository.update(user.id, { stripeCustomerId: customerId });
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://mytravel-planner.com';

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/subscription/cancel`,
      metadata: { userId: user.id, plan },
    });

    if (!session.url) {
      this.logger.error(`Stripe checkout session created without URL, session: ${session.id}`);
      throw new BadRequestException('Checkout session creation failed');
    }

    this.logger.log(`Stripe checkout session created for user ${userId}, plan: ${plan}`);
    return { url: session.url };
  }

  async createStripePortalSession(userId: string): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'stripeCustomerId'],
    });

    if (!user?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://mytravel-planner.com';

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/settings`,
    });

    return { url: session.url };
  }

  async handleStripeWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleStripeCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleStripeSubscriptionChange(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handleStripePaymentFailed(invoice);
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleStripeCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn('Stripe checkout session without userId metadata');
      return;
    }

    if (session.payment_status !== 'paid') {
      this.logger.warn(`Stripe checkout ${session.id} payment_status=${session.payment_status}, skipping for user ${userId}`);
      return;
    }

    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      this.logger.error(`Stripe checkout ${session.id} completed without subscription ID for user ${userId}`);
      return;
    }
    if (!this.stripe) return;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data'],
    });
    const periodEnd = subscription.items.data[0]?.current_period_end;
    const expiresAt = periodEnd
      ? new Date(periodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.userRepository.update(userId, {
      subscriptionTier: SubscriptionTier.PREMIUM,
      subscriptionPlatform: SubscriptionPlatform.WEB,
      subscriptionExpiresAt: expiresAt,
      stripeCustomerId: session.customer as string,
    });

    await this.cacheManager.set(`premium:${userId}`, 'true', PREMIUM_CACHE_TTL);
    this.logger.log(`User ${userId} upgraded to PREMIUM via Stripe`);
  }

  private async handleStripeSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.userRepository.findOne({
      where: { stripeCustomerId: customerId },
      select: ['id'],
    });

    if (!user) {
      this.logger.warn(`Stripe subscription event for unknown customer: ${customerId}`);
      return;
    }

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const periodEnd = subscription.items?.data?.[0]?.current_period_end;
      const expiresAt = periodEnd
        ? new Date(periodEnd * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.userRepository.update(user.id, {
        subscriptionTier: SubscriptionTier.PREMIUM,
        subscriptionPlatform: SubscriptionPlatform.WEB,
        subscriptionExpiresAt: expiresAt,
      });
      await this.cacheManager.set(`premium:${user.id}`, 'true', PREMIUM_CACHE_TTL);
      this.logger.log(`User ${user.id} Stripe subscription renewed`);
    } else {
      // canceled, incomplete, past_due, unpaid
      await this.userRepository.update(user.id, {
        subscriptionTier: SubscriptionTier.FREE,
      });
      await this.cacheManager.del(`premium:${user.id}`);
      this.logger.log(`User ${user.id} Stripe subscription ended (${subscription.status})`);
    }
  }

  private async handleStripePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const user = await this.userRepository.findOne({
      where: { stripeCustomerId: customerId },
      select: ['id'],
    });

    if (!user) {
      this.logger.error(`Stripe payment failed for unknown customer: ${customerId}`);
      return;
    }

    this.logger.warn(`Stripe payment failed for user ${user.id}, invoice: ${invoice.id}`);
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
