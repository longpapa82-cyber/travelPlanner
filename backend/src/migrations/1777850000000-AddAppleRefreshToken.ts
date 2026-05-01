import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppleRefreshToken1777850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "appleRefreshToken" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "appleRefreshToken"
    `);
  }
}
