// Environment detection: set PROD_TEST=1 to target production server
export const IS_PROD = process.env.PROD_TEST === '1';

export const BASE_URL = IS_PROD
  ? 'https://mytravelplanner.duckdns.org'
  : 'http://localhost:8081';

export const API_URL = IS_PROD
  ? 'https://mytravelplanner.duckdns.org/api'
  : 'http://localhost:3001/api';

export const TEST_PASSWORD = 'Test1234!@';

// Production uses 'prod-test-' prefix to isolate from real users
const EMAIL_PREFIX = IS_PROD ? 'prod-test' : 'test';

export const WORKERS = {
  W1: { email: `${EMAIL_PREFIX}-w1@test.com`, name: 'Worker1 User', password: TEST_PASSWORD },
  W2: { email: `${EMAIL_PREFIX}-w2@test.com`, name: 'Worker2 User', password: TEST_PASSWORD },
  W3: { email: `${EMAIL_PREFIX}-w3@test.com`, name: 'Worker3 User', password: TEST_PASSWORD },
  W4: { email: `${EMAIL_PREFIX}-w4@test.com`, name: 'Worker4 User', password: TEST_PASSWORD },
  W5: { email: `${EMAIL_PREFIX}-w5@test.com`, name: 'Worker5 User', password: TEST_PASSWORD },
  W6: { email: `${EMAIL_PREFIX}-w6@test.com`, name: 'Worker6 User', password: TEST_PASSWORD },
  W7: { email: `${EMAIL_PREFIX}-w7@test.com`, name: 'Worker7 User', password: TEST_PASSWORD },
  W8: { email: `${EMAIL_PREFIX}-w8@test.com`, name: 'Worker8 User', password: TEST_PASSWORD },
  W9: { email: `${EMAIL_PREFIX}-w9@test.com`, name: 'Worker9 Journey', password: TEST_PASSWORD },
  W10: { email: `${EMAIL_PREFIX}-w10@test.com`, name: 'Worker10 Lifecycle', password: TEST_PASSWORD },
  W11: { email: `${EMAIL_PREFIX}-w11@test.com`, name: 'Worker11 A11y', password: TEST_PASSWORD },
  W12: { email: `${EMAIL_PREFIX}-w12@test.com`, name: 'Worker12 Visual', password: TEST_PASSWORD },
  W13: { email: `${EMAIL_PREFIX}-w13@test.com`, name: 'Worker13 Network', password: TEST_PASSWORD },
  W14: { email: `${EMAIL_PREFIX}-w14@test.com`, name: 'Worker14 2FA', password: TEST_PASSWORD },
  W15: { email: `${EMAIL_PREFIX}-w15@test.com`, name: 'Worker15 Notify', password: TEST_PASSWORD },
  DESTROY: { email: `${EMAIL_PREFIX}-destroy@test.com`, name: 'Destroy User', password: TEST_PASSWORD },
};

// Production gets 2x timeouts for slower network + constrained server (1GB RAM)
export const TIMEOUTS = IS_PROD ? {
  SHORT: 10_000,
  MEDIUM: 20_000,
  LONG: 45_000,
  AI_GENERATION: 180_000,
  NAVIGATION: 15_000,
} : {
  SHORT: 5_000,
  MEDIUM: 15_000,
  LONG: 30_000,
  AI_GENERATION: 130_000,
  NAVIGATION: 10_000,
};

// Production app has persistent network activity (analytics, polling) that prevents
// 'networkidle' from resolving. Use 'load' which works reliably for SPAs.
export const WAIT_UNTIL = (IS_PROD ? 'load' : 'networkidle') as 'load' | 'networkidle';

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
