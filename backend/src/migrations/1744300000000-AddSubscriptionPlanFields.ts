import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPlanFields1744300000000
  implements MigrationInterface
{
  name = 'AddSubscriptionPlanFields1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Track when a paid subscription started and which plan (monthly/yearly)
    // so the SubscriptionScreen can show start/renewal/expiry dates and plan type.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionPlanType" varchar(16)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionPlanType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionStartedAt"`,
    );
  }
}
