import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

const STATIC_PATHS = [
  '/ads.txt',
  '/app-ads.txt',
  '/sitemap.xml',
  '/robots.txt',
  '/privacy.html',
  '/terms.html',
];

test.describe('P0: Static Assets Accessibility', () => {
  for (const path of STATIC_PATHS) {
    test(`${path} returns 200`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`);
      expect(res.status()).toBe(200);
    });
  }
});
