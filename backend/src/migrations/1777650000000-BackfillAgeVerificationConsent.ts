import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V187 P0-E: Backfill missing AGE_VERIFICATION consent rows for existing users.
 *
 * V186 reported "ConsentScreen shown to existing user (longpapa82)". Root
 * cause: AGE_VERIFICATION was added to REQUIRED_CONSENTS at some point in
 * the V137~V180 7-step QA phase, but the migration that introduced the
 * enum value never backfilled rows for users who had already passed the
 * earlier consent flow. Result: getConsentsStatus() found no row for
 * (userId, AGE_VERIFICATION, '1.0.0') → requiresUpdate=true → screen shown
 * on every login until the user re-consented.
 *
 * Why backfill is legally sound: TERMS v1.0.0 contains an explicit
 * "14세 이상 확인" clause (verified in V137 7-step QA across 17 locales).
 * A user who has an active TERMS row has, by the act of granting TERMS,
 * already attested to the age requirement. The backfill row inherits the
 * TERMS consent's `consentedAt`, `ipAddress`, `userAgent`, `legalBasis`
 * so the audit trail accurately reflects when the underlying consent was
 * given. consentMethod is set to 'inferred_from_terms' so the row is
 * distinguishable from explicit grants if a regulator audits.
 *
 * Idempotent: ON CONFLICT DO NOTHING on the existing UQ_user_consents
 * unique constraint (userId, consentType, consentVersion). Re-running the
 * migration is a no-op for already-backfilled users.
 */
export class BackfillAgeVerificationConsent1777650000000
  implements MigrationInterface
{
  name = 'BackfillAgeVerificationConsent1777650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        terms."userId",
        'age_verification' AS "consentType",
        '1.0.0' AS "consentVersion",
        true AS "isConsented",
        terms."consentedAt",
        terms."ipAddress",
        terms."userAgent",
        'inferred_from_terms' AS "consentMethod",
        terms."legalBasis",
        now() AS "createdAt",
        now() AS "updatedAt"
      FROM "user_consents" terms
      WHERE terms."consentType" = 'terms'
        AND terms."consentVersion" = '1.0.0'
        AND terms."isConsented" = true
        AND terms."revokedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "user_consents" existing
          WHERE existing."userId" = terms."userId"
            AND existing."consentType" = 'age_verification'
            AND existing."consentVersion" = '1.0.0'
        )
      ON CONFLICT ("userId", "consentType", "consentVersion") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversal: remove only the rows we added (consentMethod sentinel).
    // Real explicit AGE_VERIFICATION grants from the consent screen carry
    // a different consentMethod and are preserved.
    await queryRunner.query(`
      DELETE FROM "user_consents"
      WHERE "consentType" = 'age_verification'
        AND "consentVersion" = '1.0.0'
        AND "consentMethod" = 'inferred_from_terms'
    `);
  }
}
