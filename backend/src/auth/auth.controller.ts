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
import { Request, Response } from 'express';
import { AuthService, OAuthUserData } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ExchangeOAuthCodeDto } from './dto/exchange-oauth-code.dto';
import { VerifyTwoFactorDto, TwoFactorLoginDto } from './dto/two-factor.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
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
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.register(registerDto, parseLang(acceptLanguage));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
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
  async setupTwoFactor(@CurrentUser('userId') userId: string) {
    return this.authService.setupTwoFactor(userId);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(
    @CurrentUser('userId') userId: string,
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.authService.enableTwoFactor(userId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
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
    @Body() dto: TwoFactorLoginDto,
    @Headers('authorization') auth?: string,
  ) {
    const tempToken = auth?.replace('Bearer ', '') || '';
    return this.authService.verifyTwoFactorLogin(tempToken, dto.code);
  }

  // OAuth code exchange — frontend sends temp code, receives JWT tokens
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async exchangeOAuthCode(@Body() dto: ExchangeOAuthCodeDto) {
    return this.authService.exchangeOAuthCode(dto.code);
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
    @Req() req: Request & { user: OAuthUserData },
    @Res() res: Response,
  ) {
    const code = await this.authService.createOAuthTempCode(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'exp://localhost:8081';
    res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
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
    @Req() req: Request & { user: OAuthUserData },
    @Res() res: Response,
  ) {
    const code = await this.authService.createOAuthTempCode(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'exp://localhost:8081';
    res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
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
    @Req() req: Request & { user: OAuthUserData },
    @Res() res: Response,
  ) {
    const code = await this.authService.createOAuthTempCode(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'exp://localhost:8081';
    res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
  }

  // Push notification token management
  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  async registerPushToken(
    @CurrentUser('userId') userId: string,
    @Body('token') token: string,
  ) {
    await this.notificationsService.registerPushToken(userId, token);
    return { message: 'Push token registered' };
  }

  @Post('push-token/remove')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePushToken(@CurrentUser('userId') userId: string) {
    await this.notificationsService.removePushToken(userId);
  }
}
