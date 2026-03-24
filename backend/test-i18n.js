const axios = require('axios');

async function testRegistration() {
  const API_URL = 'http://localhost:3000/api';

  // Test registration with duplicate email (should trigger our i18n error)
  const testEmail = 'test@example.com';

  try {
    // First, try registering with Korean language
    console.log('Testing registration with Korean language...');
    const response1 = await axios.post(
      `${API_URL}/auth/register`,
      {
        email: testEmail,
        password: 'Test1234!',
        name: 'Test User'
      },
      {
        headers: {
          'Accept-Language': 'ko'
        }
      }
    );
    console.log('First registration successful:', response1.data);

    // Try again with same email - should fail with Korean message
    console.log('\nTrying duplicate registration with Korean language...');
    await axios.post(
      `${API_URL}/auth/register`,
      {
        email: testEmail,
        password: 'Test1234!',
        name: 'Test User 2'
      },
      {
        headers: {
          'Accept-Language': 'ko'
        }
      }
    );
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('Korean error message:', error.response.data.message);
    }
  }

  // Now test with English
  try {
    console.log('\nTrying duplicate registration with English language...');
    await axios.post(
      `${API_URL}/auth/register`,
      {
        email: testEmail,
        password: 'Test1234!',
        name: 'Test User 3'
      },
      {
        headers: {
          'Accept-Language': 'en'
        }
      }
    );
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('English error message:', error.response.data.message);
    }
  }

  // Test login with wrong password
  try {
    console.log('\nTesting login with wrong password (Korean)...');
    await axios.post(
      `${API_URL}/auth/login`,
      {
        email: testEmail,
        password: 'WrongPassword123!'
      },
      {
        headers: {
          'Accept-Language': 'ko'
        }
      }
    );
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('Korean login error:', error.response.data.message);
    }
  }

  try {
    console.log('\nTesting login with wrong password (English)...');
    await axios.post(
      `${API_URL}/auth/login`,
      {
        email: testEmail,
        password: 'WrongPassword123!'
      },
      {
        headers: {
          'Accept-Language': 'en'
        }
      }
    );
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('English login error:', error.response.data.message);
    }
  }

  console.log('\n✅ i18n test completed!');
}

// Check if backend is running
axios.get('http://localhost:3000/api/health')
  .then(() => {
    console.log('Backend is running. Starting i18n tests...\n');
    testRegistration();
  })
  .catch(() => {
    console.log('❌ Backend is not running. Please start it with: npm run start:dev');
  });