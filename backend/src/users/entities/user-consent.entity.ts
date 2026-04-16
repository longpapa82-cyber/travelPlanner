import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Consent types following privacy policy structure
 */
export enum ConsentType {
  TERMS = 'terms',                      // 서비스 이용약관 (필수)
  PRIVACY_REQUIRED = 'privacy_required', // 개인정보 처리방침 필수 항목
  PRIVACY_OPTIONAL = 'privacy_optional', // 개인정보 처리방침 선택 항목
  LOCATION = 'location',                // 위치 정보 이용
  NOTIFICATION = 'notification',        // 알림 수신
  PHOTO = 'photo',                      // 사진 접근
  MARKETING = 'marketing',              // 마케팅 정보 수신 (선택)
  AGE_VERIFICATION = 'age_verification', // 만 14세 이상 확인 (필수)
}

/**
 * How the consent was obtained
 */
export enum ConsentMethod {
  INITIAL = 'initial',     // 회원가입 시 초기 동의
  UPDATE = 'update',       // 정책 변경으로 인한 재동의
  JIT = 'jit',            // Just-in-Time (기능 사용 시점)
  SETTINGS = 'settings',   // 설정 화면에서 변경
}

/**
 * Legal basis for processing personal data (GDPR Article 6)
 */
export enum LegalBasis {
  CONSENT = 'consent',                       // 명시적 동의
  CONTRACT = 'contract',                     // 계약 이행
  LEGITIMATE_INTEREST = 'legitimate_interest', // 정당한 이익
  LEGAL_OBLIGATION = 'legal_obligation',     // 법적 의무
}

@Entity('user_consents')
@Index(['userId', 'consentType', 'consentVersion'], { unique: true })
@Index(['userId', 'consentType', 'isConsented'])
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: ConsentType,
  })
  @Index()
  consentType: ConsentType;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  consentVersion: string;

  @Column({ type: 'boolean', default: false })
  isConsented: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consentedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({
    type: 'enum',
    enum: ConsentMethod,
    nullable: true,
  })
  consentMethod?: ConsentMethod;

  @Column({
    type: 'enum',
    enum: LegalBasis,
    nullable: true,
  })
  legalBasis?: LegalBasis;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  /**
   * Helper method to check if consent is currently active
   */
  isActive(): boolean {
    return this.isConsented && !this.revokedAt;
  }

  /**
   * Helper method to check if consent needs update (new version available)
   */
  needsUpdate(currentVersion: string): boolean {
    return this.consentVersion !== currentVersion;
  }
}
