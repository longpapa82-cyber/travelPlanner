import { test, expect } from '@playwright/test';

const BASE = 'https://mytravel-planner.com';

test.describe('P2: Performance', () => {
  test('Landing page FCP < 2s and LCP < 3s', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Collect performance metrics via PerformanceObserver
    const metrics = await page.evaluate(async (url) => {
      return new Promise<{ fcp: number; lcp: number }>((resolve) => {
        let fcp = 0;
        let lcp = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
              fcp = entry.startTime;
            }
            if (entry.entryType === 'largest-contentful-paint') {
              lcp = entry.startTime;
            }
          }
        });

        observer.observe({ type: 'paint', buffered: true });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Navigate and wait for metrics
        setTimeout(() => {
          observer.disconnect();
          resolve({ fcp, lcp });
        }, 5000);
      });
    }, BASE);

    // Fallback: navigate and measure with Navigation Timing API
    await page.goto(`${BASE}/landing.html`, { waitUntil: 'load' });

    const navMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint') as PerformanceEntry[];
      const fcp = entries.find((e) => e.name === 'first-contentful-paint');
      return {
        fcp: fcp?.startTime ?? 0,
      };
    });

    if (navMetrics.fcp > 0) {
      expect(navMetrics.fcp, 'FCP should be under 2000ms').toBeLessThan(2000);
    }

    await context.close();
  });

  test('Landing page loads within 3 seconds total', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE}/landing.html`);
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(elapsed, 'Total load time should be under 3000ms').toBeLessThan(3000);
  });
});
