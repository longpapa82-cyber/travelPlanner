const request = require('supertest');

const API_BASE_URL = 'http://localhost:3000';

/**
 * Comprehensive E2E Test Suite for Travel Planner API
 *
 * 실행 방법:
 * 1. Backend 서버가 실행 중인지 확인: npm run start:dev
 * 2. 이 테스트 실행: node backend/test/e2e-ai-trip.test.js
 *
 * 테스트 범위:
 * - 인증 플로우 (회원가입, 로그인, 프로필, 토큰 갱신)
 * - 여행 CRUD (생성, 조회, 수정, 삭제)
 * - 제휴 추적 (클릭 추적, 전환 업데이트)
 * - 에러 시나리오 (401, 403, 404, 400)
 */

// Test data storage
let testUser = {
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'Test123!@#',
  name: 'E2E Test User',
};
let authTokens = {
  accessToken: null,
  refreshToken: null,
};
let createdTripId = null;
let affiliateClickId = null;

// Test statistics
const testStats = {
  passed: 0,
  failed: 0,
  total: 0,
};

// Helper functions
function logSection(title) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📍 ${title}`);
  console.log('═══════════════════════════════════════════════════════');
}

function logTest(name, status, details = '') {
  testStats.total++;
  if (status === 'PASS') {
    testStats.passed++;
    console.log(`✅ ${name}`);
  } else {
    testStats.failed++;
    console.log(`❌ ${name}`);
  }
  if (details) console.log(`   ${details}`);
}

function logInfo(message) {
  console.log(`   ${message}`);
}

// Test suite
async function runE2ETests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 Comprehensive Travel Planner E2E Test Suite');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📅 Test started at: ${new Date().toISOString()}\n`);

  try {
    // ============================================================================
    // AUTHENTICATION FLOW TESTS
    // ============================================================================
    await testAuthenticationFlow();

    // ============================================================================
    // TRIP CRUD TESTS
    // ============================================================================
    await testTripCRUD();

    // ============================================================================
    // AFFILIATE TRACKING TESTS
    // ============================================================================
    await testAffiliateTracking();

    // ============================================================================
    // ERROR SCENARIO TESTS
    // ============================================================================
    await testErrorScenarios();

    // ============================================================================
    // CLEANUP
    // ============================================================================
    await cleanupTestData();

    // Final summary
    printTestSummary();
  } catch (error) {
    console.error('\n❌ Fatal Error in Test Suite');
    console.error('═══════════════════════════════════════════════════════');
    console.error(error);
    process.exit(1);
  }
}

