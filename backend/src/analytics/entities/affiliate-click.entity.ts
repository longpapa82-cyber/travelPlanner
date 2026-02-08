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
import { User } from '../../users/entities/user.entity';
import { Trip } from '../../trips/entities/trip.entity';

/**
 * Affiliate Click Entity
 * 제휴 링크 클릭 추적 및 전환 분석
 */
@Entity('affiliate_clicks')
@Index(['provider', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['tripId', 'createdAt'])
export class AffiliateClick {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 제휴 파트너
   * booking | expedia | hotels | airbnb | viator | klook
   */
  @Column({ type: 'varchar', length: 50 })
  @Index()
  provider: string;

  /**
   * 여행 목적지
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  destination?: string;

  /**
   * 체크인 날짜
   */
  @Column({ type: 'date', nullable: true })
  checkIn?: Date;

  /**
   * 체크아웃 날짜
   */
  @Column({ type: 'date', nullable: true })
  checkOut?: Date;

  /**
   * 여행 인원
   */
  @Column({ type: 'int', nullable: true })
  travelers?: number;

  /**
   * 추적 ID (분석용)
   * 예: trip_123, user_456, campaign_abc
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  trackingId?: string;

  /**
   * 생성된 제휴 URL
   */
  @Column({ type: 'text', nullable: true })
  affiliateUrl?: string;

  /**
   * IP 주소 (분석용)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress?: string;

  /**
   * User Agent (분석용)
   */
  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  /**
   * Referrer URL
   */
  @Column({ type: 'text', nullable: true })
  referrer?: string;

  /**
   * 전환 여부
   * 제휴사로부터 전환 정보 수신 시 업데이트
   */
  @Column({ type: 'boolean', default: false })
  @Index()
  converted: boolean;

  /**
   * 전환 일시
   */
  @Column({ type: 'timestamp', nullable: true })
  convertedAt?: Date;

  /**
   * 전환 금액 (USD)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  conversionValue?: number;

  /**
   * 커미션 금액 (USD)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  commission?: number;

  /**
   * 추가 메타데이터 (JSON)
   * 제휴사별 커스텀 데이터
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  /**
   * 연관된 사용자 (선택)
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId?: string;

  /**
   * 연관된 여행 (선택)
   */
  @ManyToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tripId' })
  trip?: Trip;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tripId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
