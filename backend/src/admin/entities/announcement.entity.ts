import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AnnouncementType {
  SYSTEM = 'system',
  FEATURE = 'feature',
  IMPORTANT = 'important',
  PROMOTIONAL = 'promotional',
}

export enum AnnouncementPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

export enum AnnouncementDisplayType {
  BANNER = 'banner',
  MODAL = 'modal',
  BOTTOM_SHEET = 'bottom_sheet',
  NOTIFICATION_ONLY = 'notification_only',
}

export enum AnnouncementTargetAudience {
  ALL = 'all',
  PREMIUM = 'premium',
  FREE = 'free',
}

@Entity('announcements')
@Index(['isActive', 'isPublished', 'startDate', 'endDate'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AnnouncementType,
    default: AnnouncementType.SYSTEM,
  })
  type: AnnouncementType;

  @Column({ type: 'jsonb' })
  title: Record<string, string>; // { ko: '...', en: '...', ... }

  @Column({ type: 'jsonb' })
  content: Record<string, string>;

  @Column({
    type: 'enum',
    enum: AnnouncementTargetAudience,
    default: AnnouncementTargetAudience.ALL,
  })
  targetAudience: AnnouncementTargetAudience;

  @Column({
    type: 'enum',
    enum: AnnouncementPriority,
    default: AnnouncementPriority.NORMAL,
  })
  priority: AnnouncementPriority;

  @Column({
    type: 'enum',
    enum: AnnouncementDisplayType,
    default: AnnouncementDisplayType.BANNER,
  })
  displayType: AnnouncementDisplayType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  actionUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  actionLabel: Record<string, string> | null;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPublished: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
