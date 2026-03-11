import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiUsageTable1740500000000 implements MigrationInterface {
  name = 'AddApiUsageTable1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" varchar(30) NOT NULL,
        "feature" varchar(30) NOT NULL,
        "status" varchar(10) NOT NULL DEFAULT 'success',
        "inputTokens" int,
        "outputTokens" int,
        "costUsd" decimal(10,6) NOT NULL DEFAULT 0,
        "latencyMs" int NOT NULL DEFAULT 0,
        "errorCode" varchar(100),
        "userId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_usage" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_api_usage_createdAt" ON "api_usage" ("createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_api_usage_provider" ON "api_usage" ("provider")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_api_usage_provider_createdAt" ON "api_usage" ("provider", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_api_usage_provider_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_api_usage_provider"`);
    await queryRunner.query(`DROP INDEX "IDX_api_usage_createdAt"`);
    await queryRunner.query(`DROP TABLE "api_usage"`);
  }
}
