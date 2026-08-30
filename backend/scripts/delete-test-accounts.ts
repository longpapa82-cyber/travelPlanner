/**
 * ONE-OFF: delete QA/test accounts listed in a manifest CSV.
 *
 * Boots a standalone Nest application context (no HTTP server) so it uses the
 * exact same UsersService.removeByAdmin() path as production — atomic tx,
 * error_logs PII anonymization, cascading FK deletes, 30-day refresh-token
 * blacklist, RevenueCat + Apple cleanup.
 *
 * Manifest format (from claudedocs/test-account-deletion-manifest.csv):
 *   id,email,provider,createdAt,tripCount   (one account per line, no header)
 *
 * Usage (run from backend/):
 *   # dry run — prints what WOULD be deleted, touches nothing (default):
 *   ts-node -r tsconfig-paths/register scripts/delete-test-accounts.ts <manifest.csv>
 *   # real deletion — requires explicit flag:
 *   ts-node -r tsconfig-paths/register scripts/delete-test-accounts.ts <manifest.csv> --execute
 *
 * Failure policy: continue-on-error. A failed account is collected and
 * reported; the remaining accounts are still processed. Exit code is non-zero
 * if any deletion failed.
 *
 * Delete this file after the cleanup is complete.
 */
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'fs';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';

interface ManifestRow {
  id: string;
  email: string;
}

function parseManifest(path: string): ManifestRow[] {
  const raw = readFileSync(path, 'utf8');
  return (
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      // Tolerate an optional header row without a spurious warning.
      .filter((line) => !line.toLowerCase().startsWith('id,'))
      .map((line) => {
        const [id, email] = line.split(',');
        return { id, email };
      })
      .filter((row) => {
        // UUID sanity check — refuse to process a malformed manifest so a bad
        // parse can never feed a wrong id into a destructive call.
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            row.id,
          );
        if (!isUuid) {
          console.warn(`[skip] not a UUID, ignoring line: ${row.id}`);
        }
        return isUuid;
      })
  );
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2];
  const execute = process.argv.includes('--execute');

  if (!manifestPath) {
    console.error('Usage: delete-test-accounts.ts <manifest.csv> [--execute]');
    process.exit(1);
  }

  const rows = parseManifest(manifestPath);
  console.log(`Manifest: ${rows.length} account(s) from ${manifestPath}`);

  if (!execute) {
    console.log(
      '\n=== DRY RUN (no --execute flag) — nothing will be deleted ===',
    );
    rows.forEach((r, i) =>
      console.log(`  ${String(i + 1).padStart(3)}  ${r.id}  ${r.email}`),
    );
    console.log(
      `\nTo actually delete these ${rows.length} accounts, re-run with --execute`,
    );
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const usersService = app.get(UsersService);

  const deleted: string[] = [];
  const failed: { id: string; email: string; error: string }[] = [];

  console.log(`\n=== EXECUTING deletion of ${rows.length} account(s) ===`);
  for (const [i, row] of rows.entries()) {
    const label = `[${i + 1}/${rows.length}] ${row.email} (${row.id})`;
    try {
      await usersService.removeByAdmin(row.id);
      deleted.push(row.id);
      console.log(`ok   ${label}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ id: row.id, email: row.email, error: message });
      console.error(`FAIL ${label}: ${message}`);
    }
  }

  await app.close();

  console.log('\n=== SUMMARY ===');
  console.log(`  deleted: ${deleted.length}`);
  console.log(`  failed:  ${failed.length}`);
  if (failed.length > 0) {
    console.log('\n  Failed accounts (retry or inspect manually):');
    failed.forEach((f) => console.log(`    ${f.id}  ${f.email}  → ${f.error}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
