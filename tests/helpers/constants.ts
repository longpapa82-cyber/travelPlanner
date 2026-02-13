export const BASE_URL = 'http://localhost:8081';
export const API_URL = 'http://localhost:3001/api';

export const TEST_PASSWORD = 'Test1234!@';

export const WORKERS = {
  W1: { email: 'test-w1@test.com', name: 'Worker1 User', password: TEST_PASSWORD },
  W2: { email: 'test-w2@test.com', name: 'Worker2 User', password: TEST_PASSWORD },
  W3: { email: 'test-w3@test.com', name: 'Worker3 User', password: TEST_PASSWORD },
  W4: { email: 'test-w4@test.com', name: 'Worker4 User', password: TEST_PASSWORD },
  W5: { email: 'test-w5@test.com', name: 'Worker5 User', password: TEST_PASSWORD },
  W6: { email: 'test-w6@test.com', name: 'Worker6 User', password: TEST_PASSWORD },
  W7: { email: 'test-w7@test.com', name: 'Worker7 User', password: TEST_PASSWORD },
  W8: { email: 'test-w8@test.com', name: 'Worker8 User', password: TEST_PASSWORD },
  W9: { email: 'test-w9@test.com', name: 'Worker9 Journey', password: TEST_PASSWORD },
  W10: { email: 'test-w10@test.com', name: 'Worker10 Lifecycle', password: TEST_PASSWORD },
  W11: { email: 'test-w11@test.com', name: 'Worker11 A11y', password: TEST_PASSWORD },
  W12: { email: 'test-w12@test.com', name: 'Worker12 Visual', password: TEST_PASSWORD },
  W13: { email: 'test-w13@test.com', name: 'Worker13 Network', password: TEST_PASSWORD },
  DESTROY: { email: 'test-destroy@test.com', name: 'Destroy User', password: TEST_PASSWORD },
};

export const TIMEOUTS = {
  SHORT: 5_000,
  MEDIUM: 15_000,
  LONG: 30_000,
  AI_GENERATION: 130_000,
  NAVIGATION: 10_000,
};

export const VIEWPORTS = {
  MOBILE: { width: 375, height: 812 },
  TABLET: { width: 768, height: 1024 },
  DESKTOP: { width: 1440, height: 900 },
};

export const DESTINATIONS = {
  TOKYO: '도쿄',
  OSAKA: '오사카',
  PARIS: '파리',
  NEWYORK: '뉴욕',
  BANGKOK: '방콕',
};

export const TRIP_STATUS = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
};
