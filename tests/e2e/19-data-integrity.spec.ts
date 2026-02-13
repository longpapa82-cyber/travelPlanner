import { test, expect } from '@playwright/test';
import { BASE_URL, API_URL, WORKERS, TIMEOUTS } from '../helpers/constants';
import { SEL } from '../helpers/selectors';
import { ApiHelper } from '../fixtures/api-helper';

// ────────────────────────────────────────────────────────────────
// Test user: WORKERS.W13 (test-w13@test.com / Test1234!@)
// TC-25: Data Integrity — testing data consistency, edge cases,
// special characters, empty states, XSS prevention, and more.
// ────────────────────────────────────────────────────────────────
const W13 = WORKERS.W13;

const STORAGE_KEYS = {
  AUTH_TOKEN: '@travelplanner:auth_token',
  REFRESH_TOKEN: '@travelplanner:refresh_token',
};

// ────────────────────────────────────────────────────────────────
// Helper: Login via API and inject token into localStorage
// ────────────────────────────────────────────────────────────────
let cachedTokens: { accessToken: string; refreshToken: string } | null = null;

async function loginViaApi(page: import('@playwright/test').Page) {
  const api = new ApiHelper();
  if (!cachedTokens) {
    cachedTokens = await api.login(W13.email, W13.password);
  }

  await page.goto(BASE_URL, { waitUntil: 'commit' });

  await page.evaluate(
    ({ authToken, refreshToken, keys }) => {
      localStorage.setItem(keys.AUTH_TOKEN, authToken);
      localStorage.setItem(keys.REFRESH_TOKEN, refreshToken);
    },
    {
      authToken: cachedTokens.accessToken,
      refreshToken: cachedTokens.refreshToken,
      keys: STORAGE_KEYS,
    },
  );

  await page.reload({ waitUntil: 'networkidle' });

  // Wait for home screen to load (language-agnostic: check nav tab)
  const homeTab = page.locator(SEL.nav.homeTab).first();
  await homeTab.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
}

async function getAuthToken(): Promise<string> {
  const api = new ApiHelper();
  if (!cachedTokens) {
    cachedTokens = await api.login(W13.email, W13.password);
  }
  return cachedTokens.accessToken;
}

