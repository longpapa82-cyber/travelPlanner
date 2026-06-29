import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Channel a generated marketing post was published through.
 * - SELF_BLOG: fully-automatic static HTML on mytravel-planner.com/blog
 * - NAVER_DRAFT: semi-automatic email draft the operator pastes into Naver by hand
 */
export enum ViralPostChannel {
  SELF_BLOG = 'self_blog',
  NAVER_DRAFT = 'naver_draft',
}

/**
 * Per-channel outcome of a daily marketing run.
 * - PUBLISHED: self-blog HTML written + index/sitemap updated
 * - DRAFTED: Naver draft email sent successfully
 * - FAILED: the channel's step threw (errorMessage holds the reason)
 */
export enum ViralPostStatus {
  PUBLISHED = 'published',
  DRAFTED = 'drafted',
  FAILED = 'failed',
}

/**
 * Audit trail + dedup source for the daily viral-marketing automation.
 *
 * One row is written per channel per run (a self_blog row and a naver_draft
 * row share the same scenarioKey), so the table both records every output and
 * drives the 30-day no-reuse scenario dedup. Even FAILED attempts reserve the
 * scenarioKey for 30 days to prevent a retry-storm re-picking the same combo.
 *
 * NOTE: production runs with TypeORM synchronize=false; this table is created
 * by migration `CreateViralPosts...`. In dev synchronize auto-creates it.
 */
@Entity('viral_posts')
@Index(['scenarioKey', 'createdAt'])
@Index(['createdAt'])
export class ViralPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable dedup key built from the six scenario dimensions (lower/trim, '|'-joined). */
  @Index()
  @Column({ type: 'varchar', length: 255 })
  scenarioKey: string;

  @Column({ type: 'varchar', length: 120 })
  destination: string;

  @Column({ type: 'varchar', length: 60 })
  travelType: string;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ type: 'varchar', length: 60 })
  persona: string;

  @Column({ type: 'varchar', length: 60 })
  emphasis: string;

  @Column({ type: 'varchar', length: 60 })
  structure: string;

  @Column({ type: 'enum', enum: ViralPostChannel })
  channel: ViralPostChannel;

  @Column({ type: 'enum', enum: ViralPostStatus })
  status: ViralPostStatus;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** null for naver_draft rows (only self-blog produces a URL slug). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  slug: string | null;

  /** Canonical self-blog URL (null for naver_draft rows / failures). */
  @Column({ type: 'text', nullable: true })
  url: string | null;

  /** Convenience flags for quick audit filtering, kept in sync with status. */
  @Column({ type: 'boolean', default: false })
  selfBlogPublished: boolean;

  @Column({ type: 'boolean', default: false })
  naverEmailSent: boolean;

  /** Content language. Always 'ko' for now; column kept for future i18n. */
  @Column({ type: 'varchar', length: 8, default: 'ko' })
  language: string;

  /** Populated only when status = FAILED. */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
