import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { ConsentType } from './user-consent.entity';

/**
 * Actions that can be performed on consents
 */
export enum ConsentAction {
  GRANT = 'grant',     // 동의 부여
  REVOKE = 'revoke',   // 동의 철회
  UPDATE = 'update',   // 동의 업데이트 (버전 변경)
}

/**
 * Audit log for consent changes
 * Required for GDPR/CCPA compliance and user data subject access requests
 */
@Entity('consent_audit_logs')
@Index(['userId', 'createdAt'])
@Index(['consentType'])
export class ConsentAuditLog {
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
    enum: ConsentAction,
  })
  action: ConsentAction;

  @Column({
    type: 'enum',
    enum: ConsentType,
  })
  @Index()
  consentType: ConsentType;

  @Column({ type: 'jsonb', nullable: true })
  previousState?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newState?: Record<string, any>;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  createdAt: Date;
}
