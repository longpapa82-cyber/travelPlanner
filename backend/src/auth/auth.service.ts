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
import { randomUUID, randomBytes, createHash } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponse,
  TokenPayload,
} from './interfaces/auth-response.interface';
import { t, SupportedLang } from '../common/i18n';
import { isOperationalAdmin } from '../common/utils/admin-check';
import { getErrorMessage } from '../common/types/request.types';
import { AuditService } from '../admin/audit.service';
import { AuditAction } from '../admin/entities/audit-log.entity';
import { detectPlatform } from '../common/utils/platform-detector';
import {
  AUTH_ERROR_CODES,
  JWT_SCOPE_PENDING_VERIFICATION,
} from './constants/auth-error-codes';

export interface OAuthUserData {
  providerId: string;
  email?: string;
  name: string;
  profileImage?: string;
  provider: 'GOOGLE' | 'APPLE' | 'KAKAO';
}

export interface PendingVerificationResponse {
  // V115 (V114-8 fix): discriminator lets the frontend distinguish between
  // a brand-new signup (`created`) and an in-place refresh of an existing
  // unverified row (`refreshed`). The `refreshed` case warrants a 2-way
  // dialog offering "continue verification" vs "start over" so the user
  // is not left wondering whether their account already exists.
  action: 'created' | 'refreshed';
  user: {
    id: string;
    email: string | null;
    name: string;
    provider: AuthProvider;
    profileImage: string | null;
    isEmailVerified: boolean;
  };
  resumeToken: string;
  requiresEmailVerification: true;
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
  ): Promise<PendingVerificationResponse> {
    // Check if user already exists.
    //
    // Re-entry policy (V112 fix #3):
    // - Verified user OR non-EMAIL provider → reject with EMAIL_EXISTS.
    //   Generic error message prevents account enumeration via provider hints.
    // - Unverified EMAIL row → refresh in place (rehash password, replace
    //   name, clear stale verification code) so a user who abandoned the
    //   verification step can complete signup without being permanently
    //   blocked by their own orphaned row.
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    let user;
    let action: 'created' | 'refreshed';
    if (existingUser) {
      const isUnverifiedEmailAccount =
        existingUser.provider === AuthProvider.EMAIL &&
        !existingUser.isEmailVerified;

      if (!isUnverifiedEmailAccount) {
        throw new BadRequestException({
          code: AUTH_ERROR_CODES.EMAIL_EXISTS,
          message: t('auth.registration.failed', lang),
        });
      }

      user = await this.usersService.refreshUnverifiedRegistration(
        existingUser,
        { password: registerDto.password, name: registerDto.name },
      );
      action = 'refreshed';
    } else {
      user = await this.usersService.create({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        provider: AuthProvider.EMAIL,
      });
      action = 'created';
    }

    // Email verification code is sent by the frontend's EmailVerificationCodeScreen
    // on mount via POST /auth/send-verification-code (requires resumeToken).

    this.auditService
      .log({ userId: user.id, action: AuditAction.REGISTER })
      .catch((err) => {
        this.logger.warn(`Failed to update login metadata: ${err.message}`);
      });

    // Issue a scope-restricted resumeToken instead of full access/refresh tokens.
    // The token is only accepted by PendingVerificationGuard-protected endpoints
    // (send-verification-code, verify-email-code). A full token pair is issued
    // on successful verification.
    const resumeToken = await this.generateResumeToken(user.id, user.email!);

    return {
      action,
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
        isEmailVerified: user.isEmailVerified,
      },
      resumeToken,
      requiresEmailVerification: true,
    };
  }

  /**
   * V115 (V114-8 fix): Hard-delete the existing unverified row and start a
   * fresh registration. Intended for users who abandoned verification and
   * now want to start over instead of resuming. Protected by an explicit
   * `confirmReset` flag and a tight rate limit on the controller.
   *
   * Safety invariants:
   * - Only EMAIL provider + isEmailVerified=false rows may be deleted.
   * - Verified accounts and social-provider accounts always reject with
   *   EMAIL_EXISTS — preventing abuse as an account-takeover vector.
   * - Cascade: trips/consents/subscriptions are ON DELETE CASCADE, but an
   *   unverified row should have none of these attached in practice.
   */
  async registerForce(
    registerDto: RegisterDto,
    lang: SupportedLang = 'ko',
  ): Promise<PendingVerificationResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      const isUnverifiedEmailAccount =
        existingUser.provider === AuthProvider.EMAIL &&
        !existingUser.isEmailVerified;

      if (!isUnverifiedEmailAccount) {
        throw new BadRequestException({
          code: AUTH_ERROR_CODES.EMAIL_EXISTS,
          message: t('auth.registration.failed', lang),
        });
      }

      await this.usersService.hardDeleteUnverifiedUser(existingUser.id);
    }

    // Fall through to the standard register() which will take the `created` path.
    return this.register(registerDto, lang);
  }

  private readonly LOGIN_MAX_ATTEMPTS = 10;
  private readonly LOGIN_LOCKOUT_TTL = 15 * 60 * 1000; // 15 minutes

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    lang: SupportedLang = 'ko',
  ): Promise<AuthResponse | { requiresTwoFactor: true; tempToken: string }> {
    // Check account-level lockout (Redis-based, survives restarts)
    const lockKey = `login_attempts:${loginDto.email}`;
    const attempts = await this.cacheManager.get<number>(lockKey);
    if (
      attempts !== null &&
      attempts !== undefined &&
      attempts >= this.LOGIN_MAX_ATTEMPTS
    ) {
      throw new HttpException(
        {
          code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
          message: t('auth.account.locked', lang),
        },
        HttpStatus.LOCKED,
      );
    }

    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      await this.incrementLoginAttempts(lockKey);
      this.auditService
        .log({
          action: AuditAction.LOGIN_FAILED,
          metadata: { reason: 'user_not_found' },
        })
        .catch(() => {});
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: t('auth.invalid.credentials', lang),
      });
    }

    // Validate password
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(lockKey);
      this.auditService
        .log({
          userId: user.id,
          action: AuditAction.LOGIN_FAILED,
          metadata: { reason: 'invalid_password' },
        })
        .catch(() => {});
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: t('auth.invalid.credentials', lang),
      });
    }

    // Login success — reset attempt counter
    await this.cacheManager.del(lockKey);

    // Block login for unverified email users. Return 401 EMAIL_NOT_VERIFIED
    // with a scope-restricted resumeToken so the client can call
    // send-verification-code / verify-email-code but nothing else.
    if (user.provider === AuthProvider.EMAIL && !user.isEmailVerified) {
      const resumeToken = await this.generateResumeToken(user.id, user.email!);
      throw new HttpException(
        {
          code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
          message: t('email.verification.required', lang),
          resumeToken,
          user: {
            id: user.id,
            email: user.email ?? null,
            name: user.name,
            provider: user.provider,
            profileImage: user.profileImage ?? null,
            isEmailVerified: false,
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Audit log: successful login
    this.auditService
      .log({ userId: user.id, action: AuditAction.LOGIN })
      .catch((err) => {
        this.logger.warn(`Failed to update login metadata: ${err.message}`);
      });

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

    this.updateLoginMetadata(user.id, userAgent);

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
        subscriptionTier: user.subscriptionTier,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        aiTripsUsedThisMonth: user.aiTripsUsedThisMonth,
      },
      ...tokens,
    };
  }

  private async incrementLoginAttempts(lockKey: string): Promise<void> {
    const current = (await this.cacheManager.get<number>(lockKey)) || 0;
    await this.cacheManager.set(lockKey, current + 1, this.LOGIN_LOCKOUT_TTL);
    if (current + 1 >= this.LOGIN_MAX_ATTEMPTS) {
      this.logger.warn(
        `Account locked: ${lockKey.replace(/:[^:]+$/, ':***')} — ${this.LOGIN_MAX_ATTEMPTS} failed attempts`,
      );
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
        const stored = await this.cacheManager.get(`refresh:${payload.jti}`);
        if (!stored) {
          // JTI not found in Redis — either revoked or evicted.
          // Reject to prevent replay attacks with previously-used tokens.
          this.logger.warn(
            `Refresh JTI ${payload.jti} not found in Redis for user ${payload.sub} — rejecting`,
          );
          throw new UnauthorizedException('Refresh token revoked');
        } else {
          // Invalidate old refresh token (one-time use)
          await this.cacheManager.del(`refresh:${payload.jti}`);
        }
      }

      // Reject refresh if account was deleted
      const isDeleted = await this.cacheManager.get(
        `deleted_user:${payload.sub}`,
      );
      if (isDeleted) {
        throw new UnauthorizedException('Account has been deleted');
      }

      // Reject refresh if issued before the user's last password change.
      // `payload.iat` is in seconds since epoch (JWT standard).
      const passwordChangedAtRaw = await this.cacheManager.get<string>(
        `pwd_changed:${payload.sub}`,
      );
      if (passwordChangedAtRaw && payload.iat) {
        const passwordChangedAt = parseInt(passwordChangedAtRaw, 10);
        if (
          Number.isFinite(passwordChangedAt) &&
          payload.iat < passwordChangedAt
        ) {
          this.logger.warn(
            `Refresh token for ${payload.sub} predates password change (iat=${payload.iat}, changed=${passwordChangedAt}) — rejecting`,
          );
          throw new UnauthorizedException(
            'Password was changed — please log in again',
          );
        }
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
      this.auditService
        .log({ userId: payload.sub, action: AuditAction.LOGOUT })
        .catch((err) => {
          this.logger.warn(`Failed to update login metadata: ${err.message}`);
        });
    } catch {
      // Token already expired or invalid — still succeed logout
    }
    return { message: 'Logged out' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    // V174 (P0-3): return isAdmin so the frontend has a single source of
    // truth. Previously the frontend derived isAdmin from a hardcoded
    // ADMIN_EMAILS list that could diverge from backend env — V173's
    // "3/3 표기 + 무제한 생성" mismatch was the visible symptom of that
    // divergence. `isOperationalAdmin` mirrors the quota-bypass check in
    // `trips.service.ts` and the UI flag in `subscription.service.ts`.
    const isAdmin = isOperationalAdmin(user.email, user.role);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      profileImage: user.profileImage,
      isEmailVerified: user.isEmailVerified,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      isAdmin,
      subscriptionTier: user.subscriptionTier,
      subscriptionPlatform: user.subscriptionPlatform,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      subscriptionStartedAt: user.subscriptionStartedAt,
      subscriptionPlanType: user.subscriptionPlanType,
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

  async exchangeOAuthCode(
    code: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const data = await this.cacheManager.get<string>(`oauth:code:${code}`);
    if (!data) {
      throw new UnauthorizedException('Invalid or expired OAuth code');
    }

    // One-time use: delete immediately
    await this.cacheManager.del(`oauth:code:${code}`);

    const oauthUser: OAuthUserData = JSON.parse(data) as OAuthUserData;
    return this.oauthLogin(oauthUser, userAgent);
  }

  async oauthLogin(
    oauthUser: OAuthUserData,
    userAgent?: string,
  ): Promise<AuthResponse> {
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

    this.updateLoginMetadata(user.id, userAgent);

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

  async verifyGoogleIdToken(
    idToken: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const clientId = this.configService.get<string>('oauth.google.clientId');
    const client = new OAuth2Client(clientId);

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Invalid Google ID token');
      }

      const oauthUser: OAuthUserData = {
        providerId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email || 'Google User',
        profileImage: payload.picture,
        provider: 'GOOGLE',
      };

      return this.oauthLogin(oauthUser, userAgent);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(
        `Google ID token verification failed: ${getErrorMessage(error)}`,
      );
      throw new UnauthorizedException('Invalid Google ID token');
    }
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
      // Don't reveal verification status - return same success message
      return { message: t('email.verification.sent', lang) };
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

  /**
   * Send 6-digit verification code to authenticated user's email.
   */
  async sendVerificationCode(
    userId: string,
    lang: SupportedLang = 'ko',
  ): Promise<{ message: string; expiresIn: number }> {
    const user = await this.usersService.findProfileById(userId);
    if (!user || !user.email) {
      throw new BadRequestException(t('email.verification.invalid', lang));
    }
    if (user.isEmailVerified) {
      return { message: t('email.verification.success', lang), expiresIn: 0 };
    }

    // Check cooldown (60s)
    const canResend = await this.usersService.canResendVerificationCode(userId);
    if (!canResend) {
      throw new BadRequestException(t('email.verification.cooldown', lang));
    }

    const code = await this.usersService.generateEmailVerificationCode(userId);
    await this.emailService.sendVerificationCodeEmail(
      user.email!,
      user.name || '',
      code,
      lang,
    );

    return { message: t('email.verification.sent', lang), expiresIn: 600 };
  }

  /**
   * Verify 6-digit code for authenticated user.
   */
  async verifyEmailCode(
    userId: string,
    code: string,
    lang: SupportedLang = 'ko',
  ): Promise<{
    message: string;
    isEmailVerified: boolean;
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string | null;
      name: string;
      provider: AuthProvider;
      profileImage: string | null;
      isEmailVerified: boolean;
    };
  }> {
    await this.usersService.verifyEmailCode(userId, code, lang);

    // V112 Wave 5: once the code is accepted, upgrade the caller from a
    // scope-restricted resume token to a real session. Without this the
    // client would still be holding a pending_verification token that
    // cannot access /auth/me or any other normal endpoint, so it would
    // have to re-enter its password to log in — user-hostile for zero
    // security benefit (the user just proved they control the email).
    const user = await this.usersService.findById(userId);
    const tokens = await this.generateTokens(user.id, user.email!);

    return {
      message: t('email.verification.success', lang),
      isEmailVerified: true,
      ...tokens,
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
        isEmailVerified: user.isEmailVerified,
      },
    };
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
      // Never reveal social login status — always return generic success
      this.logger.warn(`Forgot password failed: ${getErrorMessage(error)}`);
    }

    // Always return success to prevent email enumeration
    return { message: t('password.reset.sent', lang) };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    lang: SupportedLang = 'ko',
  ): Promise<{ message: string }> {
    const user = await this.usersService.resetPassword(
      token,
      newPassword,
      lang,
    );
    if (user?.id) {
      this.auditService
        .log({ userId: user.id, action: AuditAction.PASSWORD_RESET })
        .catch(() => {});
    }
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
    const plainBackupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      plainBackupCodes.push(randomBytes(5).toString('hex').toUpperCase());
    }

    // Store hashed codes (SHA-256 + userId as salt) to protect against DB leaks
    const hashedCodes = plainBackupCodes.map((code) =>
      this.hashBackupCode(code, userId),
    );

    await this.usersService.enableTwoFactor(userId, hashedCodes);
    this.auditService
      .log({ userId, action: AuditAction.TWO_FACTOR_ENABLE })
      .catch((err) => {
        this.logger.warn(`Failed to update login metadata: ${err.message}`);
      });

    return { backupCodes: plainBackupCodes };
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
    this.auditService
      .log({ userId, action: AuditAction.TWO_FACTOR_DISABLE })
      .catch((err) => {
        this.logger.warn(`Failed to update login metadata: ${err.message}`);
      });
    return { message: '2FA disabled' };
  }

  private readonly TFA_MAX_ATTEMPTS = 5;

  async verifyTwoFactorLogin(
    tempToken: string,
    code: string,
    userAgent?: string,
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
    if (
      tfaAttempts !== null &&
      tfaAttempts !== undefined &&
      tfaAttempts >= this.TFA_MAX_ATTEMPTS
    ) {
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
      if (
        backupAttempts !== null &&
        backupAttempts !== undefined &&
        backupAttempts >= 3
      ) {
        throw new HttpException(
          'Backup code verification temporarily locked. Try again in 15 minutes.',
          HttpStatus.LOCKED,
        );
      }

      const codeHash = this.hashBackupCode(code.toUpperCase(), user.id);
      const idx = user.twoFactorBackupCodes.indexOf(codeHash);
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
        const currentBackup =
          (await this.cacheManager.get<number>(backupLockKey)) || 0;
        await this.cacheManager.set(
          backupLockKey,
          currentBackup + 1,
          this.LOGIN_LOCKOUT_TTL,
        );
      }
    }

    if (!isValid) {
      // Track failed TOTP attempts
      const current = (await this.cacheManager.get<number>(tfaLockKey)) || 0;
      await this.cacheManager.set(
        tfaLockKey,
        current + 1,
        this.LOGIN_LOCKOUT_TTL,
      );
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Success — reset 2FA attempt counter
    await this.cacheManager.del(tfaLockKey);

    // Update last login timestamp + platform
    this.updateLoginMetadata(user.id, userAgent);

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

    const plainBackupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      plainBackupCodes.push(randomBytes(5).toString('hex').toUpperCase());
    }

    // Store hashed codes
    const hashedCodes = plainBackupCodes.map((code) =>
      this.hashBackupCode(code, userId),
    );

    await this.usersService.updateBackupCodes(userId, hashedCodes);
    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return { backupCodes: plainBackupCodes };
  }

  private hashBackupCode(code: string, userId: string): string {
    return createHash('sha256')
      .update(code + userId)
      .digest('hex');
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

  /**
   * Issue a short-lived JWT with `scope: 'pending_verification'`.
   *
   * Only PendingVerificationGuard accepts this token. JwtStrategy refuses to
   * validate it for any other endpoint, so a client cannot call e.g. /trips
   * with a resumeToken even if they try.
   *
   * 15 minutes is enough time for the user to receive the email code and
   * enter it, but short enough to bound the risk if the token leaks.
   */
  private async generateResumeToken(
    userId: string,
    email: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
        scope: JWT_SCOPE_PENDING_VERIFICATION,
      },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: '15m',
      },
    );
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

  private updateLoginMetadata(userId: string, userAgent?: string): void {
    this.usersService
      .update(userId, {
        lastLoginAt: new Date(),
        lastPlatform: detectPlatform(userAgent),
        lastUserAgent: userAgent?.slice(0, 500),
      })
      .catch((err) => {
        this.logger.warn(`Failed to update login metadata: ${err.message}`);
      });
  }
}
