import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * V186 (Invariant 40): RevenueCat webhook idempotency table.
 *
 * Why this exists:
 *   V185 reproduced the CATASTROPHIC scenario where a single user could
 *   simultaneously have BOTH yearly + monthly subscriptions active. The
 *   RCA (V185 보고 이슈 1) traced this to RevenueCat retrying the same
 *   webhook event (network NACK, replay, or backend 5xx retry) and the
 *   `handleRevenueCatEvent` handler having no idempotency key — every
 *   replay re-applied the entitlement, and when two near-simultaneous
 *   product purchases (yearly then monthly) generated separate INITIAL_
 *   PURCHASE events, both were processed without dedup. Result: Google
 *   Play charged BOTH transactions, server DB had only the last write,
 *   alias chain remained polluted.
 *
 * How this fixes it:
 *   Every incoming webhook event is INSERT ON CONFLICT DO NOTHING into
 *   this table BEFORE any business logic runs. If the row already exists
 *   (the event was processed before), the handler returns immediately.
 *   This makes the operation physically idempotent at the database level
 *   regardless of how many times RevenueCat retries.
 *
 * TTL:
 *   Rows are purged after 30 days via a cron job (admin.service.ts).
 *   This bounds table size while still catching late retries.
 */
@Entity('processed_webhook_events')
@Index(['processedAt'])
export class ProcessedWebhookEvent {
  /**
   * RevenueCat event.id (UUID format). Unique across all RC webhooks.
   * For Paddle (web) we use the same column with a 'pdl_' prefix to
   * distinguish, though Paddle service is currently discontinued.
   */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  eventId: string;

  /**
   * Source identifier — 'rc' (RevenueCat) | 'pdl' (Paddle, deprecated)
   * | 'gp' (future Google Play Developer API direct).
   */
  @Column({ type: 'varchar', length: 8 })
  source: string;

  /**
   * RC event type (INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.) for
   * audit / Sentry breadcrumb purposes. Not used for dedup.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  eventType: string | null;

  /**
   * Resolved internal user ID at processing time (nullable because we
   * may receive webhooks for users we cannot resolve — e.g. RC anonymous
   * appUserID before backend mapping). Helps with audit.
   */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /**
   * Indexed timestamp for the 30-day TTL purge cron.
   */
  @CreateDateColumn()
  processedAt: Date;
}