// ============================================================================
// TEST: Authentication Flow
// ============================================================================
async function testAuthenticationFlow() {
  logSection('1. Authentication Flow Tests');

  // Test 1.1: User Registration
  try {
    const response = await request(API_BASE_URL)
      .post('/api/auth/register')
      .send({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      })
      .expect('Content-Type', /json/);

    if (response.status === 201 || response.status === 200) {
      authTokens.accessToken = response.body.accessToken;
      authTokens.refreshToken = response.body.refreshToken;
      testUser.id = response.body.user.id;
      logTest('1.1 User Registration', 'PASS', `User ID: ${testUser.id}`);
    } else {
      logTest('1.1 User Registration', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('1.1 User Registration', 'FAIL', error.message);
  }

  // Test 1.2: User Login
  try {
    const response = await request(API_BASE_URL)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200)
      .expect('Content-Type', /json/);

    if (response.body.accessToken && response.body.refreshToken) {
      authTokens.accessToken = response.body.accessToken;
      authTokens.refreshToken = response.body.refreshToken;
      logTest('1.2 User Login', 'PASS', 'Tokens received');
    } else {
      logTest('1.2 User Login', 'FAIL', 'No tokens in response');
    }
  } catch (error) {
    logTest('1.2 User Login', 'FAIL', error.message);
  }

  // Test 1.3: Get User Profile
  try {
    const response = await request(API_BASE_URL)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .expect(200)
      .expect('Content-Type', /json/);

    if (response.body.email === testUser.email) {
      logTest('1.3 Get User Profile', 'PASS', `Email: ${response.body.email}`);
    } else {
      logTest('1.3 Get User Profile', 'FAIL', 'Email mismatch');
    }
  } catch (error) {
    logTest('1.3 Get User Profile', 'FAIL', error.message);
  }

  // Test 1.4: Refresh Token
  try {
    const response = await request(API_BASE_URL)
      .post('/api/auth/refresh')
      .send({ refreshToken: authTokens.refreshToken })
      .expect(200)
      .expect('Content-Type', /json/);

    if (response.body.accessToken) {
      authTokens.accessToken = response.body.accessToken;
      logTest('1.4 Refresh Token', 'PASS', 'New access token received');
    } else {
      logTest('1.4 Refresh Token', 'FAIL', 'No new access token');
    }
  } catch (error) {
    logTest('1.4 Refresh Token', 'FAIL', error.message);
  }
}

// ============================================================================
// TEST: Trip CRUD Operations
// ============================================================================
async function testTripCRUD() {
  logSection('2. Trip CRUD Tests');

  // Test 2.1: Create Trip with AI
  try {
    const tripData = {
      destination: '서울, 대한민국',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      numberOfTravelers: 2,
      description: 'E2E 테스트 서울 여행',
    };

    logInfo(`Creating trip: ${tripData.destination} (${tripData.startDate} ~ ${tripData.endDate})`);
    const startTime = Date.now();

    const response = await request(API_BASE_URL)
      .post('/api/trips')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send(tripData)
      .expect('Content-Type', /json/);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (response.status === 201 || response.status === 200) {
      createdTripId = response.body.id;
      const itineraryCount = response.body.itineraries?.length || 0;
      logTest(
        '2.1 Create Trip with AI',
        'PASS',
        `Trip ID: ${createdTripId}, Itineraries: ${itineraryCount}, Duration: ${duration}s`
      );
    } else {
      logTest('2.1 Create Trip with AI', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('2.1 Create Trip with AI', 'FAIL', error.message);
  }

  // Test 2.2: List All Trips
  try {
    const response = await request(API_BASE_URL)
      .get('/api/trips')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .expect(200)
      .expect('Content-Type', /json/);

    const tripCount = Array.isArray(response.body) ? response.body.length : 0;
    const foundTrip = response.body.find((t) => t.id === createdTripId);
    logTest(
      '2.2 List All Trips',
      foundTrip ? 'PASS' : 'FAIL',
      `Total trips: ${tripCount}, Created trip found: ${!!foundTrip}`
    );
  } catch (error) {
    logTest('2.2 List All Trips', 'FAIL', error.message);
  }

  // Test 2.3: Get Single Trip
  try {
    const response = await request(API_BASE_URL)
      .get(`/api/trips/${createdTripId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .expect(200)
      .expect('Content-Type', /json/);

    if (response.body.id === createdTripId) {
      logTest('2.3 Get Single Trip', 'PASS', `Trip ID: ${response.body.id}`);
    } else {
      logTest('2.3 Get Single Trip', 'FAIL', 'Trip ID mismatch');
    }
  } catch (error) {
    logTest('2.3 Get Single Trip', 'FAIL', error.message);
  }

  // Test 2.4: Update Trip
  try {
    const updateData = {
      description: 'E2E 테스트 서울 여행 (수정됨)',
    };

    const response = await request(API_BASE_URL)
      .patch(`/api/trips/${createdTripId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send(updateData)
      .expect('Content-Type', /json/);

    if (response.status === 200 && response.body.description === updateData.description) {
      logTest('2.4 Update Trip', 'PASS', 'Description updated');
    } else {
      logTest('2.4 Update Trip', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('2.4 Update Trip', 'FAIL', error.message);
  }

  // Test 2.5: Get Upcoming Trips
  try {
    const response = await request(API_BASE_URL)
      .get('/api/trips/upcoming')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .expect(200)
      .expect('Content-Type', /json/);

    const tripCount = Array.isArray(response.body) ? response.body.length : 0;
    logTest('2.5 Get Upcoming Trips', 'PASS', `Count: ${tripCount}`);
  } catch (error) {
    logTest('2.5 Get Upcoming Trips', 'FAIL', error.message);
  }

  // Test 2.6: Generate Share Link
  try {
    const response = await request(API_BASE_URL)
      .post(`/api/trips/${createdTripId}/share`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ expiresInDays: 7 })
      .expect('Content-Type', /json/);

    if (response.status === 200 || response.status === 201) {
      const shareToken = response.body.shareToken || response.body.token;
      logTest('2.6 Generate Share Link', 'PASS', `Token: ${shareToken?.substring(0, 20)}...`);
    } else {
      logTest('2.6 Generate Share Link', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('2.6 Generate Share Link', 'FAIL', error.message);
  }
}

// ============================================================================
// TEST: Affiliate Tracking
// ============================================================================
async function testAffiliateTracking() {
  logSection('3. Affiliate Tracking Tests');

  // Test 3.1: Track Affiliate Click (Authenticated)
  try {
    const clickData = {
      provider: 'booking.com',
      url: 'https://booking.com/hotel/test',
      tripId: createdTripId,
      metadata: {
        hotelName: 'Test Hotel',
        location: 'Seoul',
      },
    };

    const response = await request(API_BASE_URL)
      .post('/api/analytics/affiliate/track')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send(clickData)
      .expect('Content-Type', /json/);

    if (response.status === 200 || response.status === 201) {
      affiliateClickId = response.body.clickId;
      logTest('3.1 Track Affiliate Click (Auth)', 'PASS', `Click ID: ${affiliateClickId}`);
    } else {
      logTest('3.1 Track Affiliate Click (Auth)', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('3.1 Track Affiliate Click (Auth)', 'FAIL', error.message);
  }

  // Test 3.2: Track Affiliate Click (Anonymous)
  try {
    const clickData = {
      provider: 'agoda.com',
      url: 'https://agoda.com/hotel/test',
    };

    const response = await request(API_BASE_URL)
      .post('/api/analytics/affiliate/track')
      .send(clickData)
      .expect('Content-Type', /json/);

    if (response.status === 200 || response.status === 201) {
      logTest('3.2 Track Affiliate Click (Anonymous)', 'PASS', 'Click tracked without auth');
    } else {
      logTest('3.2 Track Affiliate Click (Anonymous)', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('3.2 Track Affiliate Click (Anonymous)', 'FAIL', error.message);
  }

  // Test 3.3: Update Conversion
  if (affiliateClickId) {
    try {
      const conversionData = {
        conversionValue: 150000,
        commission: 7500,
      };

      const response = await request(API_BASE_URL)
        .post(`/api/analytics/affiliate/conversion/${affiliateClickId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(conversionData)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        logTest('3.3 Update Conversion', 'PASS', `Value: ${conversionData.conversionValue}`);
      } else {
        logTest('3.3 Update Conversion', 'FAIL', `Status: ${response.status}`);
      }
    } catch (error) {
      logTest('3.3 Update Conversion', 'FAIL', error.message);
    }
  }

  // Test 3.4: Get My Clicks
  try {
    const response = await request(API_BASE_URL)
      .get('/api/analytics/affiliate/my-clicks?limit=10')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .expect(200)
      .expect('Content-Type', /json/);

    const clickCount = response.body.clicks?.length || 0;
    logTest('3.4 Get My Clicks', 'PASS', `Count: ${clickCount}`);
  } catch (error) {
    logTest('3.4 Get My Clicks', 'FAIL', error.message);
  }

  // Test 3.5: Get Trip Click History
  if (createdTripId) {
    try {
      const response = await request(API_BASE_URL)
        .get(`/api/analytics/affiliate/trip/${createdTripId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200)
        .expect('Content-Type', /json/);

      const clickCount = response.body.clicks?.length || 0;
      logTest('3.5 Get Trip Click History', 'PASS', `Count: ${clickCount}`);
    } catch (error) {
      logTest('3.5 Get Trip Click History', 'FAIL', error.message);
    }
  }
}

// ============================================================================
// TEST: Error Scenarios
// ============================================================================
async function testErrorScenarios() {
  logSection('4. Error Scenario Tests');

  // Test 4.1: 401 Unauthorized (No Token)
  try {
    await request(API_BASE_URL).get('/api/trips').expect(401);
    logTest('4.1 Error: 401 Unauthorized', 'PASS', 'Correctly rejected request without token');
  } catch (error) {
    logTest('4.1 Error: 401 Unauthorized', 'FAIL', error.message);
  }

  // Test 4.2: 401 Unauthorized (Invalid Token)
  try {
    await request(API_BASE_URL)
      .get('/api/trips')
      .set('Authorization', 'Bearer invalid-token-12345')
      .expect(401);
    logTest('4.2 Error: Invalid Token', 'PASS', 'Correctly rejected invalid token');
  } catch (error) {
    logTest('4.2 Error: Invalid Token', 'FAIL', error.message);
  }

  // Test 4.3: 404 Not Found (Non-existent Trip)
  try {
    await request(API_BASE_URL)
      .get('/api/trips/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .expect(404);
    logTest('4.3 Error: 404 Not Found', 'PASS', 'Correctly returned 404 for non-existent trip');
  } catch (error) {
    logTest('4.3 Error: 404 Not Found', 'FAIL', error.message);
  }

  // Test 4.4: 400 Bad Request (Invalid Data)
  try {
    await request(API_BASE_URL)
      .post('/api/trips')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        destination: '', // Invalid: empty destination
        startDate: 'invalid-date',
        endDate: '2026-01-01',
      })
      .expect(400);
    logTest('4.4 Error: 400 Bad Request', 'PASS', 'Correctly validated request data');
  } catch (error) {
    logTest('4.4 Error: 400 Bad Request', 'FAIL', error.message);
  }

  // Test 4.5: 400 Login with Wrong Password
  try {
    await request(API_BASE_URL)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrong-password',
      })
      .expect(401);
    logTest('4.5 Error: Wrong Password', 'PASS', 'Correctly rejected wrong password');
  } catch (error) {
    logTest('4.5 Error: Wrong Password', 'FAIL', error.message);
  }
}

// ============================================================================
// CLEANUP: Delete Test Data
// ============================================================================
async function cleanupTestData() {
  logSection('5. Cleanup Test Data');

  // Delete created trip
  if (createdTripId) {
    try {
      await request(API_BASE_URL)
        .delete(`/api/trips/${createdTripId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(204);
      logTest('5.1 Delete Test Trip', 'PASS', `Trip ID: ${createdTripId}`);
    } catch (error) {
      logTest('5.1 Delete Test Trip', 'FAIL', error.message);
    }
  }

  logInfo('Note: Test user will remain in database for manual cleanup if needed');
  logInfo(`Test user email: ${testUser.email}`);
}

// ============================================================================
// PRINT TEST SUMMARY
// ============================================================================
function printTestSummary() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 Test Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Tests:  ${testStats.total}`);
  console.log(`✅ Passed:    ${testStats.passed}`);
  console.log(`❌ Failed:    ${testStats.failed}`);
  console.log(`📈 Success Rate: ${((testStats.passed / testStats.total) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📅 Test completed at: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (testStats.failed > 0) {
    process.exit(1);
  }
}

// Run the test suite
runE2ETests();
