import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTimezoneOffsetColumnType1779090093000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // timezoneOffset was declared as integer, which rejects fractional offsets
    // (e.g., India UTC+5.5 → 5.5, Iran UTC+3.5 → 3.5, Nepal UTC+5.75 → 5.75).
    // Changing to real (float4) stores the hours-unit value without loss.
    await queryRunner.query(`
      ALTER TABLE "itineraries"
      ALTER COLUMN "timezoneOffset" TYPE real
      USING "timezoneOffset"::real
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Round to nearest integer on rollback to avoid conversion errors.
    await queryRunner.query(`
      ALTER TABLE "itineraries"
      ALTER COLUMN "timezoneOffset" TYPE integer
      USING ROUND("timezoneOffset")::integer
    `);
  }
}
