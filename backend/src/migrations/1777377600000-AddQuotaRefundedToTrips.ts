import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V172 (B-1): Idempotency flag for the AI quota saga.
 *
 * Trips created via AI mode increment `users.aiTripsUsedThisMonth` inside
 * Phase A's transaction (`trips.service.ts` ~L215). When Phase B (external
 * AI call) or Phase C (save) fails, we need to refund that increment without
 * risking double-refunds when multiple failure paths fire (e.g. cancel
 * during Phase C save). The `quotaRefunded` flag is flipped atomically in
 * the same UPDATE that decrements the counter, so concurrent refund
 * attempts are safe.
 *
 * Default false — historic trips are treated as "not refunded" which is
 * accurate (none of them were ever refunded). The application code only
 * touches this column for failed AI trips, so historic successful trips
 * never get inspected.
 */
export class AddQuotaRefundedToTrips1777377600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trips"
      ADD COLUMN IF NOT EXISTS "quotaRefunded" BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "trips"
      DROP COLUMN IF EXISTS "quotaRefunded"
    `);
  }
}
