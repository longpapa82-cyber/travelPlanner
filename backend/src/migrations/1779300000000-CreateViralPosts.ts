import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `viral_posts` table for the daily viral-marketing automation.
 *
 * Required because production runs with TypeORM synchronize=false (see
 * database.config.ts) and migrationsRun=true. In dev synchronize auto-creates
 * the table from the entity; in production this migration does it. Idempotent
 * (IF NOT EXISTS) so a re-run is safe.
 */
export class CreateViralPosts1779300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "viral_posts_channel_enum" AS ENUM ('self_blog', 'naver_draft');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "viral_posts_status_enum" AS ENUM ('published', 'drafted', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "viral_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scenarioKey" character varying(255) NOT NULL,
        "destination" character varying(120) NOT NULL,
        "travelType" character varying(60) NOT NULL,
        "durationDays" integer NOT NULL,
        "persona" character varying(60) NOT NULL,
        "emphasis" character varying(60) NOT NULL,
        "structure" character varying(60) NOT NULL,
        "channel" "viral_posts_channel_enum" NOT NULL,
        "status" "viral_posts_status_enum" NOT NULL,
        "title" character varying(200) NOT NULL,
        "slug" character varying(200),
        "url" text,
        "selfBlogPublished" boolean NOT NULL DEFAULT false,
        "naverEmailSent" boolean NOT NULL DEFAULT false,
        "language" character varying(8) NOT NULL DEFAULT 'ko',
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_viral_posts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_viral_posts_scenarioKey" ON "viral_posts" ("scenarioKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_viral_posts_scenarioKey_createdAt" ON "viral_posts" ("scenarioKey", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_viral_posts_createdAt" ON "viral_posts" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_viral_posts_createdAt"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_viral_posts_scenarioKey_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_viral_posts_scenarioKey"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "viral_posts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "viral_posts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "viral_posts_channel_enum"`);
  }
}
