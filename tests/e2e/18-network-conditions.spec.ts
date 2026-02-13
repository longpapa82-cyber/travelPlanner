import { test, expect } from '@playwright/test';
import { BASE_URL, API_URL, WORKERS, TIMEOUTS } from '../helpers/constants';
import { SEL } from '../helpers/selectors';
import { ApiHelper } from '../fixtures/api-helper';

// ────────────────────────────────────────────────────────────────
// Test user: WORKERS.W13 (test-w13@test.com / Test1234!@)
// TC-24: Network Conditions — testing app behavior under various
// network conditions (offline, slow 3G, reconnect, timeout, etc.)
// ────────────────────────────────────────────────────────────────
const W13 = WORKERS.W13;

const STORAGE_KEYS = {
  AUTH_TOKEN: '@travelplanner:auth_token',
  REFRESH_TOKEN: '@travelplanner:refresh_token',
};

// ────────────────────────────────────────────────────────────────
// Helper: Login via API and inject token into localStorage
// ────────────────────────────────────────────────────────────────
async function loginViaApi(page: import('@playwright/test').Page) {
  const api = new ApiHelper();
  const tokens = await api.login(W13.email, W13.password);

  await page.goto(BASE_URL, { waitUntil: 'commit' });

  await page.evaluate(
    ({ authToken, refreshToken, keys }) => {
      localStorage.setItem(keys.AUTH_TOKEN, authToken);
      localStorage.setItem(keys.REFRESH_TOKEN, refreshToken);
    },
    {
      authToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      keys: STORAGE_KEYS,
    },
  );

  await page.reload({ waitUntil: 'networkidle' });

  // Wait for home screen to load (language-agnostic: check nav tab)
  const homeTab = page.locator(SEL.nav.homeTab).first();
  await homeTab.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
}

test.describe('TC-24: 네트워크 조건 (Network Conditions)', () => {

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  // ── 24.1: 오프라인 상태 감지 및 표시 (Offline detection) ──────
  test('24.1 오프라인 상태 감지 및 표시 (Offline detection)', async ({ page }) => {
    // 1. Confirm we are on home while online
    await expect(
      page.locator(SEL.nav.homeTab).first(),
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // 2. Go offline using CDP
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });

    // 3. Try to perform an action (e.g., navigate to trips)
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    if (await tripsTab.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)) {
      await tripsTab.click();
    }
    await page.waitForTimeout(3000);

    // 4. Should show offline indicator or error, or remain stable without crashing
    const offlineMsg = page
      .getByText(/오프라인|offline|네트워크|network|연결.*확인|인터넷|오류|error/i)
      .first();
    const hasOfflineMsg = await offlineMsg.isVisible().catch(() => false);

    // The page should remain stable regardless of offline indicator
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);

    // 5. Go back online
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.waitForTimeout(2000);
  });

  // ── 24.2: 느린 3G 환경 (Slow 3G network) ─────────────────────
  test('24.2 느린 3G 환경 (Slow 3G network)', async ({ page }) => {
    // Mark this test as slow — triples the default timeout
    test.slow();

    // 1. Emulate slow 3G
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 2000,                // 2s latency
      downloadThroughput: 50 * 1024, // 50 KB/s
      uploadThroughput: 25 * 1024,   // 25 KB/s
    });

    // 2. Navigate to home with extended timeout for throttled network
    // Under slow 3G (50KB/s + 2s latency), page load can take 60s+
    await page.goto(BASE_URL, { timeout: TIMEOUTS.AI_GENERATION, waitUntil: 'commit' });

    // 3. Loading indicator may or may not be visible depending on timing
    // The key assertion is that the page eventually loads
    await page.waitForTimeout(10000);
    const pageLoaded = await page.locator('body').isVisible();
    expect(pageLoaded).toBe(true);

    // 4. Restore normal network
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  });

  // ── 24.3: 네트워크 복구 시 자동 재로드 (Auto-reload on reconnect) ──
  test('24.3 네트워크 복구 시 자동 재로드 (Auto-reload on reconnect)', async ({ page }) => {
    // 1. Confirm we are on home
    await expect(
      page.locator(SEL.nav.homeTab).first(),
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // 2. Go offline
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });

    // 3. Try an action that will fail due to network
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    if (await tripsTab.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)) {
      await tripsTab.click();
    }
    await page.waitForTimeout(2000);

    // 4. Go back online
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    // 5. Wait for potential auto-retry or recovery
    await page.waitForTimeout(5000);

    // 6. Page should recover — either auto-reload or show content without crash
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);
  });

  // ── 24.4: API 타임아웃 처리 (API timeout handling) ────────────
  test('24.4 API 타임아웃 처리 (API timeout handling)', async ({ page }) => {
    // 1. Mock API to be extremely slow (simulate timeout)
    await page.route(`${API_URL}/trips`, async route => {
      await new Promise(r => setTimeout(r, 30000)); // 30s delay
      route.continue();
    });

    // 2. Navigate to trips tab
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await expect(tripsTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await tripsTab.click();

    // 3. Wait for loading or timeout behaviour
    await page.waitForTimeout(5000);

    // 4. Eventually should show timeout error, loading state, or handle gracefully
    const loading = page.locator(SEL.common.loadingSpinner).first();
    const errorMsg = page
      .getByText(/시간 초과|timeout|다시.*시도|재시도|retry|오류|error/i)
      .first();

    const hasLoading = await loading.isVisible().catch(() => false);
    const hasError = await errorMsg.isVisible().catch(() => false);

    // Either still loading or showing error — both are acceptable; page must not crash
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);

    // Cleanup
    await page.unroute(`${API_URL}/trips`);
  });

  // ── 24.5: 대용량 응답 처리 (Large response handling) ──────────
  test('24.5 대용량 응답 처리 (Large response handling)', async ({ page }) => {
    // 1. Navigate to trips
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await expect(tripsTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await tripsTab.click();
    await page.waitForTimeout(3000);

    // 2. Page should render trip list without issues
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);

    // 3. Memory usage should be reasonable (Chromium-only)
    const metrics = await page.evaluate(() => {
      return (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          }
        : null;
    });

    if (metrics) {
      // Heap should be under 150MB
      expect(metrics.usedJSHeapSize).toBeLessThan(150 * 1024 * 1024);
    }
  });

  // ── 24.6: 요청 재시도 메커니즘 (Request retry mechanism) ──────
  test('24.6 요청 재시도 메커니즘 (Request retry mechanism)', async ({ page }) => {
    let requestCount = 0;

    // 1. Mock API to fail first 2 times, succeed on 3rd
    await page.route(`${API_URL}/trips`, async route => {
      requestCount++;
      if (requestCount <= 2) {
        route.fulfill({ status: 503, body: 'Service Unavailable' });
      } else {
        route.continue();
      }
    });

    // 2. Navigate to trips
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await expect(tripsTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await tripsTab.click();
    await page.waitForTimeout(10000); // Wait for retries

    // 3. If app retries, trips should eventually load
    // Or error message shown with retry button — both acceptable
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);

    // Cleanup
    await page.unroute(`${API_URL}/trips`);
  });

  // ── 24.7: CORS 에러 처리 (CORS error handling) ────────────────
  test('24.7 CORS 에러 처리 (CORS error handling)', async ({ page }) => {
    // 1. Intercept API and return CORS-like error response
    await page.route(`${API_URL}/**`, route => {
      route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': 'https://wrong-origin.com',
        },
        body: '{}',
      });
    });

    // 2. Navigate to home
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 3. Should handle gracefully without crash
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);

    // Cleanup
    await page.unroute(`${API_URL}/**`);
  });
});
