import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationCode1744200000000 implements MigrationInterface {
  name = 'AddEmailVerificationCode1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns for 6-digit code verification
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationAttempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastVerificationSentAt" TIMESTAMP`,
    );

    // Mark existing users as verified (they've been using the app)
    await queryRunner.query(
      `UPDATE "users" SET "isEmailVerified" = true WHERE "isEmailVerified" = false AND "createdAt" < NOW()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastVerificationSentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationAttempts"`,
    );
  }
}
