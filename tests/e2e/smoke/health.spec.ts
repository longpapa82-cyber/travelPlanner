import { test, expect } from '@playwright/test';

const API = 'https://mytravel-planner.com/api';

test.describe('P0: API Health Check', () => {
  test('GET /api/health returns 200 within 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${API}/health`);
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(500);

    const body = await res.json();
    expect(body).toBeTruthy();
  });
});
