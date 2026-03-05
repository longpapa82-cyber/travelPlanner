import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialTables1739800000000 implements MigrationInterface {
  name = 'AddSocialTables1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create follows table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "followerId" uuid NOT NULL,
        "followingId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_follows_follower_following" UNIQUE ("followerId", "followingId"),
        CONSTRAINT "FK_follows_follower" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_follows_following" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_follows_followerId" ON "follows" ("followerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_follows_followingId" ON "follows" ("followingId")`,
    );

    // Create trip_likes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trip_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tripId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trip_likes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_trip_likes_user_trip" UNIQUE ("userId", "tripId"),
        CONSTRAINT "FK_trip_likes_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_trip_likes_trip" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trip_likes_tripId" ON "trip_likes" ("tripId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_trip_likes_userId" ON "trip_likes" ("userId")`,
    );

    // Add social columns to user table (if not exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'followersCount') THEN
          ALTER TABLE "users" ADD COLUMN "followersCount" integer NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'followingCount') THEN
          ALTER TABLE "users" ADD COLUMN "followingCount" integer NOT NULL DEFAULT 0;
        END IF;
      END $$
    `);

    // Add likesCount column to trips table (if not exists)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'likesCount') THEN
          ALTER TABLE "trips" ADD COLUMN "likesCount" integer NOT NULL DEFAULT 0;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trip_likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "follows"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "followersCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "followingCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "likesCount"`,
    );
  }
}
