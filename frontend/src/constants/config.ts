export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';

export const OAUTH_CONFIG = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID || '',
  },
};

// Feature flag: set to true after business registration (사업자 등록) to enable subscription UI
export const PREMIUM_ENABLED = false;

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@travelplanner:auth_token',
  REFRESH_TOKEN: '@travelplanner:refresh_token',
  USER_DATA: '@travelplanner:user_data',
  LANGUAGE: '@travelplanner:language',
  SESSION_FLAG: '@travelplanner:is_logged_in',
};
