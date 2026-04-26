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
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { RevenueCatWebhookDto } from './dto/revenuecat-webhook.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PreflightPurchaseDto } from './dto/preflight-purchase.dto';

@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser('userId') userId: string) {
    return this.subscriptionService.getSubscriptionStatus(userId);
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async restore(@CurrentUser('userId') userId: string) {
    return this.subscriptionService.restoreSubscription(userId);
  }

  /**
   * V186 (Invariant 41): server-authoritative purchase preflight.
   *
   * V185 reproduced the CATASTROPHIC simultaneous yearly + monthly
   * purchase scenario. Root cause: the client-side `resolvePurchaseAction`
   * (PaywallModal) trusted RC SDK's `getCustomerInfo()` for the "is the
   * user already subscribed" check. RC SDK has device-cache + alias chain
   * staleness that the V174~V185 6-cycle of fixes could never fully
   * sanitize.
   *
   * This endpoint shifts the trust boundary: the server is the SINGLE
   * source of truth for "can this user purchase this product right now".
   * The client calls this BEFORE invoking Google Play Billing's
   * `purchasePackage`. If the server says no, the client must NOT proceed.
   *
   * Logic:
   *   - If user is admin → block (admins shouldn't be charged)
   *   - If user.subscriptionTier === 'premium' → block with currentPlan
   *   - Else → allow, with empty activeSkus
   *
   * Future: integrate Google Play Developer API
   * `androidpublisher.purchases.subscriptionsv2.get` to verify against
   * Google's authoritative entitlement record. For now, server tier +
   * planType is sufficient and avoids the RC SDK trust pollution.
   */
  @Post('preflight')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  // V187 P0-B: 10/min/IP limit prevents enumeration and DoS on payment entry.
  // Default global throttle (200/min) is too lax for a checkout-adjacent path.
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async preflight(
    @CurrentUser('userId') userId: string,
    @Body() body: PreflightPurchaseDto,
  ) {
    return this.subscriptionService.preflightPurchase(userId, body?.sku);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() dto: RevenueCatWebhookDto,
    @Headers('authorization') authHeader: string,
  ) {
    // Verify webhook secret — mandatory in production.
    // H-3 rotation schedule: rotate REVENUECAT_WEBHOOK_SECRET every 90 days
    // via RevenueCat Dashboard → Webhooks → edit → regenerate secret, then
    // update the env var on the server before the old secret expires.
    // Next rotation due: 2026-07-25 (set from 2026-04-26 baseline).
    const webhookSecret = this.configService.get<string>(
      'REVENUECAT_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'REVENUECAT_WEBHOOK_SECRET not configured in production',
        );
        throw new InternalServerErrorException('Webhook not configured');
      }
      this.logger.warn(
        'RevenueCat webhook: no secret configured, skipping auth',
      );
    } else {
      const expectedAuth = `Bearer ${webhookSecret}`;
      // Timing-safe comparison prevents token discovery via response-time
      // side channels. Lengths are compared first to avoid crashing on
      // mismatched buffer sizes.
      const a = Buffer.from(authHeader ?? '', 'utf8');
      const b = Buffer.from(expectedAuth, 'utf8');
      const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!valid) {
        this.logger.warn('RevenueCat webhook: invalid authorization header');
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    await this.subscriptionService.handleRevenueCatEvent(dto.event);
    return { received: true };
  }

  // ─── Paddle Web Payments ───────────────────────────────

  @Post('paddle/checkout-config')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPaddleCheckoutConfig(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.subscriptionService.getPaddleCheckoutConfig(userId, dto.plan);
  }

  @Post('paddle/webhook')
  @Throttle({ short: { ttl: 60000, limit: 100 } })
  @HttpCode(HttpStatus.OK)
  async handlePaddleWebhook(
    @Req() req: { rawBody: Buffer },
    @Headers('paddle-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing payload or signature');
    }
    await this.subscriptionService.handlePaddleWebhook(
      req.rawBody.toString('utf-8'),
      signature,
    );
    return { received: true };
  }
}
