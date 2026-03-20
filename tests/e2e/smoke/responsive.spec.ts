import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P1: Responsive Layout', () => {
  test('Mobile viewport (375px) renders without horizontal overflow', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/landing.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow, 'Page should not have horizontal overflow on mobile').toBe(false);

    await context.close();
  });

  test('Desktop viewport (1280px) renders correctly', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/landing.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    // Page should render with content visible
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    // Max-width wrapper should constrain content (project uses 600px center wrapper)
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await context.close();
  });
});
