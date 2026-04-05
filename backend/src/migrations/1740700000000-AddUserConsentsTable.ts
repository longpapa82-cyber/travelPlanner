import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserConsentsTable1740700000000 implements MigrationInterface {
  name = 'AddUserConsentsTable1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_consents table
    await queryRunner.query(`
      CREATE TABLE "user_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "consentType" varchar(50) NOT NULL,
        "consentVersion" varchar(20) NOT NULL,
        "isConsented" boolean NOT NULL DEFAULT false,
        "consentedAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "ipAddress" inet,
        "userAgent" text,
        "consentMethod" varchar(20),
        "legalBasis" varchar(20),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_consents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_consents_user_type_version" UNIQUE ("userId", "consentType", "consentVersion"),
        CONSTRAINT "FK_user_consents_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_user_consents_userId" ON "user_consents" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_consents_type_version" ON "user_consents" ("consentType", "consentVersion")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_consents_isConsented" ON "user_consents" ("userId", "consentType", "isConsented")
    `);

    // Create consent_audit_logs table for compliance tracking
    await queryRunner.query(`
      CREATE TABLE "consent_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "action" varchar(20) NOT NULL,
        "consentType" varchar(50) NOT NULL,
        "previousState" jsonb,
        "newState" jsonb,
        "ipAddress" inet,
        "userAgent" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_consent_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_consent_audit_logs_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create index on audit logs
    await queryRunner.query(`
      CREATE INDEX "IDX_consent_audit_logs_userId_createdAt" ON "consent_audit_logs" ("userId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_consent_audit_logs_consentType" ON "consent_audit_logs" ("consentType")
    `);

    // Add comment for compliance documentation
    await queryRunner.query(`
      COMMENT ON TABLE "user_consents" IS 'Stores user consent records for GDPR/CCPA/KISA compliance. Each record represents a specific consent type and version.'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE "consent_audit_logs" IS 'Audit trail for consent changes. Required for regulatory compliance and user data subject access requests.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop audit logs table
    await queryRunner.query(`DROP INDEX "IDX_consent_audit_logs_consentType"`);
    await queryRunner.query(`DROP INDEX "IDX_consent_audit_logs_userId_createdAt"`);
    await queryRunner.query(`DROP TABLE "consent_audit_logs"`);

    // Drop user_consents table
    await queryRunner.query(`DROP INDEX "IDX_user_consents_isConsented"`);
    await queryRunner.query(`DROP INDEX "IDX_user_consents_type_version"`);
    await queryRunner.query(`DROP INDEX "IDX_user_consents_userId"`);
    await queryRunner.query(`DROP TABLE "user_consents"`);
  }
}