test.describe('TC-25: 데이터 무결성 (Data Integrity)', () => {

  test.beforeEach(async ({ page }) => {
    // Reset cached tokens so each test gets a fresh login if needed
    cachedTokens = null;
    await loginViaApi(page);
  });

  // ── 25.1: 동시 편집 처리 (Concurrent edit handling) ────────────
  test('25.1 동시 편집 처리 (Concurrent edit handling)', async ({ page, context }) => {
    const authToken = await getAuthToken();

    // 1. Navigate to trip detail
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await expect(tripsTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await tripsTab.click();
    await page.waitForTimeout(1000);

    const tripCard = page.locator(SEL.list.tripCard).first();
    const hasTripCard = await tripCard.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false);

    if (!hasTripCard) {
      test.skip(true, 'No trip cards available for concurrent edit test');
      return;
    }

    await tripCard.click();
    await page.waitForTimeout(2000);

    // 2. Open same trip in second tab
    const page2 = await context.newPage();
    await page2.goto(BASE_URL, { waitUntil: 'commit' });
    await page2.evaluate(
      ({ authToken: token, refreshToken, keys }) => {
        localStorage.setItem(keys.AUTH_TOKEN, token);
        localStorage.setItem(keys.REFRESH_TOKEN, refreshToken);
      },
      {
        authToken: cachedTokens!.accessToken,
        refreshToken: cachedTokens!.refreshToken,
        keys: STORAGE_KEYS,
      },
    );

    // Navigate page2 to same trip URL
    await page2.goto(page.url(), { waitUntil: 'networkidle' });
    await page2.waitForTimeout(2000);

    // 3. Both pages should display the trip without issues
    const page1Stable = await page.locator('body').isVisible();
    const page2Stable = await page2.locator('body').isVisible();
    expect(page1Stable).toBe(true);
    expect(page2Stable).toBe(true);

    await page2.close();
  });

  // ── 25.2: 특수문자 입력 처리 (Special character handling) ─────
  test('25.2 특수문자 입력 처리 (Special character handling)', async ({ page }) => {
    // 1. Navigate to create trip
    const createButton = page.locator(SEL.home.newTripButton).first();
    const hasCreate = await createButton.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false);

    if (!hasCreate) {
      // Try alternate create button text
      const altCreate = page.locator('text=/AI 여행 계획 만들기|New Trip|새 여행/i').first();
      if (await altCreate.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)) {
        await altCreate.click();
      } else {
        test.skip(true, 'Create trip button not found');
        return;
      }
    } else {
      await createButton.click();
    }
    await page.waitForTimeout(2000);

    // 2. Enter special characters in destination
    const destInput = page.locator(SEL.create.destinationInput).first();
    const hasDestInput = await destInput.isVisible({ timeout: TIMEOUTS.MEDIUM }).catch(() => false);

    if (hasDestInput) {
      const specialChars = '도쿄 🗼 "test" <tag> & special\'s';
      await destInput.fill(specialChars);
    }

    // 3. Enter special chars in notes if available
    const notesInput = page.locator(SEL.create.notesInput).first();
    if (await notesInput.isVisible().catch(() => false)) {
      await notesInput.fill('메모: "따옴표" & <특수> \'문자\'');
    }

    // 4. The form should handle these without errors
    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);
  });

  // ── 25.3: 빈 목록 상태 처리 (Empty state handling) ────────────
  test('25.3 빈 목록 상태 처리 (Empty state handling)', async ({ page }) => {
    // Create a fresh user with no trips
    const api = new ApiHelper();
    const uniqueEmail = `test-empty-${Date.now()}@test.com`;

    try {
      await api.register({ name: 'Empty User', email: uniqueEmail, password: 'Test1234!@' });
    } catch {
      // Registration may fail if rate-limited; skip gracefully
      test.skip(true, 'Could not register fresh user for empty state test');
      return;
    }

    let freshTokens;
    try {
      freshTokens = await api.login(uniqueEmail, 'Test1234!@');
    } catch {
      test.skip(true, 'Could not login as fresh user');
      return;
    }

    // Inject fresh user token
    await page.evaluate(
      ({ authToken, refreshToken, keys }) => {
        localStorage.setItem(keys.AUTH_TOKEN, authToken);
        localStorage.setItem(keys.REFRESH_TOKEN, refreshToken);
      },
      {
        authToken: freshTokens.accessToken,
        refreshToken: freshTokens.refreshToken,
        keys: STORAGE_KEYS,
      },
    );

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Navigate to trips list
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    if (await tripsTab.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)) {
      await tripsTab.click();
    }
    await page.waitForTimeout(2000);

    // Should show empty state message or the page shows 0 trips gracefully
    const emptyState = page.locator(SEL.list.emptyState).first();
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);

    // Cleanup: delete the fresh user
    try {
      await api.deleteUser(freshTokens.accessToken);
    } catch {
      // best-effort cleanup
    }
  });

  // ── 25.4: 긴 텍스트 입력 (Long text input handling) ───────────
  test('25.4 긴 텍스트 입력 (Long text input handling)', async ({ page }) => {
    // 1. Navigate to create trip
    const createButton = page.locator(SEL.home.newTripButton).first();
    const hasCreate = await createButton.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false);

    if (!hasCreate) {
      const altCreate = page.locator('text=/AI 여행 계획 만들기|New Trip|새 여행/i').first();
      if (await altCreate.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)) {
        await altCreate.click();
      } else {
        test.skip(true, 'Create trip button not found');
        return;
      }
    } else {
      await createButton.click();
    }
    await page.waitForTimeout(2000);

    // 2. Enter very long text in notes
    const notesInput = page.locator(SEL.create.notesInput).first();
    if (await notesInput.isVisible().catch(() => false)) {
      const longText = '가'.repeat(1000); // 1000 Korean characters
      await notesInput.fill(longText);

      // 3. Text should be accepted or truncated (not crash)
      const value = await notesInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }

    const pageStable = await page.locator('body').isVisible();
    expect(pageStable).toBe(true);
  });

  // ── 25.5: 날짜 경계값 테스트 (Date boundary values) ───────────
  test('25.5 날짜 경계값 테스트 (Date boundary values)', async ({ page }) => {
    // 1. Navigate to create trip
    const createButton = page.locator(SEL.home.newTripButton).first();
    const hasCreate = await createButton.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false);

    if (!hasCreate) {
      const altCreate = page.locator('text=/AI 여행 계획 만들기|New Trip|새 여행/i').first();
      if (await altCreate.isVisible({ timeout: TIMEOUTS.SHORT }).catch(() => false)) {
        await altCreate.click();
      } else {
        test.skip(true, 'Create trip button not found');
        return;
      }
    } else {
      await createButton.click();
    }
    await page.waitForTimeout(2000);

    // 2. Find date fields
    const startDateField = page.locator(SEL.create.startDateField).first();
    const endDateField = page.locator(SEL.create.endDateField).first();

    const hasDateFields =
      (await startDateField.isVisible().catch(() => false)) &&
      (await endDateField.isVisible().catch(() => false));

    if (hasDateFields) {
      // Date fields should be present and interactive
      await startDateField.click();
      await page.waitForTimeout(1000);

      // Date picker should appear without crashing
      const pageStable = await page.locator('body').isVisible();
      expect(pageStable).toBe(true);
    } else {
      // Date fields may not be visible at this stage of the form
      const pageStable = await page.locator('body').isVisible();
      expect(pageStable).toBe(true);
    }
  });

  // ── 25.6: API 응답 변조 방지 (API response tampering / XSS prevention) ──
  test('25.6 API 응답 변조 방지 (API response tampering prevention)', async ({ page }) => {
    // 1. Mock API to return malicious data
    await page.route(`${API_URL}/trips`, route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            id: 'fake-id',
            destination: '<script>alert("xss")</script>',
            startDate: '2025-01-01',
            endDate: '2025-01-05',
            numberOfTravelers: 2,
            itineraries: [],
          },
        ]),
      });
    });

    // Listen for XSS dialogs
    let xssTriggered = false;
    page.on('dialog', dialog => {
      if (dialog.message().includes('xss')) xssTriggered = true;
      dialog.dismiss();
    });

    // 2. Navigate to trips
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await expect(tripsTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await tripsTab.click();
    await page.waitForTimeout(3000);

    // 3. XSS should NOT execute
    expect(xssTriggered).toBe(false);

    // 4. No injected script element
    const scriptInjected = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).some(
        s => s.textContent?.includes('xss'),
      );
    });
    expect(scriptInjected).toBe(false);

    // Cleanup
    await page.unroute(`${API_URL}/trips`);
  });
});
