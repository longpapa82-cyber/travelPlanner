/**
 * Production Global Setup
 *
 * Differences from local global-setup.ts:
 * 1. DB access via SSH tunnel (no local psql)
 * 2. Longer delays between registrations (rate limit: 3 reqs/60s)
 * 3. All workers registered with 'prod-test-' email prefix
 * 4. SSH key: ~/.ssh/travelplanner-oci → ubuntu@150.230.251.32
 */
import { WORKERS, API_URL, IS_PROD } from './helpers/constants';
import { ApiHelper } from './fixtures/api-helper';
import { SEED_TRIPS, SAMPLE_ACTIVITY } from './fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const SSH_KEY = path.join(process.env.HOME || '~', '.ssh', 'travelplanner-oci');
const SSH_TARGET = 'ubuntu@150.230.251.32';
const DOCKER_POSTGRES = 'travelplanner-postgres-1';

// Rate limit: 3 registrations per 60 seconds → 21s between each
const REGISTER_DELAY_MS = 21_000;
// Login rate limit: 5 per 60 seconds → 13s between each
const LOGIN_DELAY_MS = 13_000;
// Trip creation: add buffer for API processing on constrained server
const TRIP_DELAY_MS = 4_000;

/**
 * Execute a SQL command on production DB via SSH → docker exec → psql.
 */
