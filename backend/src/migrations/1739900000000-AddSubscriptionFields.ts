import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionFields1739900000000 implements MigrationInterface {
  name = 'AddSubscriptionFields1739900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums if they don't exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscription_tier_enum" AS ENUM ('free', 'premium');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscription_platform_enum" AS ENUM ('ios', 'android', 'web');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Add columns if they don't exist
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "subscriptionTier" "subscription_tier_enum" NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS "subscriptionPlatform" "subscription_platform_enum",
        ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "revenuecatAppUserId" VARCHAR,
        ADD COLUMN IF NOT EXISTS "aiTripsUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "stripeCustomerId" VARCHAR
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "stripeCustomerId",
        DROP COLUMN IF EXISTS "aiTripsUsedThisMonth",
        DROP COLUMN IF EXISTS "revenuecatAppUserId",
        DROP COLUMN IF EXISTS "subscriptionExpiresAt",
        DROP COLUMN IF EXISTS "subscriptionPlatform",
        DROP COLUMN IF EXISTS "subscriptionTier"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_platform_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_tier_enum"`);
  }
}
