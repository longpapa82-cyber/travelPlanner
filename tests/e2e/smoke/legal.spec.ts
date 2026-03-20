import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P1: Legal Pages', () => {
  const pages = [
    { path: '/privacy.html', keyword: /개인정보|privacy/i },
    { path: '/terms.html', keyword: /이용약관|terms/i },
    { path: '/privacy-en.html', keyword: /privacy/i },
    { path: '/terms-en.html', keyword: /terms/i },
  ];

  for (const { path, keyword } of pages) {
    test(`${path} loads and contains relevant text`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBe(200);

      const text = await page.locator('body').innerText();
      expect(text).toMatch(keyword);
    });
  }
});
