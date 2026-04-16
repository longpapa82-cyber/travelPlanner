import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { User, AuthProvider, SubscriptionTier } from './entities/user.entity';
import {
  UserConsent,
  ConsentType,
  ConsentMethod,
  LegalBasis,
} from './entities/user-consent.entity';
import {
  ConsentAuditLog,
  ConsentAction,
} from './entities/consent-audit-log.entity';
import {
  UpdateConsentsDto,
  ConsentsStatusDto,
  ConsentResponseDto,
} from './dto/consent.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { t, SupportedLang } from '../common/i18n';

// Max email verification code attempts before the code is invalidated and
// the user must request a new one. Kept as a named constant so the
// "remaining attempts" message stays in sync with the enforcement check.
const MAX_EMAIL_VERIFICATION_ATTEMPTS = 5;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,
    @InjectRepository(ConsentAuditLog)
    private readonly auditLogRepository: Repository<ConsentAuditLog>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(data: {
    email?: string;
    password?: string;
    name: string;
    provider: AuthProvider;
    providerId?: string;
    profileImage?: string;
    isEmailVerified?: boolean;
  }): Promise<User> {
    const userData: Partial<User> = {
      email: data.email,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 12)
        : undefined,
      name: data.name,
      provider: data.provider,
      providerId: data.providerId,
      profileImage: data.profileImage,
      isEmailVerified: data.isEmailVerified ?? false,
      // Initialize AI trip count and subscription fields explicitly
      aiTripsUsedThisMonth: 0,
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionExpiresAt: undefined,
    };

    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  /**
   * Refresh an existing **unverified** EMAIL-provider registration row so the
   * user can re-attempt signup without hitting "email already exists".
   *
   * Safety contract (caller MUST verify before calling):
   * - `existing.provider === AuthProvider.EMAIL`
   * - `existing.isEmailVerified === false`
   *
   * Effects:
   * - re-hashes the new password (bcrypt cost 12, same as `create()`)
   * - replaces the display name
   * - clears any in-flight verification code so the next `send-verification-code`
   *   issues a fresh one (prevents a stale code from a previous attempt being
   *   redeemed on the new registration)
   */
  async refreshUnverifiedRegistration(
    existing: User,
    data: { password: string; name: string },
  ): Promise<User> {
    if (existing.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(
        'refreshUnverifiedRegistration called on non-EMAIL provider',
      );
    }
    if (existing.isEmailVerified) {
      throw new BadRequestException(
        'refreshUnverifiedRegistration called on already-verified user',
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    await this.userRepository.update(existing.id, {
      passwordHash,
      name: data.name,
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
      emailVerificationAttempts: 0,
      lastVerificationSentAt: undefined,
    });

    return this.findById(existing.id);
  }

  /**
   * V115 (V114-8): Hard-delete an unverified EMAIL user so the caller can
   * start a brand-new registration. Caller (AuthService.registerForce) is
   * responsible for rate limiting and verifying the `confirmReset` flag.
   *
   * Safety: only deletes rows that are provably EMAIL + unverified. Any
   * attempt to delete a verified or social-provider row is rejected.
   */
  async hardDeleteUnverifiedUser(userId: string): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!existing) return;
    if (existing.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(
        'hardDeleteUnverifiedUser called on non-EMAIL provider',
      );
    }
    if (existing.isEmailVerified) {
      throw new BadRequestException(
        'hardDeleteUnverifiedUser called on already-verified user',
      );
    }
    await this.userRepository.delete(userId);
    this.logger.log(`hardDeleteUnverifiedUser: deleted user ${userId}`);
  }

  /**
   * Hourly cleanup of abandoned email-registration rows.
   *
   * A user can start signup (INSERT row), fail to verify, and walk away.
   * Without cleanup, the row blocks re-registration forever AND occupies
   * the email unique index. `refreshUnverifiedRegistration` handles the
   * re-entry case, but a second user who happens to hit the same email
   * is still blocked until the orphan is removed.
   *
   * Policy: delete rows where `provider=EMAIL`, `isEmailVerified=false`,
   * and `createdAt < now - 24h`. 24h is the same window used by the
   * verification token expiry, so anything older is definitively expired.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupUnverifiedRegistrations(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const result = await this.userRepository
        .createQueryBuilder()
        .delete()
        .from(User)
        .where('provider = :provider', { provider: AuthProvider.EMAIL })
        .andWhere('"isEmailVerified" = false')
        .andWhere('"createdAt" < :cutoff', { cutoff })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `cleanupUnverifiedRegistrations: deleted ${result.affected} abandoned rows`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`cleanupUnverifiedRegistrations failed: ${message}`);
    }
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findProfileById(id: string): Promise<Partial<User>> {
    if (!id) return null as any;
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'name',
        'provider',
        'profileImage',
        'role',
        'isEmailVerified',
        'isTwoFactorEnabled',
        'subscriptionTier',
        'subscriptionPlatform',
        'subscriptionExpiresAt',
        'subscriptionStartedAt',
        'subscriptionPlanType',
        'aiTripsUsedThisMonth',
        'travelPreferences',
        'followersCount',
        'followingCount',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findPublicProfile(
    id: string,
  ): Promise<
    Pick<
      User,
      | 'id'
      | 'name'
      | 'profileImage'
      | 'followersCount'
      | 'followingCount'
      | 'createdAt'
    >
  > {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'profileImage',
        'followersCount',
        'followingCount',
        'createdAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByProviderAndId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.providerId')
      .where('user.provider = :provider', { provider })
      .andWhere('user.providerId = :providerId', { providerId })
      .getOne();
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  async update(id: string, data: Partial<User>): Promise<Partial<User>> {
    await this.userRepository.update(id, data);
    return this.findProfileById(id);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    lang:
      | 'ko'
      | 'en'
      | 'ja'
      | 'zh'
      | 'es'
      | 'de'
      | 'fr'
      | 'th'
      | 'vi'
      | 'pt'
      | 'ar'
      | 'id'
      | 'hi'
      | 'it'
      | 'ru'
      | 'tr'
      | 'ms' = 'ko',
  ): Promise<{ message: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.passwordHash) {
      throw new BadRequestException(t('password.socialNotAllowed', lang));
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException(t('password.currentInvalid', lang));
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(id, { passwordHash: newHash });

    // Invalidate every refresh token issued before this moment. The refresh
    // flow rejects tokens whose `iat` predates this timestamp, so an attacker
    // holding a leaked refresh token loses access the moment the victim
    // rotates their password. Key outlives the longest refresh TTL (30 days).
    const passwordChangedAt = Math.floor(Date.now() / 1000);
    await this.cacheManager.set(
      `pwd_changed:${id}`,
      String(passwordChangedAt),
      31 * 24 * 60 * 60 * 1000,
    );

    return { message: t('password.changed', lang) };
  }

  async remove(id: string, password?: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'provider', 'passwordHash'],
    });
    if (!user) throw new NotFoundException('User not found');

    // Email users must re-authenticate with password
    if (user.provider === AuthProvider.EMAIL) {
      if (!password) {
        throw new BadRequestException(
          '계정 삭제를 위해 비밀번호를 입력해주세요.',
        );
      }
      if (!user.passwordHash) {
        throw new BadRequestException('비밀번호가 설정되지 않은 계정입니다.');
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new BadRequestException('비밀번호가 올바르지 않습니다.');
      }
    }

    await this.userRepository.delete(id);

    // Blacklist deleted user for 30 days so refresh tokens cannot mint new access tokens
    await this.cacheManager.set(
      `deleted_user:${id}`,
      '1',
      30 * 24 * 60 * 60 * 1000,
    );
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    // Generate random token (sent to user via email)
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token before storing in database (SHA-256 for security)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        emailVerificationToken: tokenHash, // Store hashed token
        emailVerificationExpiry: expiry,
      })
      .where('id = :id', { id: userId })
      .execute();

    return token; // Return plain token for email
  }

  /**
   * Generate a 6-digit verification code for mobile-first email verification.
   * Code is hashed before storage (SHA-256). Expires in 10 minutes.
   */
  async generateEmailVerificationCode(userId: string): Promise<string> {
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        emailVerificationToken: codeHash,
        emailVerificationExpiry: expiry,
        emailVerificationAttempts: 0,
        lastVerificationSentAt: new Date(),
      })
      .where('id = :id', { id: userId })
      .execute();

    return code;
  }

  /**
   * Verify a 6-digit code. Max 5 attempts per code.
   */
  async verifyEmailCode(
    userId: string,
    code: string,
    lang: SupportedLang = 'ko',
  ): Promise<Partial<User>> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationToken')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new BadRequestException(t('email.verification.invalid', lang));
    }

    if (user.isEmailVerified) {
      return this.findProfileById(user.id);
    }

    // Check attempts
    if (user.emailVerificationAttempts >= MAX_EMAIL_VERIFICATION_ATTEMPTS) {
      throw new BadRequestException(
        t('email.verification.tooManyAttempts', lang),
      );
    }

    // Check expiry
    if (
      !user.emailVerificationExpiry ||
      user.emailVerificationExpiry < new Date()
    ) {
      throw new BadRequestException(t('email.verification.expired', lang));
    }

    // Compare hashed code
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.emailVerificationToken) {
      await this.userRepository.increment(
        { id: userId },
        'emailVerificationAttempts',
        1,
      );
      // user.emailVerificationAttempts is the value BEFORE the increment above.
      // After this failure the persisted attempts = old + 1, so remaining
      // attempts = MAX - (old + 1) = MAX - old - 1.
      const remaining =
        MAX_EMAIL_VERIFICATION_ATTEMPTS - user.emailVerificationAttempts - 1;
      throw new BadRequestException(
        remaining > 0
          ? t('email.verification.invalidWithRemaining', lang, { remaining })
          : t('email.verification.invalid', lang),
      );
    }

    // Success
    await this.userRepository.update(userId, {
      isEmailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
      emailVerificationAttempts: 0,
    });

    return this.findProfileById(userId);
  }

  /**
   * Check if resend is allowed (60s cooldown)
   */
  async canResendVerificationCode(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'lastVerificationSentAt'],
    });
    if (!user?.lastVerificationSentAt) return true;
    return Date.now() - user.lastVerificationSentAt.getTime() >= 60000;
  }

  async verifyEmail(
    token: string,
    lang:
      | 'ko'
      | 'en'
      | 'ja'
      | 'zh'
      | 'es'
      | 'de'
      | 'fr'
      | 'th'
      | 'vi'
      | 'pt'
      | 'ar'
      | 'id'
      | 'hi'
      | 'it'
      | 'ru'
      | 'tr'
      | 'ms' = 'ko',
  ): Promise<Partial<User>> {
    // Hash the input token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationToken')
      .where('user.emailVerificationToken = :tokenHash', { tokenHash })
      .getOne();

    if (!user) {
      throw new BadRequestException(t('email.verification.invalid', lang));
    }

    if (
      user.emailVerificationExpiry &&
      user.emailVerificationExpiry < new Date()
    ) {
      throw new BadRequestException(t('email.verification.expired', lang));
    }

    await this.userRepository.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: undefined,
      emailVerificationExpiry: undefined,
    });

    return this.findProfileById(user.id);
  }

  async generatePasswordResetToken(
    email: string,
    lang:
      | 'ko'
      | 'en'
      | 'ja'
      | 'zh'
      | 'es'
      | 'de'
      | 'fr'
      | 'th'
      | 'vi'
      | 'pt'
      | 'ar'
      | 'id'
      | 'hi'
      | 'it'
      | 'ru'
      | 'tr'
      | 'ms' = 'ko',
  ): Promise<{ token: string; user: User } | null> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      return null; // Don't reveal if email exists
    }

    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(t('password.reset.socialNotAllowed', lang));
    }

    // Generate random token (sent to user via email)
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token before storing in database (SHA-256 for security)
    // This prevents token theft if database is compromised
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        passwordResetToken: tokenHash, // Store hashed token
        passwordResetExpiry: expiry,
        passwordResetAttempts: 0, // Reset counter on new token generation
      })
      .where('id = :id', { id: user.id })
      .execute();

    return { token, user }; // Return plain token for email
  }

  async resetPassword(
    token: string,
    newPassword: string,
    lang:
      | 'ko'
      | 'en'
      | 'ja'
      | 'zh'
      | 'es'
      | 'de'
      | 'fr'
      | 'th'
      | 'vi'
      | 'pt'
      | 'ar'
      | 'id'
      | 'hi'
      | 'it'
      | 'ru'
      | 'tr'
      | 'ms' = 'ko',
  ): Promise<Partial<User>> {
    // Hash the input token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Use transaction to prevent race condition token reuse
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // SELECT FOR UPDATE locks the user row, preventing parallel token reuse
      const user = await queryRunner.manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .addSelect('user.passwordResetToken')
        .addSelect('user.passwordResetAttempts')
        .where('user.passwordResetToken = :tokenHash', { tokenHash })
        .getOne();

      if (!user) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException(t('password.reset.invalid', lang));
      }

      if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException(t('password.reset.expired', lang));
      }

      // Security: Limit password reset attempts to 5 per token
      // This prevents brute-force attacks even with a valid token
      if (user.passwordResetAttempts >= 5) {
        // Invalidate token after too many attempts
        await queryRunner.manager.update(User, user.id, {
          passwordResetToken: undefined,
          passwordResetExpiry: undefined,
          passwordResetAttempts: 0,
        });
        await queryRunner.commitTransaction();
        throw new BadRequestException(
          t('password.reset.too_many_attempts', lang),
        );
      }

      // Increment attempt counter before bcrypt to defend against partial failures
      await queryRunner.manager.increment(
        User,
        { id: user.id },
        'passwordResetAttempts',
        1,
      );

      const newHash = await bcrypt.hash(newPassword, 12);

      // Atomically update password and invalidate token
      await queryRunner.manager.update(User, user.id, {
        passwordHash: newHash,
        passwordResetToken: undefined,
        passwordResetExpiry: undefined,
        passwordResetAttempts: 0, // Reset counter on success
      });

      await queryRunner.commitTransaction();

      return this.findProfileById(user.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============ Travel Preferences ============

  async updateTravelPreferences(
    userId: string,
    preferences: {
      budget?: string;
      travelStyle?: string;
      interests?: string[];
    },
  ): Promise<Partial<User>> {
    await this.userRepository.update(userId, {
      travelPreferences: preferences,
    });
    return this.findProfileById(userId);
  }

  // ============ 2FA Methods ============

  async findByIdWithTwoFactor(id: string): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twoFactorSecret')
      .addSelect('user.twoFactorBackupCodes')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async setTwoFactorSecret(userId: string, secret: string): Promise<void> {
    await this.userRepository.update(userId, { twoFactorSecret: secret });
  }

  async enableTwoFactor(userId: string, backupCodes: string[]): Promise<void> {
    await this.userRepository.update(userId, {
      isTwoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes,
    });
  }

  async disableTwoFactor(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      isTwoFactorEnabled: false,
      twoFactorSecret: undefined,
      twoFactorBackupCodes: undefined,
    });
  }

  async updateBackupCodes(userId: string, codes: string[]): Promise<void> {
    await this.userRepository.update(userId, {
      twoFactorBackupCodes: codes,
    });
  }

  // ============ GDPR Data Export ============

  async exportUserData(userId: string): Promise<Record<string, any>> {
    const user = await this.findById(userId);

    // Collect trips
    const trips = await this.dataSource.query(
      `SELECT id, destination, country, city, "startDate", "endDate",
              "numberOfTravelers", status, preferences, "createdAt", "updatedAt"
       FROM trips WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId],
    );

    // Collect expenses (via trips)
    const expenses = await this.dataSource.query(
      `SELECT e.id, e.description, e.amount, e.currency, e."splitMethod",
              e."createdAt", t.destination as "tripDestination"
       FROM expenses e
       JOIN trips t ON e."tripId" = t.id
       WHERE t."userId" = $1
       ORDER BY e."createdAt" DESC`,
      [userId],
    );

    // Collect notifications
    const notifications = await this.dataSource.query(
      `SELECT id, type, title, body, "isRead", "createdAt"
       FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId],
    );

    // Fetch fields hidden by select:false for GDPR completeness
    const fullUser = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'paddleCustomerId', 'lastPlatform', 'lastUserAgent'],
    });

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        travelPreferences: user.travelPreferences,
        lastPlatform: fullUser?.lastPlatform ?? null,
        lastUserAgent: fullUser?.lastUserAgent ?? null,
        paddleCustomerId: fullUser?.paddleCustomerId ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      trips,
      expenses,
      notifications,
    };
  }

  /**
   * Consent Management - Phase 0b Implementation
   */

  // Current consent versions (centralized configuration)
  private readonly CONSENT_VERSIONS: Record<ConsentType, string> = {
    [ConsentType.TERMS]: '1.0.0',
    [ConsentType.PRIVACY_REQUIRED]: '1.0.0',
    [ConsentType.PRIVACY_OPTIONAL]: '1.0.0',
    [ConsentType.LOCATION]: '1.0.0',
    [ConsentType.NOTIFICATION]: '1.0.0',
    [ConsentType.PHOTO]: '1.0.0',
    [ConsentType.MARKETING]: '1.0.0',
  };

  // Required consent types (must be granted for app usage)
  private readonly REQUIRED_CONSENTS: ConsentType[] = [
    ConsentType.TERMS,
    ConsentType.PRIVACY_REQUIRED,
  ];

  /**
   * V115 (V114-4c fix): Consent types deprecated from the UI. They remain
   * in the DB enum for audit trail purposes (existing user_consents rows
   * are preserved) but are never surfaced in the consent screen, never
   * accepted in updateConsents(), and are filtered out of getConsentsStatus()
   * responses. PRIVACY_OPTIONAL overlapped semantically with PRIVACY_REQUIRED
   * and MARKETING, creating the "duplicate 개인정보 처리방침" UX bug.
   */
  private readonly DEPRECATED_CONSENTS: ConsentType[] = [
    ConsentType.PRIVACY_OPTIONAL,
  ];

  /**
   * Get user's consent status for all consent types
   */
  async getConsentsStatus(userId: string): Promise<ConsentsStatusDto> {
    const user = await this.findById(userId);

    const allConsentTypes = Object.values(ConsentType).filter(
      (type) => !this.DEPRECATED_CONSENTS.includes(type),
    );
    const userConsents = await this.consentRepository.find({
      where: { userId },
    });

    const consentResponses: ConsentResponseDto[] = allConsentTypes.map(
      (type) => {
        const currentVersion = this.CONSENT_VERSIONS[type];
        const userConsent = userConsents.find(
          (c) => c.consentType === type && c.consentVersion === currentVersion,
        );

        const isRequired = this.REQUIRED_CONSENTS.includes(type);
        const requiresUpdate =
          userConsent?.consentVersion !== currentVersion ||
          !userConsent?.isConsented;

        return {
          type,
          version: currentVersion,
          isConsented: userConsent?.isActive() ?? false,
          consentedAt: userConsent?.consentedAt,
          isRequired,
          requiresUpdate,
          description: this.getConsentDescription(type),
          benefits: this.getConsentBenefits(type),
        };
      },
    );

    const needsConsent = consentResponses.some(
      (c) => c.isRequired && !c.isConsented,
    );
    const needsUpdate = consentResponses.some(
      (c) => c.isRequired && c.requiresUpdate,
    );

    return {
      consents: consentResponses,
      needsConsent,
      needsUpdate,
    };
  }

  /**
   * Update user consents (grant/revoke)
   */
  async updateConsents(
    userId: string,
    dto: UpdateConsentsDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.findById(userId);

    for (const consentItem of dto.consents) {
      const { type, isConsented } = consentItem;
      // V115 (V114-4c): silently ignore deprecated consent types — legacy
      // clients or stale state may still try to send them.
      if (this.DEPRECATED_CONSENTS.includes(type)) continue;
      // Always use server-side version to prevent client-side version injection
      const version = this.CONSENT_VERSIONS[type];

      // Find existing consent record
      const existingConsent = await this.consentRepository.findOne({
        where: {
          userId,
          consentType: type,
          consentVersion: version,
        },
      });

      if (existingConsent) {
        // Update existing consent
        const previousState = {
          isConsented: existingConsent.isConsented,
          consentedAt: existingConsent.consentedAt,
          revokedAt: existingConsent.revokedAt,
        };

        existingConsent.isConsented = isConsented;
        existingConsent.consentedAt = isConsented
          ? new Date()
          : existingConsent.consentedAt;
        existingConsent.revokedAt = !isConsented ? new Date() : null;
        existingConsent.ipAddress = ipAddress;
        existingConsent.userAgent = userAgent;

        await this.consentRepository.save(existingConsent);

        // Log audit trail
        await this.logConsentChange({
          userId,
          action: isConsented ? ConsentAction.GRANT : ConsentAction.REVOKE,
          consentType: type,
          previousState,
          newState: {
            isConsented: existingConsent.isConsented,
            consentedAt: existingConsent.consentedAt,
            revokedAt: existingConsent.revokedAt,
          },
          ipAddress,
          userAgent,
        });
      } else {
        // Create new consent record
        const newConsent = this.consentRepository.create({
          userId,
          consentType: type,
          consentVersion: version,
          isConsented,
          consentedAt: isConsented ? new Date() : undefined,
          revokedAt: !isConsented ? new Date() : undefined,
          ipAddress,
          userAgent,
          consentMethod: ConsentMethod.INITIAL,
          legalBasis: this.getLegalBasis(type),
        });

        await this.consentRepository.save(newConsent);

        // Log audit trail
        await this.logConsentChange({
          userId,
          action: isConsented ? ConsentAction.GRANT : ConsentAction.REVOKE,
          consentType: type,
          previousState: null,
          newState: {
            isConsented: newConsent.isConsented,
            consentedAt: newConsent.consentedAt,
            revokedAt: newConsent.revokedAt,
          },
          ipAddress,
          userAgent,
        });
      }
    }
  }

  /**
   * Log consent change for audit trail (GDPR compliance)
   */
  private async logConsentChange(data: {
    userId: string;
    action: ConsentAction;
    consentType: ConsentType;
    previousState?: Record<string, any> | null;
    newState?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      userId: data.userId,
      action: data.action,
      consentType: data.consentType,
      previousState: data.previousState ?? undefined,
      newState: data.newState,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    await this.auditLogRepository.save(auditLog);
  }

  /**
   * Get description for each consent type
   */
  private getConsentDescription(type: ConsentType): string {
    const descriptions: Record<ConsentType, string> = {
      [ConsentType.TERMS]: 'Service Terms of Use',
      [ConsentType.PRIVACY_REQUIRED]: 'Privacy Policy - Required Items',
      [ConsentType.PRIVACY_OPTIONAL]: 'Privacy Policy - Optional Items',
      [ConsentType.LOCATION]: 'Location Information Usage',
      [ConsentType.NOTIFICATION]: 'Push Notification Permission',
      [ConsentType.PHOTO]: 'Photo Access Permission',
      [ConsentType.MARKETING]: 'Marketing Communications',
    };
    return descriptions[type];
  }

  /**
   * Get benefits for each consent type
   */
  private getConsentBenefits(type: ConsentType): string[] {
    const benefits: Record<ConsentType, string[]> = {
      [ConsentType.TERMS]: ['Required for using the service'],
      [ConsentType.PRIVACY_REQUIRED]: [
        'Required for account management and service provision',
      ],
      [ConsentType.PRIVACY_OPTIONAL]: [
        'Improved user experience',
        'Personalized recommendations',
      ],
      [ConsentType.LOCATION]: [
        'Search nearby places',
        'Travel route recommendations',
        'Location-based features',
      ],
      [ConsentType.NOTIFICATION]: [
        'Travel reminders',
        'Sharing notifications',
        'Important updates',
      ],
      [ConsentType.PHOTO]: ['Profile image upload', 'Travel photo sharing'],
      [ConsentType.MARKETING]: [
        'Promotional offers',
        'New feature announcements',
        'Event notifications',
      ],
    };
    return benefits[type];
  }

  /**
   * Determine legal basis for processing (GDPR Article 6)
   */
  private getLegalBasis(type: ConsentType): LegalBasis {
    switch (type) {
      case ConsentType.TERMS:
      case ConsentType.PRIVACY_REQUIRED:
        return LegalBasis.CONTRACT; // Service contract
      case ConsentType.LOCATION:
      case ConsentType.NOTIFICATION:
      case ConsentType.PHOTO:
      case ConsentType.PRIVACY_OPTIONAL:
      case ConsentType.MARKETING:
        return LegalBasis.CONSENT; // Explicit user consent
      default:
        return LegalBasis.CONSENT;
    }
  }
}
