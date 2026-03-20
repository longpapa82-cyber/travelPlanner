import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P0: Landing Pages', () => {
  test('Korean landing page loads with correct elements', async ({ page }) => {
    const res = await page.goto(`${BASE}/landing.html`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    // SEO meta tags
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    const description = page.locator('meta[name="description"]').first();
    await expect(description).toHaveAttribute('content', /.+/);

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /.+/);

    // Page should have visible content
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('English landing page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/landing-en.html`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /.+/);
  });

  test('Japanese landing page loads', async ({ page }) => {
    const res = await page.goto(`${BASE}/landing-ja.html`, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
