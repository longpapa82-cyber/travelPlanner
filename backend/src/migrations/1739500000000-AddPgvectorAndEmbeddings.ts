import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPgvectorAndEmbeddings1739500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Add embedding column to itinerary_templates
    // text-embedding-3-small outputs 1536 dimensions
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates" ADD COLUMN IF NOT EXISTS "embedding" vector(1536)`,
    );

    // HNSW index for fast cosine similarity search
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_itinerary_templates_embedding"
       ON "itinerary_templates"
       USING hnsw ("embedding" vector_cosine_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_itinerary_templates_embedding"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_templates" DROP COLUMN IF EXISTS "embedding"`,
    );
    // Don't drop the vector extension — other tables may use it
  }
}
