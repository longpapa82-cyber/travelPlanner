import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformTracking1740000000000 implements MigrationInterface {
  name = 'AddPlatformTracking1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add platform tracking columns to users
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "lastPlatform" VARCHAR(10),
        ADD COLUMN IF NOT EXISTS "lastUserAgent" TEXT
    `);

    // Add platform tracking columns to error_logs
    await queryRunner.query(`
      ALTER TABLE "error_logs"
        ADD COLUMN IF NOT EXISTS "platform" VARCHAR(10),
        ADD COLUMN IF NOT EXISTS "userAgent" TEXT
    `);

    // Add index on error_logs.platform
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_error_logs_platform" ON "error_logs" ("platform")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_error_logs_platform"`);
    await queryRunner.query(`
      ALTER TABLE "error_logs"
        DROP COLUMN IF EXISTS "userAgent",
        DROP COLUMN IF EXISTS "platform"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "lastUserAgent",
        DROP COLUMN IF EXISTS "lastPlatform"
    `);
  }
}
