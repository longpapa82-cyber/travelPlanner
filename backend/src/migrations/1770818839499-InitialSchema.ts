import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1770818839499 implements MigrationInterface {
    name = 'InitialSchema1770818839499'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_provider_enum" AS ENUM('email', 'google', 'apple', 'kakao')`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying, "passwordHash" character varying, "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'email', "providerId" character varying, "name" character varying(100) NOT NULL, "profileImage" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "isEmailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character varying, "emailVerificationExpiry" TIMESTAMP, "passwordResetToken" character varying, "passwordResetExpiry" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "itineraries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tripId" uuid NOT NULL, "date" date NOT NULL, "dayNumber" integer NOT NULL, "activities" jsonb NOT NULL DEFAULT '[]', "weather" jsonb, "timezone" character varying, "timezoneOffset" integer, "notes" text, "isCompleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9c5db87d0f85f56e4466ae09a38" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."trips_status_enum" AS ENUM('upcoming', 'ongoing', 'completed')`);
        await queryRunner.query(`CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "destination" character varying(200) NOT NULL, "country" character varying(100), "city" character varying(100), "startDate" date NOT NULL, "endDate" date NOT NULL, "status" "public"."trips_status_enum" NOT NULL DEFAULT 'upcoming', "description" text, "numberOfTravelers" integer NOT NULL DEFAULT '1', "preferences" jsonb, "shareToken" character varying(100), "isPublic" boolean NOT NULL DEFAULT false, "shareExpiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c42efc7b8ebdf904fbdd1c7e942" UNIQUE ("shareToken"), CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "affiliate_clicks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying(50) NOT NULL, "destination" character varying(255), "checkIn" date, "checkOut" date, "travelers" integer, "trackingId" character varying(100), "affiliateUrl" text, "ipAddress" character varying(50), "userAgent" text, "referrer" text, "converted" boolean NOT NULL DEFAULT false, "convertedAt" TIMESTAMP, "conversionValue" numeric(10,2), "commission" numeric(10,2), "metadata" jsonb, "userId" uuid, "tripId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_15da15bc7ff917601a3372e5af7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12c3dec602b669b92427f54112" ON "affiliate_clicks" ("provider") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa2e63a7d1aa27a83a8c1612c6" ON "affiliate_clicks" ("trackingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0a6b825908a9952432125e310" ON "affiliate_clicks" ("converted") `);
        await queryRunner.query(`CREATE INDEX "IDX_911a70423d5689cd446c3fbcac" ON "affiliate_clicks" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_61db8e24b4ab5b5c1670574d83" ON "affiliate_clicks" ("tripId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6e153e4c8e1fa8129c9e22dd6" ON "affiliate_clicks" ("tripId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6bf46f48513cc156399ba6175" ON "affiliate_clicks" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_ee52474a6b6188fbe799632f95" ON "affiliate_clicks" ("provider", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "itineraries" ADD CONSTRAINT "FK_e40adba4542a6f942ef01405c53" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trips" ADD CONSTRAINT "FK_db768456df45322f8a749534322" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "FK_911a70423d5689cd446c3fbcac3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "FK_61db8e24b4ab5b5c1670574d838" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "affiliate_clicks" DROP CONSTRAINT "FK_61db8e24b4ab5b5c1670574d838"`);
        await queryRunner.query(`ALTER TABLE "affiliate_clicks" DROP CONSTRAINT "FK_911a70423d5689cd446c3fbcac3"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_db768456df45322f8a749534322"`);
        await queryRunner.query(`ALTER TABLE "itineraries" DROP CONSTRAINT "FK_e40adba4542a6f942ef01405c53"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee52474a6b6188fbe799632f95"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6bf46f48513cc156399ba6175"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6e153e4c8e1fa8129c9e22dd6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61db8e24b4ab5b5c1670574d83"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_911a70423d5689cd446c3fbcac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0a6b825908a9952432125e310"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa2e63a7d1aa27a83a8c1612c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12c3dec602b669b92427f54112"`);
        await queryRunner.query(`DROP TABLE "affiliate_clicks"`);
        await queryRunner.query(`DROP TABLE "trips"`);
        await queryRunner.query(`DROP TYPE "public"."trips_status_enum"`);
        await queryRunner.query(`DROP TABLE "itineraries"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_provider_enum"`);
    }

}
