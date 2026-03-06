import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameStripeToPaddle1740400000000 implements MigrationInterface {
  name = 'RenameStripeToPaddle1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        RENAME COLUMN "stripeCustomerId" TO "paddleCustomerId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        RENAME COLUMN "paddleCustomerId" TO "stripeCustomerId"
    `);
  }
}
