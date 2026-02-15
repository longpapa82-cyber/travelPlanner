import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateQualityTracking1739600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates"
       ADD COLUMN IF NOT EXISTS "servedCount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates"
       ADD COLUMN IF NOT EXISTS "userModifiedCount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates"
       ADD COLUMN IF NOT EXISTS "qualityScore" double precision`,
    );
    // Index for smart refresh: low quality templates first
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_itinerary_templates_quality"
       ON "itinerary_templates" ("qualityScore" ASC NULLS FIRST)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_itinerary_templates_quality"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates" DROP COLUMN IF EXISTS "qualityScore"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates" DROP COLUMN IF EXISTS "userModifiedCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates" DROP COLUMN IF EXISTS "servedCount"`,
    );
  }
}
