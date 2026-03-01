import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { RevenueCatWebhookDto } from './dto/revenuecat-webhook.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.getSubscriptionStatus(user.id);
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async restore(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.restoreSubscription(user.id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() dto: RevenueCatWebhookDto,
    @Headers('authorization') authHeader: string,
  ) {
    // Verify webhook secret — mandatory in production
    const webhookSecret = this.configService.get<string>(
      'REVENUECAT_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('REVENUECAT_WEBHOOK_SECRET not configured in production');
        throw new InternalServerErrorException('Webhook not configured');
      }
      this.logger.warn('RevenueCat webhook: no secret configured, skipping auth');
    } else {
      const expectedAuth = `Bearer ${webhookSecret}`;
      if (authHeader !== expectedAuth) {
        this.logger.warn('RevenueCat webhook: invalid authorization header');
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    await this.subscriptionService.handleRevenueCatEvent(dto.event);
    return { received: true };
  }

  // ─── Stripe Web Payments ───────────────────────────────

  @Post('stripe/checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createStripeCheckout(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.subscriptionService.createStripeCheckoutSession(
      user.id,
      dto.plan,
    );
  }

  @Post('stripe/portal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createStripePortal(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.createStripePortalSession(user.id);
  }

  @Post('stripe/webhook')
  @Throttle({ short: { ttl: 60000, limit: 100 } })
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: { rawBody: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing payload or signature');
    }
    await this.subscriptionService.handleStripeWebhook(req.rawBody, signature);
    return { received: true };
  }
}
