import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogsAndAnalytics1739700000000 implements MigrationInterface {
  name = 'AddAuditLogsAndAnalytics1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create audit_action enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "audit_logs_action_enum" AS ENUM (
          'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER',
          'PASSWORD_CHANGE', 'PASSWORD_RESET',
          'TWO_FACTOR_ENABLE', 'TWO_FACTOR_DISABLE',
          'ACCOUNT_DELETE', 'DATA_EXPORT',
          'ADMIN_USER_VIEW', 'ADMIN_ERROR_RESOLVE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying,
        "action" "audit_logs_action_enum" NOT NULL,
        "targetType" character varying,
        "targetId" character varying,
        "metadata" jsonb,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create audit_logs indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_userId_createdAt"
      ON "audit_logs" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_createdAt"
      ON "audit_logs" ("action", "createdAt")
    `);

    // Create analytics_events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "platform" character varying(20),
        "properties" jsonb,
        "userId" uuid,
        "clientTimestamp" bigint NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events" PRIMARY KEY ("id")
      )
    `);

    // Create analytics_events indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_analytics_events_name_createdAt"
      ON "analytics_events" ("name", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_analytics_events_userId_createdAt"
      ON "analytics_events" ("userId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_action_enum"`);
  }
}
