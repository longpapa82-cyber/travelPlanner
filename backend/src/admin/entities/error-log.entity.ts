import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('error_logs')
@Index(['createdAt'])
@Index(['severity'])
@Index(['platform'])
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', nullable: true })
  userEmail?: string;

  @Column({ type: 'varchar', length: 500 })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  screen?: string;

  @Column({ type: 'varchar', length: 20, default: 'error' })
  severity: 'error' | 'warning' | 'fatal';

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceOS?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  appVersion?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  platform?: 'web' | 'ios' | 'android';

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
