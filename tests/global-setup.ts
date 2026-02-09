import { WORKERS, API_URL, TEST_PASSWORD } from './helpers/constants';
import { ApiHelper } from './fixtures/api-helper';
import { SEED_TRIPS, SAMPLE_ACTIVITY } from './fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup() {
  const api = new ApiHelper(API_URL);
  const authDir = path.join(__dirname, '.auth');

  // Create auth state directory
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('🔧 Global Setup: Creating test users and seed data...\n');

  // 1. Register all test users
  for (const [key, user] of Object.entries(WORKERS)) {
    try {
      await api.register(user);
      console.log(`  ✅ Registered: ${user.email}`);
    } catch (e: any) {
      console.log(`  ⚠️  ${user.email}: ${e.message?.slice(0, 80)}`);
    }

    // Small delay to avoid rate limits on registration
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 2. Login all users and save auth state
  const tokens: Record<string, { accessToken: string; refreshToken: string }> = {};
  for (const [key, user] of Object.entries(WORKERS)) {
    try {
      const auth = await api.login(user.email, user.password);
      tokens[key] = auth;

      // Save auth state for the fixture
      const stateFile = path.join(authDir, `${user.email}.json`);
      fs.writeFileSync(stateFile, JSON.stringify(auth, null, 2));
      console.log(`  🔑 Logged in: ${user.email}`);
    } catch (e: any) {
      console.log(`  ❌ Login failed: ${user.email} — ${e.message?.slice(0, 80)}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // 3. Create seed trips for workers that need them
  const seedWorkers: Array<{ key: string; trips: typeof SEED_TRIPS.W4 }> = [
    { key: 'W4', trips: SEED_TRIPS.W4 },
    { key: 'W5', trips: SEED_TRIPS.W5 },
    { key: 'W6', trips: SEED_TRIPS.W6 },
    { key: 'W7', trips: SEED_TRIPS.W7 },
    { key: 'W8', trips: SEED_TRIPS.W8 },
    { key: 'DESTROY', trips: SEED_TRIPS.DESTROY },
  ];

  for (const { key, trips } of seedWorkers) {
    const token = tokens[key]?.accessToken;
    if (!token) {
      console.log(`  ⚠️  Skipping seed for ${key}: no token`);
      continue;
    }

    for (const tripData of trips) {
      try {
        const trip = await api.createTrip(token, tripData);
        console.log(`  📍 Created trip: ${tripData.destination} for ${key} (id: ${trip?.id?.slice(0, 8)})`);

        // Add sample activities to first itinerary if trip has itineraries
        if (trip?.itineraries?.length > 0 && (key === 'W5' || key === 'W6')) {
          const itinerary = trip.itineraries[0];
          try {
            await api.addActivity(token, trip.id, itinerary.id, SAMPLE_ACTIVITY);
            await api.addActivity(token, trip.id, itinerary.id, {
              ...SAMPLE_ACTIVITY,
              time: '12:00',
              title: '점심 식사',
              type: 'meal',
              location: '현지 레스토랑',
            });
            await api.addActivity(token, trip.id, itinerary.id, {
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

      // Delay between trip creations to avoid rate limits
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Save trip IDs for reference
  const tripMap: Record<string, string[]> = {};
  for (const { key } of seedWorkers) {
    const token = tokens[key]?.accessToken;
    if (!token) continue;
    try {
      const trips = await api.getTrips(token);
      tripMap[key] = trips.map((t: any) => t.id);
    } catch {
      tripMap[key] = [];
    }
  }
  fs.writeFileSync(
    path.join(authDir, 'trip-ids.json'),
    JSON.stringify(tripMap, null, 2)
  );

  console.log('\n✅ Global Setup complete!\n');
}

export default globalSetup;
