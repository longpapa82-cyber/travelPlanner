import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, SubscriptionTier } from '../users/entities/user.entity';

/**
 * Stripe Service
 *
 * Handles Stripe API interactions and webhook event processing.
 * Syncs subscription status from Stripe to the database.
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia', // Use latest API version
    });
  }

  /**
   * Construct and verify Stripe webhook event
   */
  async constructEvent(
    payload: Buffer | string,
    signature: string,
  ): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    console.log(`[Stripe] Webhook event received: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle subscription created/updated
   */
  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      console.warn('[Stripe] Subscription missing userId metadata:', subscription.id);
      return;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      console.warn('[Stripe] User not found:', userId);
      return;
    }

    // Update subscription status
    user.subscriptionTier = subscription.status === 'active' ? SubscriptionTier.PREMIUM : SubscriptionTier.FREE;
    user.subscriptionExpiresAt = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : undefined;
    user.stripeCustomerId = subscription.customer as string;
    user.stripeSubscriptionId = subscription.id;

    await this.userRepository.save(user);

    console.log(`[Stripe] User ${user.id} subscription updated:`, {
      tier: user.subscriptionTier,
      expiresAt: user.subscriptionExpiresAt,
    });
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    user.subscriptionTier = SubscriptionTier.FREE;
    user.subscriptionExpiresAt = undefined;

    await this.userRepository.save(user);

    console.log(`[Stripe] User ${user.id} subscription cancelled`);
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    console.log(`[Stripe] Payment succeeded for invoice: ${invoice.id}`);
    // Optionally send receipt email or update payment history
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.warn(`[Stripe] Payment failed for invoice: ${invoice.id}`);
    // Optionally send notification to user
  }

  /**
   * Create Stripe Checkout Session for web purchases
   */
  async createCheckoutSession(
    priceId: string,
    userId: string,
    email: string,
  ): Promise<Stripe.Checkout.Session> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${this.configService.get('FRONTEND_URL')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/subscription`,
      customer_email: email,
      client_reference_id: userId,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
    });

    return session;
  }

  /**
   * Get Stripe customer portal URL for subscription management
   */
  async createCustomerPortalSession(customerId: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.configService.get('FRONTEND_URL')}/subscription`,
    });

    return session.url;
  }
}
