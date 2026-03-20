import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P2: 404 Error Handling', () => {
  test('Non-existent page returns appropriate error', async ({ request }) => {
    const res = await request.get(`${BASE}/this-page-definitely-does-not-exist-12345`, {
      maxRedirects: 0,
    });

    // Should return 404 or redirect to app (not 500)
    const status = res.status();
    expect(status, 'Should not return 500 server error').not.toBe(500);
    // Accept 404 or 200 (SPA fallback) or 3xx redirect
    expect([200, 301, 302, 404]).toContain(status);
  });

  test('Non-existent API route returns 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/this-route-does-not-exist-12345`);

    expect(res.status()).toBe(404);
  });
});
