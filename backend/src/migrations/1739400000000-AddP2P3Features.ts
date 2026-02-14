import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: P2-P3 Feature Additions
 *
 * Adds:
 * - 2FA columns to users (isTwoFactorEnabled, twoFactorSecret, twoFactorBackupCodes)
 * - Push notification token to users (pushToken)
 * - Budget columns to trips (totalBudget, budgetCurrency)
 * - Cover image to trips (coverImage)
 * - Collaborators table with role enum
 */
export class AddP2P3Features1739400000000 implements MigrationInterface {
  name = 'AddP2P3Features1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Users: 2FA columns ---
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isTwoFactorEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorSecret" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorBackupCodes" text`,
    );

    // --- Users: Push notification token ---
    await queryRunner.query(
      `ALTER TABLE "users" ADD "pushToken" character varying`,
    );

    // --- Trips: Budget columns ---
    await queryRunner.query(
      `ALTER TABLE "trips" ADD "totalBudget" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" ADD "budgetCurrency" character varying(3) NOT NULL DEFAULT 'USD'`,
    );

    // --- Trips: Cover image ---
    await queryRunner.query(
      `ALTER TABLE "trips" ADD "coverImage" character varying`,
    );

    // --- Collaborators table ---
    await queryRunner.query(
      `CREATE TYPE "public"."collaborators_role_enum" AS ENUM('viewer', 'editor')`,
    );
    await queryRunner.query(
      `CREATE TABLE "collaborators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tripId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "public"."collaborators_role_enum" NOT NULL DEFAULT 'viewer',
        "invitedBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_collaborator_trip_user" UNIQUE ("tripId", "userId"),
        CONSTRAINT "PK_collaborators" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaborators" ADD CONSTRAINT "FK_collaborator_trip" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaborators" ADD CONSTRAINT "FK_collaborator_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collaborator_tripId" ON "collaborators" ("tripId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collaborator_userId" ON "collaborators" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- Collaborators ---
    await queryRunner.query(`DROP INDEX "public"."IDX_collaborator_userId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_collaborator_tripId"`);
    await queryRunner.query(
      `ALTER TABLE "collaborators" DROP CONSTRAINT "FK_collaborator_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaborators" DROP CONSTRAINT "FK_collaborator_trip"`,
    );
    await queryRunner.query(`DROP TABLE "collaborators"`);
    await queryRunner.query(`DROP TYPE "public"."collaborators_role_enum"`);

    // --- Trips ---
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "coverImage"`);
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "budgetCurrency"`);
    await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "totalBudget"`);

    // --- Users ---
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pushToken"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorBackupCodes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorSecret"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isTwoFactorEnabled"`,
    );
  }
}
