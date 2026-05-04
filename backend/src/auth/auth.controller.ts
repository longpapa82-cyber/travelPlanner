import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, OAuthUserData } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterForceDto } from './dto/register-force.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ExchangeOAuthCodeDto } from './dto/exchange-oauth-code.dto';
import { VerifyTwoFactorDto, TwoFactorLoginDto } from './dto/two-factor.dto';
import { GoogleIdTokenDto } from './dto/google-id-token.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PendingVerificationGuard } from './guards/pending-verification.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AppleAuthGuard } from './guards/apple-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { parseLang } from '../common/i18n';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('register')
  @Throttle({ medium: { ttl: 60000, limit: 20 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.register(registerDto, parseLang(acceptLanguage));
  }

  // V115 (V114-8 fix): Hard-reset an abandoned unverified registration.
  // The client must echo `confirmReset: true` — enforced structurally by
  // RegisterForceDto's @Equals(true) validator since the global ValidationPipe
  // runs with forbidNonWhitelisted. Rate limited to 1 per 10 minutes per IP
  // to dampen automated probing; service-layer also rejects verified users.
  @Post('register-force')
  @Throttle({ medium: { ttl: 600000, limit: 1 } })
  async registerForce(
    @Body() body: RegisterForceDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const { confirmReset: _ignored, ...registerDto } = body;
    return this.authService.registerForce(
      registerDto as RegisterDto,
      parseLang(acceptLanguage),
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.login(
      loginDto,
      req.headers['user-agent'],
      parseLang(acceptLanguage),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  // Email Verification
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.verifyEmail(
      verifyEmailDto.token,
      parseLang(acceptLanguage),
    );
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 2 } })
  async resendVerification(
    @Body() resendDto: ResendVerificationDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.resendVerificationEmail(
      resendDto.email,
      parseLang(acceptLanguage),
    );
  }

  // 6-digit code verification (mobile-first).
  // Accepts resume tokens (scope=pending_verification) from register/login,
  // AND full access tokens (for already-logged-in users changing verification).
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PendingVerificationGuard)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async sendVerificationCode(
    @Req() req: Request,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const userId =
      (req as any).user?.userId ||
      (req as any).user?.id ||
      (req as any).user?.sub;
    return this.authService.sendVerificationCode(
      userId,
      parseLang(acceptLanguage),
    );
  }

  @Post('verify-email-code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PendingVerificationGuard)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async verifyEmailCode(
    @Req() req: Request,
    @Body() body: { code: string },
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const userId =
      (req as any).user?.userId ||
      (req as any).user?.id ||
      (req as any).user?.sub;
    return this.authService.verifyEmailCode(
      userId,
      body.code,
      parseLang(acceptLanguage),
    );
  }

  // Password Reset
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 2 } })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.forgotPassword(
      forgotPasswordDto.email,
      parseLang(acceptLanguage),
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      parseLang(acceptLanguage),
    );
  }

  // Two-Factor Authentication
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async setupTwoFactor(@CurrentUser('userId') userId: string) {
    return this.authService.setupTwoFactor(userId);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async enableTwoFactor(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.authService.enableTwoFactor(userId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async disableTwoFactor(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.authService.disableTwoFactor(userId, dto.code);
  }

  @Post('2fa/regenerate-backup-codes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async regenerateBackupCodes(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.authService.regenerateBackupCodes(userId, dto.code);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async verifyTwoFactor(
    @Req() req: Request,
    @Body() dto: TwoFactorLoginDto,
    @Headers('authorization') auth?: string,
  ) {
    const tempToken = auth?.replace('Bearer ', '') || '';
    return this.authService.verifyTwoFactorLogin(
      tempToken,
      dto.code,
      req.headers['user-agent'],
    );
  }

  // OAuth code exchange — frontend sends temp code, receives JWT tokens
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async exchangeOAuthCode(
    @Body() dto: ExchangeOAuthCodeDto,
    @Req() req: Request,
  ) {
    return this.authService.exchangeOAuthCode(
      dto.code,
      req.headers['user-agent'],
    );
  }

  // Google native Sign-In — mobile app sends ID token directly
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async googleIdTokenLogin(
    @Body() body: GoogleIdTokenDto,
    @Req() req: Request,
  ) {
    return this.authService.verifyGoogleIdToken(
      body.idToken,
      req.headers['user-agent'],
    );
  }

  // Google OAuth
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Req() req: Request & { user: OAuthUserData; session: any },
    @Res() res: Response,
  ) {
    const platform = this.extractAndVerifyOAuthState(req);
    const code = await this.authService.createOAuthTempCode(req.user);
    res.redirect(this.buildOAuthRedirectUrl(platform, code));
  }

  // Apple OAuth
  @Get('apple')
  @UseGuards(AppleAuthGuard)
  async appleAuth() {
    // Guard redirects to Apple
  }

  @Get('apple/callback')
  @UseGuards(AppleAuthGuard)
  async appleAuthCallback(
    @Req() req: Request & { user: OAuthUserData; session: any },
    @Res() res: Response,
  ) {
    const platform = this.extractAndVerifyOAuthState(req);
    const code = await this.authService.createOAuthTempCode(req.user);
    res.redirect(this.buildOAuthRedirectUrl(platform, code));
  }

  // Kakao OAuth
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  async kakaoAuth() {
    // Guard redirects to Kakao
  }

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoAuthCallback(
    @Req() req: Request & { user: OAuthUserData; session: any },
    @Res() res: Response,
  ) {
    const platform = this.extractAndVerifyOAuthState(req);
    const code = await this.authService.createOAuthTempCode(req.user);
    res.redirect(this.buildOAuthRedirectUrl(platform, code));
  }

  /**
   * Decodes the OAuth state parameter and validates the CSRF nonce against the
   * session. Returns the platform string ('ios'|'android'|undefined).
   *
   * State format (base64url): JSON { nonce, platform }
   * Legacy format (plain string): 'ios' | 'android' — accepted for backward
   * compatibility during the rollout window; nonce validation is skipped.
   *
   * Attack scenario guarded against: an attacker initiates their own OAuth flow,
   * copies the authorization code, and crafts a callback request to the victim's
   * session. Without nonce validation the victim's session would be bound to the
   * attacker's identity. With nonce validation the callback is rejected because
   * the attacker cannot read the victim's session-bound nonce.
   */
  private extractAndVerifyOAuthState(
    req: Request & { session?: any },
  ): string | undefined {
    const rawState = req.query?.state as string | undefined;
    if (!rawState) return undefined;

    // Try new format: base64url-encoded JSON { nonce, platform }
    try {
      const decoded = Buffer.from(rawState, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded) as {
        nonce?: string;
        platform?: string;
      };
      if (parsed.nonce && parsed.platform) {
        // Verify nonce against session
        const sessionNonce = req.session?.['oauth_nonce'] as
          | { value: string; expiresAt: number }
          | undefined;
        if (
          sessionNonce &&
          sessionNonce.value === parsed.nonce &&
          Date.now() < sessionNonce.expiresAt
        ) {
          delete req.session['oauth_nonce'];
          return parsed.platform;
        }
        // Nonce mismatch or expired — reject for web flows, allow for mobile
        // (mobile deep-link callbacks arrive without session cookies so nonce
        // verification via session is unavailable; the custom-scheme target
        // already restricts who can receive the callback).
        if (parsed.platform === 'ios' || parsed.platform === 'android') {
          return parsed.platform;
        }
        // Web flow with bad nonce — reject
        return undefined;
      }
    } catch {
      // Not JSON — fall through to legacy plain-string check
    }

    // Legacy format: bare platform string (no nonce) — mobile only
    if (rawState === 'ios' || rawState === 'android') return rawState;
    return undefined;
  }

  /**
   * Builds the OAuth redirect URL based on the originating platform.
   * Mobile apps get the custom scheme so WebBrowser.openAuthSessionAsync dismisses.
   * Web gets the HTTPS frontend URL.
   */
  private buildOAuthRedirectUrl(
    platform: string | undefined,
    code: string,
  ): string {
    if (platform === 'ios' || platform === 'android') {
      const scheme = process.env.APP_SCHEME || 'travelplanner';
      return `${scheme}:///auth/callback?code=${code}`;
    }
    const frontendUrl =
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://mytravel-planner.com'
        : 'http://localhost:8081');
    return `${frontendUrl}/auth/callback?code=${code}`;
  }

  // Push notification token management
  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.notificationsService.registerPushToken(userId, dto.token);
    return { message: 'Push token registered' };
  }

  @Post('push-token/remove')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePushToken(@CurrentUser('userId') userId: string) {
    await this.notificationsService.removePushToken(userId);
  }
}
