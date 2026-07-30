import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `lastActiveAt` to `users`.
 *
 * `lastLoginAt` is only updated on full re-authentication (login / OAuth), so
 * long-lived sessions that silently hit `/auth/refresh` look stale in the admin
 * "이용자 현황" list. `lastActiveAt` is updated on refresh too, so the admin view
 * reflects actual recent access.
 *
 * Backfill existing rows from lastLoginAt so pre-existing users don't show empty.
 *
 * Production runs synchronize=false + migrationsRun=true (see database.config.ts),
 * so this migration performs the column add in production. Idempotent
 * (IF NOT EXISTS) — safe to re-run.
 */
export class AddLastActiveAtToUsers1779400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP`,
    );
    // Backfill: existing rows adopt their lastLoginAt as the initial activity time.
    await queryRunner.query(
      `UPDATE "users" SET "lastActiveAt" = "lastLoginAt" WHERE "lastActiveAt" IS NULL AND "lastLoginAt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastActiveAt"`,
    );
  }
}
