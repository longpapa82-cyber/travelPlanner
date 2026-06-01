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

// Feature flag: enables subscription UI (PaywallModal, SubscriptionScreen)
export const PREMIUM_ENABLED = true;

// Maximum AI trip duration in days (inclusive of start and end date).
// Mirror of backend MAX_AI_TRIP_DAYS (backend/src/trips/constants.ts). The
// backend is authoritative; this value only drives inline UX validation so the
// user gets feedback before the request round-trips. Keep both in sync.
export const MAX_AI_TRIP_DAYS = 31;

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@travelplanner:auth_token',
  REFRESH_TOKEN: '@travelplanner:refresh_token',
  USER_DATA: '@travelplanner:user_data',
  LANGUAGE: '@travelplanner:language',
  SESSION_FLAG: '@travelplanner:is_logged_in',
};
