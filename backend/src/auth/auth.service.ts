import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { randomUUID, randomBytes } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponse,
  TokenPayload,
} from './interfaces/auth-response.interface';
import { t } from '../common/i18n';
import { getErrorMessage } from '../common/types/request.types';
import { AuditService } from '../admin/audit.service';
import { AuditAction } from '../admin/entities/audit-log.entity';

type SupportedLang = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' | 'it' | 'ru' | 'tr' | 'ms';

export interface OAuthUserData {
  providerId: string;
  email?: string;
  name: string;
  profileImage?: string;
  provider: 'GOOGLE' | 'APPLE' | 'KAKAO';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async register(
    registerDto: RegisterDto,
    lang: SupportedLang = 'ko',
  ): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create new user
    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
      provider: AuthProvider.EMAIL,
    });

    // Send verification email (non-blocking)
    try {
      const token = await this.usersService.generateEmailVerificationToken(
        user.id,
      );
      await this.emailService.sendVerificationEmail(
        user.email!,
        user.name,
        token,
        lang,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send verification email: ${getErrorMessage(error)}`,
      );
    }

    // Audit log: registration
    this.auditService.log({ userId: user.id, action: AuditAction.REGISTER }).catch(() => {});

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id, user.email!);

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    };
  }

  private readonly LOGIN_MAX_ATTEMPTS = 10;
  private readonly LOGIN_LOCKOUT_TTL = 15 * 60 * 1000; // 15 minutes

  async login(
    loginDto: LoginDto,
  ): Promise<AuthResponse | { requiresTwoFactor: true; tempToken: string }> {
    // Check account-level lockout (Redis-based, survives restarts)
    const lockKey = `login_attempts:${loginDto.email}`;
    const attempts = await this.cacheManager.get<number>(lockKey);
    if (attempts !== null && attempts !== undefined && attempts >= this.LOGIN_MAX_ATTEMPTS) {
      throw new HttpException(
        'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
        HttpStatus.LOCKED,
      );
    }

    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      await this.incrementLoginAttempts(lockKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(lockKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Login success — reset attempt counter
    await this.cacheManager.del(lockKey);

    // Audit log: successful login
    this.auditService.log({ userId: user.id, action: AuditAction.LOGIN }).catch(() => {});

    // Check if 2FA is enabled
    if (user.isTwoFactorEnabled) {
      const tempToken = await this.jwtService.signAsync(
        { sub: user.id, type: '2fa-pending' },
        {
          secret: this.configService.get<string>('jwt.secret'),
          expiresIn: '5m',
        },
      );
      return { requiresTwoFactor: true, tempToken };
    }

    // Update last login timestamp
    this.usersService.update(user.id, { lastLoginAt: new Date() }).catch(() => {});

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id, user.email!);

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    };
  }

  private async incrementLoginAttempts(lockKey: string): Promise<void> {
    const current = (await this.cacheManager.get<number>(lockKey)) || 0;
    await this.cacheManager.set(lockKey, current + 1, this.LOGIN_LOCKOUT_TTL);
    if (current + 1 >= this.LOGIN_MAX_ATTEMPTS) {
      this.logger.warn(`Account locked: ${lockKey} — ${this.LOGIN_MAX_ATTEMPTS} failed attempts`);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token with refresh secret
      const payload = await this.jwtService.verifyAsync<
        TokenPayload & { jti?: string }
      >(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      // Check if refresh token has been revoked (rotation check)
      if (payload.jti) {
        const stored = await this.cacheManager.get(
          `refresh:${payload.jti}`,
        );
        if (!stored) {
          // Token was already used or revoked — possible token theft
          this.logger.warn(
            `Revoked refresh token reuse detected for user ${payload.sub}`,
          );
          throw new UnauthorizedException('Refresh token revoked');
        }
        // Invalidate old refresh token (one-time use)
        await this.cacheManager.del(`refresh:${payload.jti}`);
      }

      // Reject refresh if account was deleted
      const isDeleted = await this.cacheManager.get(`deleted_user:${payload.sub}`);
      if (isDeleted) {
        throw new UnauthorizedException('Account has been deleted');
      }

      // Get user to include in response
      const user = await this.usersService.findById(payload.sub);

      // Generate new tokens (with new jti)
      const tokens = await this.generateTokens(payload.sub, payload.email);

      return {
        user: {
          id: user.id,
          email: user.email ?? null,
          name: user.name,
          provider: user.provider,
          profileImage: user.profileImage ?? null,
          isEmailVerified: user.isEmailVerified,
        },
        ...tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<
        TokenPayload & { jti?: string }
      >(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      if (payload.jti) {
        await this.cacheManager.del(`refresh:${payload.jti}`);
      }
      // Audit log: logout
      this.auditService.log({ userId: payload.sub, action: AuditAction.LOGOUT }).catch(() => {});
    } catch {
      // Token already expired or invalid — still succeed logout
    }
    return { message: 'Logged out' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      profileImage: user.profileImage,
      isEmailVerified: user.isEmailVerified,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      subscriptionTier: user.subscriptionTier,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      aiTripsUsedThisMonth: user.aiTripsUsedThisMonth,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async createOAuthTempCode(oauthUser: OAuthUserData): Promise<string> {
    const code = randomUUID();
    await this.cacheManager.set(
      `oauth:code:${code}`,
      JSON.stringify(oauthUser),
      60000, // TTL 60 seconds
    );
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<AuthResponse> {
    const data = await this.cacheManager.get<string>(`oauth:code:${code}`);
    if (!data) {
      throw new UnauthorizedException('Invalid or expired OAuth code');
    }

    // One-time use: delete immediately
    await this.cacheManager.del(`oauth:code:${code}`);

    const oauthUser: OAuthUserData = JSON.parse(data) as OAuthUserData;
    return this.oauthLogin(oauthUser);
  }

  async oauthLogin(oauthUser: OAuthUserData): Promise<AuthResponse> {
    // Map uppercase provider from OAuth strategy to lowercase AuthProvider enum
    const providerMap: Record<string, AuthProvider> = {
      GOOGLE: AuthProvider.GOOGLE,
      APPLE: AuthProvider.APPLE,
      KAKAO: AuthProvider.KAKAO,
    };
    const provider =
      providerMap[oauthUser.provider] ||
      (oauthUser.provider.toLowerCase() as AuthProvider);

    // Check if user exists with this provider ID
    let user = await this.usersService.findByProviderAndId(
      provider,
      oauthUser.providerId,
    );

    if (!user) {
      // Create new user — OAuth users are auto-verified (email proven via provider)
      user = await this.usersService.create({
        email: oauthUser.email,
        name: oauthUser.name,
        provider,
        providerId: oauthUser.providerId,
        profileImage: oauthUser.profileImage,
        isEmailVerified: true,
      });
    }

    // Update last login timestamp
    this.usersService.update(user.id, { lastLoginAt: new Date() }).catch(() => {});

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id, user.email || '');

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
    };
  }

  async verifyEmail(
    token: string,
    lang: SupportedLang = 'ko',
  ): Promise<{ message: string }> {
    await this.usersService.verifyEmail(token, lang);
    return { message: t('email.verification.success', lang) };
  }

  async resendVerificationEmail(
    email: string,
    lang: SupportedLang = 'ko',
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists - return success anyway
      return { message: t('email.verification.sent', lang) };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException(t('email.already.verified', lang));
    }

    const token = await this.usersService.generateEmailVerificationToken(
      user.id,
    );
    await this.emailService.sendVerificationEmail(
      email,
      user.name,
      token,
      lang,
    );

    return { message: t('email.verification.sent', lang) };
  }

  async forgotPassword(
    email: string,
    lang: SupportedLang = 'ko',
  ): Promise<{ message: string }> {
    try {
      const result = await this.usersService.generatePasswordResetToken(
        email,
        lang,
      );
      if (result) {
        await this.emailService.sendPasswordResetEmail(
          email,
          result.user.name,
          result.token,
          lang,
        );
      }
    } catch (error) {
      // If it's a BadRequestException (social login), rethrow
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to process forgot password: ${getErrorMessage(error)}`,
      );
    }

    // Always return success to prevent email enumeration
    return { message: t('password.reset.sent', lang) };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    lang: SupportedLang = 'ko',
  ): Promise<{ message: string }> {
    await this.usersService.resetPassword(token, newPassword, lang);
    return { message: t('password.reset.success', lang) };
  }

  // ============ 2FA Methods ============

  async setupTwoFactor(userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = generateSecret();
    const appName = 'MyTravel';
    const otpauthUrl = generateURI({
      issuer: appName,
      label: user.email || user.id,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not yet enabled)
    await this.usersService.setTwoFactorSecret(userId, secret);

    return { secret, qrCodeDataUrl };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.usersService.findByIdWithTwoFactor(userId);
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Setup 2FA first');
    }

    const result = verifySync({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!result.valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Generate backup codes using CSPRNG
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(randomBytes(5).toString('hex').toUpperCase());
    }

    await this.usersService.enableTwoFactor(userId, backupCodes);
    this.auditService.log({ userId, action: AuditAction.TWO_FACTOR_ENABLE }).catch(() => {});

    return { backupCodes };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.usersService.findByIdWithTwoFactor(userId);
    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const result = verifySync({
      token: code,
      secret: user.twoFactorSecret!,
    });

    if (!result.valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.usersService.disableTwoFactor(userId);
    this.auditService.log({ userId, action: AuditAction.TWO_FACTOR_DISABLE }).catch(() => {});
    return { message: '2FA disabled' };
  }

  private readonly TFA_MAX_ATTEMPTS = 5;

  async verifyTwoFactorLogin(
    tempToken: string,
    code: string,
  ): Promise<AuthResponse> {
    let payload: { sub: string; type: string; email?: string };
    try {
      payload = await this.jwtService.verifyAsync(tempToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.type !== '2fa-pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check 2FA attempt lockout
    const tfaLockKey = `2fa_attempts:${payload.sub}`;
    const tfaAttempts = await this.cacheManager.get<number>(tfaLockKey);
    if (tfaAttempts !== null && tfaAttempts !== undefined && tfaAttempts >= this.TFA_MAX_ATTEMPTS) {
      throw new HttpException(
        '2FA verification temporarily locked. Try again in 15 minutes.',
        HttpStatus.LOCKED,
      );
    }

    const user = await this.usersService.findByIdWithTwoFactor(payload.sub);

    // Try TOTP code first (wrap in try-catch: verifySync throws on non-numeric tokens)
    let isValid = false;
    try {
      const totpResult = verifySync({
        token: code,
        secret: user.twoFactorSecret!,
      });
      isValid = totpResult.valid;
    } catch {
      // Non-numeric code (e.g. backup code) — TOTP check fails, try backup below
    }

    // Try backup code if TOTP fails — separate rate limit from TOTP
    let usedBackupCode = false;
    let remainingBackupCodes = user.twoFactorBackupCodes?.length ?? 0;
    if (!isValid && user.twoFactorBackupCodes) {
      // Check backup code attempt lockout (separate from TOTP)
      const backupLockKey = `2fa_backup_attempts:${payload.sub}`;
      const backupAttempts = await this.cacheManager.get<number>(backupLockKey);
      if (backupAttempts !== null && backupAttempts !== undefined && backupAttempts >= 3) {
        throw new HttpException(
          'Backup code verification temporarily locked. Try again in 15 minutes.',
          HttpStatus.LOCKED,
        );
      }

      const codeUpper = code.toUpperCase();
      const idx = user.twoFactorBackupCodes.indexOf(codeUpper);
      if (idx !== -1) {
        isValid = true;
        usedBackupCode = true;
        const remaining = [...user.twoFactorBackupCodes];
        remaining.splice(idx, 1);
        remainingBackupCodes = remaining.length;
        await this.usersService.updateBackupCodes(user.id, remaining);
        await this.cacheManager.del(backupLockKey);
        this.logger.warn(
          `2FA backup code used for user ${user.id}. Remaining: ${remainingBackupCodes}`,
        );
      } else {
        // Track failed backup code attempts separately
        const currentBackup = (await this.cacheManager.get<number>(backupLockKey)) || 0;
        await this.cacheManager.set(backupLockKey, currentBackup + 1, this.LOGIN_LOCKOUT_TTL);
      }
    }

    if (!isValid) {
      // Track failed TOTP attempts
      const current = (await this.cacheManager.get<number>(tfaLockKey)) || 0;
      await this.cacheManager.set(tfaLockKey, current + 1, this.LOGIN_LOCKOUT_TTL);
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Success — reset 2FA attempt counter
    await this.cacheManager.del(tfaLockKey);

    const tokens = await this.generateTokens(user.id, user.email || '');

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
        isEmailVerified: user.isEmailVerified,
      },
      ...tokens,
      ...(usedBackupCode && { remainingBackupCodes }),
    };
  }

  async regenerateBackupCodes(userId: string, code: string) {
    const user = await this.usersService.findByIdWithTwoFactor(userId);
    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify TOTP code to authorize regeneration
    const result = verifySync({
      token: code,
      secret: user.twoFactorSecret!,
    });

    if (!result.valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(randomBytes(5).toString('hex').toUpperCase());
    }

    await this.usersService.updateBackupCodes(userId, backupCodes);
    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return { backupCodes };
  }

  private async generateTokens(userId: string, email: string) {
    const payload: TokenPayload = { sub: userId, email };
    const jti = randomUUID();

    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '30d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn') as any,
      }),
      this.jwtService.signAsync({ ...payload, jti } as any, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    // Store refresh token jti in Redis for rotation tracking
    const ttlMs = this.parseDurationToMs(refreshExpiresIn);
    await this.cacheManager.set(`refresh:${jti}`, userId, ttlMs);

    return {
      accessToken,
      refreshToken,
    };
  }

  private parseDurationToMs(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30d
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] || multipliers.d);
  }
}
