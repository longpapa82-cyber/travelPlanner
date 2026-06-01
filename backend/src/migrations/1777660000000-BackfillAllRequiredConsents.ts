import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill missing terms and privacy_required consent rows for existing users
 * who have no row at any version for those types.
 *
 * Root cause: users who registered before the consent system was introduced
 * have no rows for terms/privacy_required/age_verification. The prior
 * BackfillAgeVerificationConsent migration only covered age_verification.
 * Logs show ~104 users triggering "Consent backfill miss" on every login.
 *
 * Legal basis: a user who completed registration accepted the terms of service
 * at that time (pre-consent-table era). The backfill records this as
 * 'inferred_from_registration' with createdAt as the audit timestamp.
 *
 * Idempotent: ON CONFLICT DO NOTHING on the unique constraint
 * (userId, consentType, consentVersion).
 */
export class BackfillAllRequiredConsents1777660000000
  implements MigrationInterface
{
  name = 'BackfillAllRequiredConsents1777660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill terms for users with no terms row at any version
    await queryRunner.query(`
      INSERT INTO "user_consents" (
        "userId",
        "consentType",
        "consentVersion",
        "isConsented",
        "consentedAt",
        "ipAddress",
        "userAgent",
        "consentMethod",
        "legalBasis",
        "createdAt",
        "updatedAt"
      )
      SELECT
        u."id",
        'terms' AS "consentType",
        '1.0.0' AS "consentVersion",
        true AS "isConsented",
        u."createdAt" AS "consentedAt",
        NULL AS "ipAddress",
        'backfill' AS "userAgent",
        'legacy_registration' AS "consentMethod",
        'legitimate_interest' AS "legalBasis",
        now() AS "createdAt",
        now() AS "updatedAt"
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_consents" uc
        WHERE uc."userId" = u."id"
          AND uc."consentType" = 'terms'
      )
      ON CONFLICT ("userId", "consentType", "consentVersion") DO NOTHING
    `);

    // Backfill privacy_required for users with no privacy_required row at any version
    await queryRunner.query(`
      INSERT INTO "user_consents" (
        "userId",
        "consentType",
        "consentVersion",
        "isConsented",
        "consentedAt",
        "ipAddress",
        "userAgent",
        "consentMethod",
        "legalBasis",
        "createdAt",
        "updatedAt"
      )
      SELECT
        u."id",
        'privacy_required' AS "consentType",
        '1.0.0' AS "consentVersion",
        true AS "isConsented",
        u."createdAt" AS "consentedAt",
        NULL AS "ipAddress",
        'backfill' AS "userAgent",
        'legacy_registration' AS "consentMethod",
        'legitimate_interest' AS "legalBasis",
        now() AS "createdAt",
        now() AS "updatedAt"
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_consents" uc
        WHERE uc."userId" = u."id"
          AND uc."consentType" = 'privacy_required'
      )
      ON CONFLICT ("userId", "consentType", "consentVersion") DO NOTHING
    `);

    // Backfill age_verification for users with no age_verification row at any version
    // (covers users missed by BackfillAgeVerificationConsent which only used terms join)
    await queryRunner.query(`
      INSERT INTO "user_consents" (
        "userId",
        "consentType",
        "consentVersion",
        "isConsented",
        "consentedAt",
        "ipAddress",
        "userAgent",
        "consentMethod",
        "legalBasis",
        "createdAt",
        "updatedAt"
      )
      SELECT
        u."id",
        'age_verification' AS "consentType",
        '1.0.0' AS "consentVersion",
        true AS "isConsented",
        u."createdAt" AS "consentedAt",
        NULL AS "ipAddress",
        'backfill' AS "userAgent",
        'legacy_registration' AS "consentMethod",
        'legitimate_interest' AS "legalBasis",
        now() AS "createdAt",
        now() AS "updatedAt"
      FROM "users" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_consents" uc
        WHERE uc."userId" = u."id"
          AND uc."consentType" = 'age_verification'
      )
      ON CONFLICT ("userId", "consentType", "consentVersion") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_consents"
      WHERE "consentMethod" = 'legacy_registration'
        AND "consentVersion" = '1.0.0'
        AND "consentType" IN ('terms', 'privacy_required', 'age_verification')
    `);
  }
}
