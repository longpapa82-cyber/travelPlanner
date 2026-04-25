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

  /**
   * V174 (P1): error class/constructor name (e.g. `AxiosError`, `TypeError`,
   * `TimeoutError`). Groups alikes without NLP on `errorMessage`. Cheap to
   * populate from `error.name` on both filter path and client reporter.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  errorName?: string;

  /**
   * V174 (P1): React Navigation `useRoute().name` at the moment of the
   * error on the client, or the request path/controller name on the
   * server. Replaces the V173 hardcoded `screen='ApiInterceptor'` with
   * the actual screen the user was on.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  routeName?: string;

  /**
   * V174 (P1): Last ~10 breadcrumbs leading up to the failure (tap
   * events, nav transitions, key API calls). Persisted as JSONB so admin
   * queries can filter on individual crumbs. Matches Sentry's
   * breadcrumb contract so we can cross-reference without re-ingesting.
   */
  @Column({ type: 'jsonb', nullable: true })
  breadcrumbs?: Array<{
    category?: string;
    message?: string;
    level?: string;
    timestamp?: number;
    data?: Record<string, unknown>;
  }>;

  /**
   * V174 (P1): HTTP status code, promoted out of `errorMessage` so it
   * is index-filterable. `null` for pure client errors that did not
   * originate from an HTTP request.
   */
  @Column({ type: 'int', nullable: true })
  httpStatus?: number;

  /**
   * V174 (P1): Device model string (e.g. "SM-G998N", "iPhone14,5").
   * V159's Samsung-only KAV OOM crash would have been pinpointed
   * immediately with this field.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceModel?: string;

  @CreateDateColumn()
  createdAt: Date;
}
