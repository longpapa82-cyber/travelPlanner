import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionIsSandbox1779200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionIsSandbox" boolean DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "subscriptionIsSandbox"`,
    );
  }
}
