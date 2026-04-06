import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { User, AuthProvider, SubscriptionTier } from './entities/user.entity';
import { UserConsent, ConsentType, ConsentMethod, LegalBasis } from './entities/user-consent.entity';
import { ConsentAuditLog, ConsentAction } from './entities/consent-audit-log.entity';
import { UpdateConsentsDto, ConsentsStatusDto, ConsentResponseDto } from './dto/consent.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { t } from '../common/i18n';

@Injectable()
export class UsersService {
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

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findProfileById(id: string): Promise<Partial<User>> {
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
        'subscriptionExpiresAt',
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
        throw new BadRequestException('Password required to delete account');
      }
      if (!user.passwordHash) {
        throw new BadRequestException('Account has no password set');
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new BadRequestException('Incorrect password');
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

      // Hash new password (CPU-intensive, but within transaction lock)
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
   * Get user's consent status for all consent types
   */
  async getConsentsStatus(userId: string): Promise<ConsentsStatusDto> {
    const user = await this.findById(userId);

    const allConsentTypes = Object.values(ConsentType);
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
        existingConsent.consentedAt = isConsented ? new Date() : existingConsent.consentedAt;
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
      [ConsentType.PRIVACY_REQUIRED]: ['Required for account management and service provision'],
      [ConsentType.PRIVACY_OPTIONAL]: ['Improved user experience', 'Personalized recommendations'],
      [ConsentType.LOCATION]: ['Search nearby places', 'Travel route recommendations', 'Location-based features'],
      [ConsentType.NOTIFICATION]: ['Travel reminders', 'Sharing notifications', 'Important updates'],
      [ConsentType.PHOTO]: ['Profile image upload', 'Travel photo sharing'],
      [ConsentType.MARKETING]: ['Promotional offers', 'New feature announcements', 'Event notifications'],
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
