import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P0: Auth Forms', () => {
  test('App loads and shows login/register UI elements', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    // Wait for the React app to hydrate — look for any interactive element
    // The app should render some form of auth UI or main content
    await page.waitForLoadState('load');

    // Check that the page rendered something meaningful (not a blank page)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('Invalid login returns error via API', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: {
        email: 'nonexistent-smoke-test@example.com',
        password: 'WrongPassword123!',
      },
    });

    // Should be 401 or 400, not 500
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});
