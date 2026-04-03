/**
 * Script to test ThrottlerException logging
 * This simulates rapid signup attempts to trigger rate limiting
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function attemptSignup(index) {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: `test${index}@example.com`,
      password: 'password123',
      name: `Test User ${index}`,
    });
    console.log(`✅ Signup ${index}: Success`);
    return response.data;
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 429) {
        console.log(`⚠️  Signup ${index}: Rate limited (429) - ${data.message}`);
      } else {
        console.log(`❌ Signup ${index}: Failed (${status}) - ${data.message}`);
      }
    } else {
      console.log(`❌ Signup ${index}: Network error - ${error.message}`);
    }
    return null;
  }
}

async function testThrottlerLogging() {
  console.log('🚀 Testing ThrottlerException logging...');
  console.log(`API URL: ${API_URL}`);
  console.log('---');

  // The throttler is configured for 20 requests per minute on /auth/register
  // Let's make 25 rapid requests to trigger rate limiting
  const promises = [];
  for (let i = 1; i <= 25; i++) {
    promises.push(attemptSignup(i));
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await Promise.all(promises);

  console.log('---');
  console.log('✅ Test complete!');
  console.log('Check the admin dashboard at /admin/errors to see if 429 errors are logged.');
}

// Run the test
testThrottlerLogging().catch(console.error);