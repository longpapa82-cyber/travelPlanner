import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiStatusToTrip1740300000000 implements MigrationInterface {
  name = 'AddAiStatusToTrip1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "aiStatus" varchar(20) NOT NULL DEFAULT 'none'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "aiStatus"`,
    );
  }
}