function execRemoteSql(sql: string, label: string): boolean {
  // The SQL is passed inside double quotes to psql -c.
  // We escape inner double quotes for the remote bash shell.
  const escapedSql = sql.replace(/"/g, '\\"');
  const remoteCmd = `docker exec ${DOCKER_POSTGRES} psql -U postgres -d travelplanner -c "${escapedSql}"`;

  try {
    execFileSync('ssh', [
      '-i', SSH_KEY,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=15',
      SSH_TARGET,
      remoteCmd,
    ], { stdio: 'pipe', timeout: 30_000 });
    console.log(`  ✅ ${label}`);
    return true;
  } catch (e: any) {
    console.log(`  ⚠️  ${label} failed: ${e.message?.slice(0, 120)}`);
    return false;
  }
}

/**
 * Reset W14 user (2FA test) via SSH → remote psql.
 */
function resetTwoFactorTestUser() {
  const email = WORKERS.W14.email;
  // Try "user" table first (TypeORM default), then "users"
  if (!execRemoteSql(`DELETE FROM "user" WHERE email = '${email}'`, 'Reset W14 (2FA user)')) {
    execRemoteSql(`DELETE FROM users WHERE email = '${email}'`, 'Reset W14 (2FA user, users table)');
  }
}

/**
 * Mark all prod-test-* emails as verified via SSH → remote psql.
 */
function verifyTestUserEmails() {
  const pattern = 'prod-test-%@test.com';
  if (!execRemoteSql(
    `UPDATE "user" SET "isEmailVerified" = true WHERE email LIKE '${pattern}'`,
    'All prod test emails verified',
  )) {
    execRemoteSql(
      `UPDATE users SET "isEmailVerified" = true WHERE email LIKE '${pattern}'`,
      'All prod test emails verified (users table)',
    );
  }
}

async function globalSetup() {
  if (!IS_PROD) {
    throw new Error('global-setup.prod.ts should only run with PROD_TEST=1');
  }

  const api = new ApiHelper(API_URL);
  // Use project root tests/ directory for .auth (not __dirname which may be a temp compiled path)
  const testsDir = path.resolve(__dirname);
  const authDir = path.join(testsDir, '.auth');

  // Ensure directory exists (force recreation to avoid stale state)
  fs.mkdirSync(authDir, { recursive: true });

  console.log('🔧 Production Global Setup: Creating test users and seed data...');
  console.log(`   Target: ${API_URL}`);
  console.log(`   Register delay: ${REGISTER_DELAY_MS / 1000}s (rate limit: 3/60s)\n`);

  // 0. Reset 2FA test user
  resetTwoFactorTestUser();

  // 1. Register all test users (with rate-limit-safe delays)
  const workerEntries = Object.entries(WORKERS);
  for (let i = 0; i < workerEntries.length; i++) {
    const [key, user] = workerEntries[i];
    try {
      await api.register(user);
      console.log(`  ✅ Registered: ${user.email}`);
    } catch (e: any) {
      if (e.message?.includes('409')) {
        console.log(`  ⏭️  Already exists: ${user.email}`);
      } else {
        console.log(`  ⚠️  ${user.email}: ${e.message?.slice(0, 80)}`);
      }
    }

    // Rate limit safe delay (skip after last registration)
    if (i < workerEntries.length - 1) {
      await new Promise((r) => setTimeout(r, REGISTER_DELAY_MS));
    }
  }

  // 2. Verify all test user emails via SSH → remote DB
  verifyTestUserEmails();

  // 3. Login all users and save auth state
  const tokens: Record<string, { accessToken: string; refreshToken: string }> = {};
  for (const [key, user] of workerEntries) {
    try {
      const auth = await api.login(user.email, user.password);
      tokens[key] = auth;
      console.log(`  🔑 Logged in: ${user.email}`);

      // Save auth state to file (non-critical — tests login via API themselves)
      try {
        const stateFile = path.join(authDir, `${user.email}.json`);
        fs.writeFileSync(stateFile, JSON.stringify(auth, null, 2));
      } catch { /* file write is optional */ }
    } catch (e: any) {
      console.log(`  ❌ Login failed: ${user.email} — ${e.message?.slice(0, 120)}`);
    }

    await new Promise((r) => setTimeout(r, LOGIN_DELAY_MS));
  }

  // 4. Seed each worker: re-login → cleanup → create trips (inline to avoid JWT expiry)
  console.log('\n  🌱 Seeding workers (inline re-login per worker to avoid JWT expiry)...');
  const seedWorkers: Array<{ key: string; trips: typeof SEED_TRIPS.W4 }> = [
    { key: 'W4', trips: SEED_TRIPS.W4 },
    { key: 'W5', trips: SEED_TRIPS.W5 },
    { key: 'W6', trips: SEED_TRIPS.W6 },
    { key: 'W7', trips: SEED_TRIPS.W7 },
    { key: 'W8', trips: SEED_TRIPS.W8 },
    { key: 'W9', trips: SEED_TRIPS.W9 },
    { key: 'W10', trips: SEED_TRIPS.W10 },
    { key: 'W11', trips: SEED_TRIPS.W11 },
    { key: 'W12', trips: SEED_TRIPS.W12 },
    { key: 'W13', trips: SEED_TRIPS.W13 },
    { key: 'W14', trips: [] },
    { key: 'W15', trips: [] },
    { key: 'DESTROY', trips: SEED_TRIPS.DESTROY },
  ];

  for (const { key, trips } of seedWorkers) {
    if (trips.length === 0) continue; // skip W14, W15 (no trips to seed)

    // Re-login this worker for a fresh token RIGHT BEFORE their operations
    const workerUser = WORKERS[key as keyof typeof WORKERS];
    if (!workerUser) continue;
    try {
      console.log(`\n  🔑 Re-login ${key} (${workerUser.email}) for fresh token...`);
      const freshAuth = await api.login(workerUser.email, workerUser.password);
      tokens[key] = freshAuth;
      await new Promise((r) => setTimeout(r, LOGIN_DELAY_MS));
    } catch (e: any) {
      console.log(`  ⚠️  Re-login failed for ${key}: ${e.message?.slice(0, 120)}`);
      continue; // skip this worker's trips
    }

    const freshToken = tokens[key]?.accessToken;
    if (!freshToken) continue;

    // Cleanup existing trips for this worker
    try {
      const existingTrips = await api.getTrips(freshToken);
      for (const trip of existingTrips) {
        try { await api.deleteTrip(freshToken, trip.id); } catch { /* ignore */ }
      }
      if (existingTrips.length > 0) {
        console.log(`  🗑️  Deleted ${existingTrips.length} trips for ${workerUser.email}`);
      }
    } catch { /* ignore — user may have no trips */ }

    // Create seed trips
    for (const tripData of trips) {
      try {
        const trip = await api.createTrip(freshToken, tripData);
        console.log(`  📍 Created trip: ${tripData.destination} for ${key} (id: ${trip?.id?.slice(0, 8)})`);

        // Add sample activities to first itinerary for selected workers
        if (trip?.itineraries?.length > 0 && ['W5', 'W6', 'W9', 'W10', 'W11'].includes(key)) {
          const itinerary = trip.itineraries[0];
          try {
            await api.addActivity(freshToken, trip.id, itinerary.id, SAMPLE_ACTIVITY);
            await api.addActivity(freshToken, trip.id, itinerary.id, {
              ...SAMPLE_ACTIVITY,
              time: '12:00',
              title: '점심 식사',
              type: 'meal',
              location: '현지 레스토랑',
            });
            await api.addActivity(freshToken, trip.id, itinerary.id, {
              ...SAMPLE_ACTIVITY,
              time: '14:00',
              title: '쇼핑',
              type: 'shopping',
              location: '쇼핑몰',
            });
            console.log(`    ➕ Added 3 activities to ${tripData.destination}`);
          } catch (e: any) {
            console.log(`    ⚠️  Activity add failed: ${e.message?.slice(0, 60)}`);
          }
        }
      } catch (e: any) {
        console.log(`  ⚠️  Trip creation failed for ${key}: ${e.message?.slice(0, 80)}`);
      }

      await new Promise((r) => setTimeout(r, TRIP_DELAY_MS));
    }
  }

  // 5. Save trip IDs for reference (non-critical — tests login independently)
  try {
    const tripMap: Record<string, string[]> = {};
    for (const { key, trips: seedTrips } of seedWorkers) {
      if (seedTrips.length === 0) continue;
      const token = tokens[key]?.accessToken;
      if (!token) continue;
      try {
        const userTrips = await api.getTrips(token);
        tripMap[key] = userTrips.map((t: any) => t.id);
      } catch {
        tripMap[key] = [];
      }
    }
    fs.writeFileSync(
      path.join(authDir, 'trip-ids.json'),
      JSON.stringify(tripMap, null, 2),
    );
  } catch { /* non-critical */ }

  console.log('\n✅ Production Global Setup complete!\n');
}

export default globalSetup;
