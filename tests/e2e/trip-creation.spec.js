const { test, expect } = require('@playwright/test');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

test.describe('AI Travel Planning E2E Test', () => {
  let authToken;
  let userId;
  let createdTripId;

  test('Step 1: User registration', async () => {
    const timestamp = Date.now();
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: `e2e-test-${timestamp}@example.com`,
      password: 'test123456',
      name: 'E2E Test User'
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('accessToken');
    expect(response.data).toHaveProperty('user');

    authToken = response.data.accessToken;
    userId = response.data.user.id;

    console.log('✅ Registration successful');
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${response.data.user.email}`);
  });

  test('Step 2: Create AI-powered trip', async () => {
    const tripData = {
      destination: '파리, 프랑스',
      startDate: '2026-04-01',
      endDate: '2026-04-05',
      numberOfTravelers: 2,
      description: '봄 시즌 파리 여행'
    };

    const response = await axios.post(`${API_BASE_URL}/trips`, tripData, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('destination', '파리, 프랑스');
    expect(response.data).toHaveProperty('status', 'upcoming');
    expect(response.data).toHaveProperty('itineraries');
    expect(response.data.itineraries.length).toBeGreaterThan(0);

    createdTripId = response.data.id;

    console.log('✅ Trip created with AI itinerary');
    console.log(`   Trip ID: ${createdTripId}`);
    console.log(`   Days planned: ${response.data.itineraries.length}`);

    // Verify itinerary structure
    const firstItinerary = response.data.itineraries[0];
    expect(firstItinerary).toHaveProperty('dayNumber', 1);
    expect(firstItinerary).toHaveProperty('activities');
    expect(firstItinerary.activities.length).toBeGreaterThan(0);

    console.log(`   Activities on Day 1: ${firstItinerary.activities.length}`);
  });

  test('Step 3: Fetch trip details', async () => {
    const response = await axios.get(`${API_BASE_URL}/trips/${createdTripId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(createdTripId);
    expect(response.data).toHaveProperty('itineraries');

    console.log('✅ Trip details fetched successfully');

    // Verify weather data
    const itinerariesWithWeather = response.data.itineraries.filter(it => it.weather);
    console.log(`   Itineraries with weather data: ${itinerariesWithWeather.length}/${response.data.itineraries.length}`);

    // Verify timezone data
    const itinerariesWithTimezone = response.data.itineraries.filter(it => it.timezone);
    console.log(`   Itineraries with timezone data: ${itinerariesWithTimezone.length}/${response.data.itineraries.length}`);
  });

  test('Step 4: List all user trips', async () => {
    const response = await axios.get(`${API_BASE_URL}/trips`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);

    const createdTrip = response.data.find(trip => trip.id === createdTripId);
    expect(createdTrip).toBeDefined();
    expect(createdTrip.destination).toBe('파리, 프랑스');

    console.log('✅ Trip list retrieved');
    console.log(`   Total trips: ${response.data.length}`);
  });

  test('Step 5: Verify itinerary activities', async () => {
    const response = await axios.get(`${API_BASE_URL}/trips/${createdTripId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const trip = response.data;

    console.log('✅ Verifying itinerary quality...');

    trip.itineraries.forEach((itinerary, index) => {
      console.log(`\n   Day ${itinerary.dayNumber} (${itinerary.date}):`);

      // Check weather data
      if (itinerary.weather) {
        console.log(`   ├─ Weather: ${itinerary.weather.main} ${Math.round(itinerary.weather.temp)}°C`);
        expect(itinerary.weather).toHaveProperty('temp');
        expect(itinerary.weather).toHaveProperty('main');
      }

      // Check timezone data
      if (itinerary.timezone) {
        console.log(`   ├─ Timezone: ${itinerary.timezone}`);
        expect(itinerary.timezone).toBeTruthy();
      }

      // Check activities
      console.log(`   └─ Activities: ${itinerary.activities.length}`);
      expect(itinerary.activities.length).toBeGreaterThan(0);

      itinerary.activities.forEach((activity, actIndex) => {
        // Verify activity structure
        expect(activity).toHaveProperty('time');
        expect(activity).toHaveProperty('type');
        expect(activity).toHaveProperty('title');
        expect(activity).toHaveProperty('location');
        expect(activity).toHaveProperty('description');
        expect(activity).toHaveProperty('estimatedDuration');
        expect(activity).toHaveProperty('estimatedCost');

        console.log(`      ${actIndex + 1}. [${activity.time}] ${activity.title} (${activity.type})`);
        console.log(`         └─ ${activity.location}`);
      });
    });

    console.log('\n✅ All itinerary data verified');
  });
});
