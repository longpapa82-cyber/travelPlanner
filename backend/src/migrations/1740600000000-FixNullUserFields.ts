import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixNullUserFields1740600000000 implements MigrationInterface {
  name = 'FixNullUserFields1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix null aiTripsUsedThisMonth to 0
    await queryRunner.query(`
      UPDATE "users"
      SET "aiTripsUsedThisMonth" = 0
      WHERE "aiTripsUsedThisMonth" IS NULL
    `);

    // Fix null subscriptionTier to 'free'
    await queryRunner.query(`
      UPDATE "users"
      SET "subscriptionTier" = 'free'
      WHERE "subscriptionTier" IS NULL
    `);

    // Add NOT NULL constraints after fixing data
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "aiTripsUsedThisMonth" SET NOT NULL,
      ALTER COLUMN "aiTripsUsedThisMonth" SET DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "subscriptionTier" SET NOT NULL,
      ALTER COLUMN "subscriptionTier" SET DEFAULT 'free'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove NOT NULL constraints
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "aiTripsUsedThisMonth" DROP NOT NULL,
      ALTER COLUMN "aiTripsUsedThisMonth" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "subscriptionTier" DROP NOT NULL,
      ALTER COLUMN "subscriptionTier" DROP DEFAULT
    `);
  }
}
