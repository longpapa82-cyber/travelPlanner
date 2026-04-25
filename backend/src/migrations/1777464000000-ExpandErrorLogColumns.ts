import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V174 (P1): ErrorLog schema expansion for higher-signal triage.
 *
 * Current schema can tell us WHEN and WHAT MESSAGE but leaves the
 * ENVIRONMENT and CONTEXT of a failure nearly blank — exactly the gap
 * called out in V173 feedback ("오류 로그 내용이 원인 진단에 불충분").
 *
 * New columns:
 *   - errorName      error constructor/class (AxiosError, TypeError, ...)
 *   - routeName      React Navigation route or server controller path
 *   - breadcrumbs    Sentry-format JSONB, last ~10 events before failure
 *   - httpStatus     promoted out of errorMessage string for filtering
 *   - deviceModel    OEM-level signal (V159-style Samsung-only bugs)
 *
 * All nullable, no default values — historic rows simply lack the
 * fields. The migration is idempotent so it can be re-run safely on
 * environments where TypeORM `synchronize:true` already auto-applied
 * the column additions.
 */
export class ExpandErrorLogColumns1777464000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "error_logs"
      ADD COLUMN IF NOT EXISTS "errorName" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "routeName" VARCHAR(150),
      ADD COLUMN IF NOT EXISTS "breadcrumbs" JSONB,
      ADD COLUMN IF NOT EXISTS "httpStatus" INT,
      ADD COLUMN IF NOT EXISTS "deviceModel" VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "error_logs"
      DROP COLUMN IF EXISTS "errorName",
      DROP COLUMN IF EXISTS "routeName",
      DROP COLUMN IF EXISTS "breadcrumbs",
      DROP COLUMN IF EXISTS "httpStatus",
      DROP COLUMN IF EXISTS "deviceModel"
    `);
  }
}
