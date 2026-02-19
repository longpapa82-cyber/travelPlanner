/**
 * Production Global Teardown
 *
 * Differences from local global-teardown.ts:
 * - Deletes test trips via API (clean up test data)
 * - Keeps user accounts alive (avoids re-registration on next run)
 * - Slower delays for rate limit compliance
 */
import { WORKERS, API_URL, IS_PROD } from './helpers/constants';
import { ApiHelper } from './fixtures/api-helper';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown() {
  if (!IS_PROD) {
    throw new Error('global-teardown.prod.ts should only run with PROD_TEST=1');
  }

  console.log('\n🧹 Production Teardown: Cleaning up test trip data...\n');

  const api = new ApiHelper(API_URL);

  // Delete all trips for each test user, but keep accounts for re-runs
  for (const [key, user] of Object.entries(WORKERS)) {
    try {
      const auth = await api.login(user.email, user.password);

      const trips = await api.getTrips(auth.accessToken);
      let deleted = 0;
      for (const trip of trips) {
        try {
          await api.deleteTrip(auth.accessToken, trip.id);
          deleted++;
        } catch {
          // Trip may already be deleted by test
        }
      }

      if (deleted > 0) {
        console.log(`  🗑️  ${user.email}: deleted ${deleted} trips`);
      }
    } catch (e: any) {
      // Login may fail if user wasn't created (setup error) — that's fine
      console.log(`  ⚠️  Cleanup for ${user.email}: ${e.message?.slice(0, 60)}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  // Clean up local auth state directory
  const authDir = path.join(__dirname, '.auth');
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }

  console.log('\n✅ Production Teardown complete (user accounts preserved for re-runs).\n');
}

export default globalTeardown;
