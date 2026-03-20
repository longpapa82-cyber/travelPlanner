import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P1: SEO — Sitemap URL Validation', () => {
  test('sitemap.xml contains valid URLs that return 200', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`);
    expect(res.status()).toBe(200);

    const xml = await res.text();

    // Extract all <loc> URLs
    const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
    const urls = urlMatches.map((m) => m.replace(/<\/?loc>/g, ''));

    expect(urls.length).toBeGreaterThanOrEqual(10);

    // Sample up to 15 URLs to keep test fast
    const sample = urls.sort(() => Math.random() - 0.5).slice(0, 15);

    const results: { url: string; status: number }[] = [];
    for (const url of sample) {
      const r = await request.get(url);
      results.push({ url, status: r.status() });
    }

    for (const { url, status } of results) {
      expect(status, `Expected 200 for ${url}`).toBe(200);
    }
  });
});
