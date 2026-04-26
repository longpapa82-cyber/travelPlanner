import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V186 (Invariant 40): processed_webhook_events table for RevenueCat
 * webhook idempotency. See ProcessedWebhookEvent entity for the V185
 * CATASTROPHIC bug RCA that drove this.
 */
export class AddProcessedWebhookEvents1777550000000
  implements MigrationInterface
{
  name = 'AddProcessedWebhookEvents1777550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "processed_webhook_events" (
        "eventId" character varying(64) NOT NULL,
        "source" character varying(8) NOT NULL,
        "eventType" character varying(64),
        "userId" uuid,
        "processedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_processed_webhook_events" PRIMARY KEY ("eventId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_processed_webhook_events_processedAt"
        ON "processed_webhook_events" ("processedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_processed_webhook_events_processedAt"`,
    );
    await queryRunner.query(`DROP TABLE "processed_webhook_events"`);
  }
}
