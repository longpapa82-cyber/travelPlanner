import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollaboratorIndexes1777750000000 implements MigrationInterface {
  name = 'AddCollaboratorIndexes1777750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index for trips query: joining collaborators by (tripId, userId)
    // The existing UQ index covers (tripId, userId) but LEFT JOIN in findAll
    // uses collab.tripId = trip.id AND collab.userId = :userId which benefits
    // from a dedicated userId index for user-centric lookups.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_collaborators_userId" ON "collaborators" ("userId")`,
    );

    // Index for tripId alone — used in expense and collaborator list queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_collaborators_tripId" ON "collaborators" ("tripId")`,
    );

    // itineraries.tripId index for LEFT JOIN in trips findAll
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itineraries_tripId" ON "itineraries" ("tripId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collaborators_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collaborators_tripId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_itineraries_tripId"`);
  }
}
