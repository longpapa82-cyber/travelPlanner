import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { User, AuthProvider } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { t } from '../common/i18n';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    const user = this.userRepository.create({
      email: data.email,
      passwordHash: data.password
        ? await bcrypt.hash(data.password, 12)
        : undefined,
      name: data.name,
      provider: data.provider,
      providerId: data.providerId,
      profileImage: data.profileImage,
      isEmailVerified: data.isEmailVerified ?? false,
    });

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
        'id', 'email', 'name', 'provider', 'profileImage', 'role',
        'isEmailVerified', 'isTwoFactorEnabled',
        'subscriptionTier', 'subscriptionExpiresAt', 'aiTripsUsedThisMonth',
        'travelPreferences', 'followersCount', 'followingCount',
        'createdAt', 'updatedAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findPublicProfile(id: string): Promise<Pick<User, 'id' | 'name' | 'profileImage' | 'followersCount' | 'followingCount' | 'createdAt'>> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'name', 'profileImage', 'followersCount', 'followingCount', 'createdAt'],
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
    return this.userRepository.findOne({
      where: { provider, providerId },
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    lang: 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' = 'ko',
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
    await this.cacheManager.set(`deleted_user:${id}`, '1', 30 * 24 * 60 * 60 * 1000);
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      })
      .where('id = :id', { id: userId })
      .execute();

    return token;
  }

  async verifyEmail(
    token: string,
    lang: 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' = 'ko',
  ): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationToken')
      .where('user.emailVerificationToken = :token', { token })
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

    return this.findById(user.id);
  }

  async generatePasswordResetToken(
    email: string,
    lang: 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' = 'ko',
  ): Promise<{ token: string; user: User } | null> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      return null; // Don't reveal if email exists
    }

    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(t('password.reset.socialNotAllowed', lang));
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      })
      .where('id = :id', { id: user.id })
      .execute();

    return { token, user };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    lang: 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' = 'ko',
  ): Promise<User> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetToken')
      .where('user.passwordResetToken = :token', { token })
      .getOne();

    if (!user) {
      throw new BadRequestException(t('password.reset.invalid', lang));
    }

    if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
      throw new BadRequestException(t('password.reset.expired', lang));
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(user.id, {
      passwordHash: newHash,
      passwordResetToken: undefined,
      passwordResetExpiry: undefined,
    });

    return this.findById(user.id);
  }

  // ============ Travel Preferences ============

  async updateTravelPreferences(
    userId: string,
    preferences: { budget?: string; travelStyle?: string; interests?: string[] },
  ): Promise<User> {
    await this.userRepository.update(userId, { travelPreferences: preferences });
    return this.findById(userId);
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
      `SELECT es.id, es.title, es."totalAmount", es.currency, es."splitMethod",
              es."createdAt", t.destination as "tripDestination"
       FROM expense_splits es
       JOIN trips t ON es."tripId" = t.id
       WHERE t."userId" = $1
       ORDER BY es."createdAt" DESC`,
      [userId],
    );

    // Collect notifications
    const notifications = await this.dataSource.query(
      `SELECT id, type, title, body, "isRead", "createdAt"
       FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId],
    );

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
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      trips,
      expenses,
      notifications,
    };
  }
}
