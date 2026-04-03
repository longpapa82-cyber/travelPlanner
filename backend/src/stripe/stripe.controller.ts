import { Controller, Post, Req, Res, Headers, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StripeService } from './stripe.service';

/**
 * Stripe Webhook Controller
 *
 * Handles Stripe webhook events for subscription lifecycle:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * Stripe Webhook Endpoint
   * URL: https://mytravel-planner.com/api/stripe/webhook
   *
   * This endpoint receives webhook events from Stripe and syncs subscription status to the database.
   * RevenueCat also sends webhooks to this endpoint when Stripe purchases occur.
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      const event = await this.stripeService.constructEvent(
        req.body,
        signature,
      );

      // Handle the event
      await this.stripeService.handleWebhookEvent(event);

      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Stripe webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  /**
   * Create Stripe Checkout Session (for web purchases)
   * URL: POST /api/stripe/create-checkout-session
   *
   * Body: { priceId: string, userId: string, email: string }
   */
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { priceId, userId, email } = req.body;

    if (!priceId || !userId || !email) {
      throw new BadRequestException('Missing required fields: priceId, userId, email');
    }

    try {
      const session = await this.stripeService.createCheckoutSession(
        priceId,
        userId,
        email,
      );

      res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (err) {
      console.error('Stripe checkout session error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
}
