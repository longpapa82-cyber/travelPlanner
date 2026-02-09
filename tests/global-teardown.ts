import { WORKERS, API_URL } from './helpers/constants';
import { ApiHelper } from './fixtures/api-helper';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown() {
  console.log('\n🧹 Global Teardown: Cleaning up test data...\n');

  const api = new ApiHelper(API_URL);

  // Delete all test users and their data
  for (const [key, user] of Object.entries(WORKERS)) {
    try {
      const auth = await api.login(user.email, user.password);

      // Delete all trips first
      const trips = await api.getTrips(auth.accessToken);
      for (const trip of trips) {
        try {
          await api.deleteTrip(auth.accessToken, trip.id);
        } catch {
          // Some trips might already be deleted
        }
      }

      // Delete user account
      await api.deleteUser(auth.accessToken);
      console.log(`  🗑️  Deleted: ${user.email}`);
    } catch (e: any) {
      console.log(`  ⚠️  Cleanup for ${user.email}: ${e.message?.slice(0, 60)}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // Clean up auth state directory
  const authDir = path.join(__dirname, '.auth');
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }

  console.log('\n✅ Global Teardown complete!\n');
}

export default globalTeardown;
