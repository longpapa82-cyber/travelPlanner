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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AppleAuthGuard } from './guards/apple-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
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

  // Google OAuth
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.oauthLogin(req.user);
    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL || 'exp://localhost:8081'}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    res.redirect(redirectUrl);
  }

  // Apple OAuth
  @Get('apple')
  @UseGuards(AppleAuthGuard)
  async appleAuth() {
    // Guard redirects to Apple
  }

  @Get('apple/callback')
  @UseGuards(AppleAuthGuard)
  async appleAuthCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.oauthLogin(req.user);
    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL || 'exp://localhost:8081'}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    res.redirect(redirectUrl);
  }

  // Kakao OAuth
  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  async kakaoAuth() {
    // Guard redirects to Kakao
  }

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoAuthCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.oauthLogin(req.user);
    // Redirect to frontend with tokens
    const redirectUrl = `${process.env.FRONTEND_URL || 'exp://localhost:8081'}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    res.redirect(redirectUrl);
  }
}
