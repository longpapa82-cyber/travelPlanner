import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple',
  KAKAO = 'kakao',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
}

export enum SubscriptionPlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

@Entity('users')
@Index(['provider', 'providerId'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email?: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash?: string;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    default: AuthProvider.EMAIL,
  })
  provider: AuthProvider;

  @Column({ type: 'varchar', nullable: true, select: false })
  providerId?: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  profileImage?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', nullable: true, select: false })
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiry?: Date;

  @Column({ type: 'int', default: 0 })
  emailVerificationAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lastVerificationSentAt?: Date;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordResetToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpiry?: Date;

  @Column({ type: 'int', default: 0 })
  passwordResetAttempts: number;

  @Column({ default: false })
  isTwoFactorEnabled: boolean;

  @Column({ type: 'varchar', nullable: true, select: false })
  twoFactorSecret?: string;

  @Column({ type: 'simple-array', nullable: true, select: false })
  twoFactorBackupCodes?: string[];

  @Column({ type: 'varchar', nullable: true, select: false })
  pushToken?: string;

  @Column({ type: 'jsonb', nullable: true })
  travelPreferences?: {
    budget?: string;
    travelStyle?: string;
    interests?: string[];
  };

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'varchar', length: 10, nullable: true })
  lastPlatform?: 'web' | 'ios' | 'android';

  @Column({ type: 'text', nullable: true, select: false })
  lastUserAgent?: string;

  @Column({ type: 'int', default: 0 })
  followersCount: number;

  @Column({ type: 'int', default: 0 })
  followingCount: number;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: SubscriptionPlatform,
    nullable: true,
  })
  subscriptionPlatform?: SubscriptionPlatform;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionStartedAt?: Date;

  @Column({ type: 'varchar', length: 16, nullable: true })
  subscriptionPlanType?: 'monthly' | 'yearly';

  @Column({ type: 'varchar', nullable: true, select: false })
  revenuecatAppUserId?: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  paddleCustomerId?: string;

  // Note: stripeCustomerId was migrated to paddleCustomerId in migration 1740400000000
  // stripeSubscriptionId was also removed from the database

  @Column({ type: 'int', default: 0 })
  aiTripsUsedThisMonth: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations will be added later
  // @OneToMany(() => Trip, (trip) => trip.user)
  // trips: Trip[];
}
