import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeocodingCache1740100000000 implements MigrationInterface {
  name = 'AddGeocodingCache1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "geocoding_cache" (
        "queryHash" VARCHAR(64) PRIMARY KEY,
        "query" TEXT NOT NULL,
        "latitude" DOUBLE PRECISION NOT NULL,
        "longitude" DOUBLE PRECISION NOT NULL,
        "source" VARCHAR(20) NOT NULL DEFAULT 'google',
        "confidence" REAL NOT NULL DEFAULT 1.0,
        "hitCount" INT NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_geocoding_cache_hitCount" ON "geocoding_cache" ("hitCount")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_geocoding_cache_hitCount"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "geocoding_cache"`);
  }
}
