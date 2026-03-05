import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncementsSystem1740200000000 implements MigrationInterface {
  name = 'AddAnnouncementsSystem1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "announcement_type_enum" AS ENUM ('system', 'feature', 'important', 'promotional');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "announcement_priority_enum" AS ENUM ('critical', 'high', 'normal', 'low');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "announcement_display_type_enum" AS ENUM ('banner', 'modal', 'bottom_sheet', 'notification_only');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "announcement_target_audience_enum" AS ENUM ('all', 'premium', 'free');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    // Create announcements table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "announcement_type_enum" NOT NULL DEFAULT 'system',
        "title" jsonb NOT NULL,
        "content" jsonb NOT NULL,
        "targetAudience" "announcement_target_audience_enum" NOT NULL DEFAULT 'all',
        "priority" "announcement_priority_enum" NOT NULL DEFAULT 'normal',
        "displayType" "announcement_display_type_enum" NOT NULL DEFAULT 'banner',
        "imageUrl" varchar(500),
        "actionUrl" varchar(500),
        "actionLabel" jsonb,
        "startDate" TIMESTAMP NOT NULL DEFAULT now(),
        "endDate" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "isPublished" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements" PRIMARY KEY ("id")
      )
    `);

    // Create announcement_reads table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_reads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "announcementId" uuid NOT NULL,
        "readAt" TIMESTAMP NOT NULL DEFAULT now(),
        "dismissedAt" TIMESTAMP,
        CONSTRAINT "PK_announcement_reads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_announcement_reads_user_announcement" UNIQUE ("userId", "announcementId"),
        CONSTRAINT "FK_announcement_reads_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_announcement_reads_announcement" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcements_active_published_dates"
        ON "announcements" ("isActive", "isPublished", "startDate", "endDate")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcement_reads_userId"
        ON "announcement_reads" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_announcement_reads_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_announcements_active_published_dates"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_reads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "announcement_target_audience_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "announcement_display_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "announcement_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "announcement_type_enum"`);
  }
}
