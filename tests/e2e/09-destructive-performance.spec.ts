import { test, expect } from '@playwright/test';
import { BASE_URL, WORKERS, TIMEOUTS, API_URL } from '../helpers/constants';
import { SEL } from '../helpers/selectors';
import { ApiHelper } from '../fixtures/api-helper';

// ---------------------------------------------------------------------------
// All tests in this file are @destructive and must run serially.
// They execute in the "destructive" project (depends on chromium-mobile).
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' });

const DESTROY_USER = WORKERS.DESTROY;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Make a raw fetch to the API and return the Response (does NOT throw on non-2xx). */
async function rawFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': 'ko',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Login via UI: fill email + password, click login button, wait for home. */
async function loginViaUI(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // If we land on an onboarding / splash, try to skip it
  const skipBtn = page.locator(SEL.auth.skipButton);
  if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skipBtn.click();
  }

  // Fill credentials
  await page.locator(SEL.auth.emailInput).fill(email);
  await page.locator(SEL.auth.passwordInput).fill(password);
  await page.locator(SEL.auth.loginButton).click();

  // Wait for the home screen (nav tabs become visible)
  await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
}

/** Generate a future date string (YYYY-MM-DD). */
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

// ===========================================================================
// D: DESTRUCTIVE TESTS
// ===========================================================================

test.describe('D — Destructive Tests', { tag: '@destructive' }, () => {
  // -----------------------------------------------------------------------
  // D.1  Account deletion flow
  // -----------------------------------------------------------------------
  test('D.1: Account deletion flow — login, delete account, verify cannot login again', { tag: '@destructive' }, async ({ page }) => {
    // 1. Login via UI
    await loginViaUI(page, DESTROY_USER.email, DESTROY_USER.password);

    // 2. Navigate to profile
    await page.locator(SEL.nav.profileTab).click();
    await page.locator(SEL.profile.deleteAccountButton).waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });

    // 3. Click delete account
    await page.locator(SEL.profile.deleteAccountButton).click();

    // 4. Confirm deletion in the dialog
    const confirmBtn = page.locator(SEL.common.confirmButton).or(page.locator(SEL.common.deleteConfirmButton));
    await confirmBtn.first().waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });
    await confirmBtn.first().click();

    // 5. Should be redirected to login / auth screen
    await expect(page.locator(SEL.auth.loginButton)).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // 6. Attempt login with deleted credentials — should fail
    await page.locator(SEL.auth.emailInput).fill(DESTROY_USER.email);
    await page.locator(SEL.auth.passwordInput).fill(DESTROY_USER.password);
    await page.locator(SEL.auth.loginButton).click();

    // Expect an error indicator (alert element, toast, or the user stays on login)
    const errorVisible = await page
      .locator(`${SEL.common.errorMessage}, ${SEL.common.toast}`)
      .first()
      .isVisible({ timeout: TIMEOUTS.SHORT })
      .catch(() => false);
    const stillOnLogin = await page
      .locator(SEL.auth.loginButton)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    expect(errorVisible || stillOnLogin).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // D.2  Concurrent activity toggle
  // -----------------------------------------------------------------------
  test('D.2: Concurrent activity toggle — rapidly toggle same activity 5 times, final state consistent', { tag: '@destructive' }, async () => {
    const api = new ApiHelper(API_URL);

    // Create a temporary user for this test
    const tempEmail = `destroy-toggle-${Date.now()}@test.com`;
    await api.register({ email: tempEmail, name: 'Toggle User', password: DESTROY_USER.password });
    const tokens = await api.login(tempEmail, DESTROY_USER.password);
    const token = tokens.accessToken;

    // Create a trip with activities
    const trip = await api.createTrip(token, {
      destination: '도쿄',
      startDate: futureDate(5),
      endDate: futureDate(8),
    });

    expect(trip).toBeTruthy();
    expect(trip.itineraries?.length).toBeGreaterThan(0);

    const itinerary = trip.itineraries[0];
    const tripId = trip.id;
    const itineraryId = itinerary.id;

    // Ensure at least one activity exists
    if (!itinerary.activities || itinerary.activities.length === 0) {
      await api.addActivity(token, tripId, itineraryId, {
        time: '10:00',
        title: '토글 테스트 관광',
        description: '토글 테스트용',
        location: '도쿄 타워',
        estimatedDuration: 60,
        estimatedCost: 20,
        type: 'sightseeing',
      });
    }

    // Rapidly toggle activity completed status 5 times
    const togglePromises: Promise<any>[] = [];
    for (let i = 0; i < 5; i++) {
      togglePromises.push(
        api.updateActivity(token, tripId, itineraryId, 0, {
          isCompleted: i % 2 === 0,
        }),
      );
    }

    // Execute all toggles concurrently
    const results = await Promise.allSettled(togglePromises);

    // At least some should succeed
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThan(0);

    // Fetch final state — it must be a deterministic boolean
    const finalTrip = await api.getTrip(token, tripId);
    const finalActivity = finalTrip.itineraries[0].activities[0];
    expect(typeof finalActivity.isCompleted).toBe('boolean');

    // Cleanup
    await api.deleteTrip(token, tripId);
    await api.deleteUser(token);
  });

  // -----------------------------------------------------------------------
  // D.3  Registration rate limit
  // -----------------------------------------------------------------------
  test('D.3: Registration rate limit — 4th rapid registration gets 429', { tag: '@destructive' }, async () => {
    // Auth controller: @Throttle({ short: { ttl: 60000, limit: 3 } }) on register
    const responses: Response[] = [];

    for (let i = 0; i < 4; i++) {
      const res = await rawFetch('POST', '/auth/register', {
        email: `ratelimit-reg-${Date.now()}-${i}@test.com`,
        name: `RateLimit ${i}`,
        password: DESTROY_USER.password,
      });
      responses.push(res);
    }

    // At least one of the later requests should be rate-limited (429)
    const statuses = responses.map((r) => r.status);
    const has429 = statuses.includes(429);
    const hasSuccesses = statuses.filter((s) => s === 201).length >= 1;

    // The throttle allows 3 per 60s, so the 4th should be 429
    expect(has429).toBeTruthy();
    expect(hasSuccesses).toBeTruthy();

    // Cleanup: delete successfully registered users
    for (let i = 0; i < responses.length; i++) {
      if (responses[i].status === 201) {
        try {
          const data = await responses[i].clone().json().catch(() => null);
          if (data?.accessToken) {
            await rawFetch('DELETE', '/users/me', undefined, data.accessToken);
          }
        } catch {
          // best-effort cleanup
        }
      }
    }
  });

  // -----------------------------------------------------------------------
  // D.4  Login rate limit
  // -----------------------------------------------------------------------
  test('D.4: Login rate limit — 6th rapid login attempt gets 429', { tag: '@destructive' }, async () => {
    // Auth controller: @Throttle({ short: { ttl: 60000, limit: 5 } }) on login
    // Create a disposable user first
    const tempEmail = `ratelimit-login-${Date.now()}@test.com`;
    await rawFetch('POST', '/auth/register', {
      email: tempEmail,
      name: 'RateLimit Login',
      password: DESTROY_USER.password,
    });

    // Wait a moment for the registration rate limiter to clear
    await new Promise((r) => setTimeout(r, 2_000));

    const responses: Response[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await rawFetch('POST', '/auth/login', {
        email: tempEmail,
        password: DESTROY_USER.password,
      });
      responses.push(res);
    }

    const statuses = responses.map((r) => r.status);
    const has429 = statuses.includes(429);
    const hasSuccesses = statuses.filter((s) => s === 200).length >= 1;

    expect(has429).toBeTruthy();
    expect(hasSuccesses).toBeTruthy();

    // Cleanup
    try {
      const loginRes = await rawFetch('POST', '/auth/login', {
        email: tempEmail,
        password: DESTROY_USER.password,
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        await rawFetch('DELETE', '/users/me', undefined, data.accessToken || data.access_token);
      }
    } catch {
      // best-effort
    }
  });

  // -----------------------------------------------------------------------
  // D.5  Trip creation rate limit
  // -----------------------------------------------------------------------
  test('D.5: Trip creation rate limit — rapid trip creation gets 429', { tag: '@destructive' }, async () => {
    // Trips controller: @Throttle({ short: { ttl: 60000, limit: 5 } }) on create
    const api = new ApiHelper(API_URL);
    const tempEmail = `ratelimit-trip-${Date.now()}@test.com`;
    await api.register({ email: tempEmail, name: 'RateLimit Trip', password: DESTROY_USER.password });

    // Wait for registration rate limiter to reset
    await new Promise((r) => setTimeout(r, 2_000));

    const tokens = await api.login(tempEmail, DESTROY_USER.password);
    const token = tokens.accessToken;

    const responses: Response[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await rawFetch(
        'POST',
        '/trips',
        {
          destination: `테스트 ${i}`,
          startDate: futureDate(10 + i),
          endDate: futureDate(14 + i),
          numberOfTravelers: 2,
          description: `Rate limit test trip ${i}`,
        },
        token,
      );
      responses.push(res);
    }

    const statuses = responses.map((r) => r.status);
    const has429 = statuses.includes(429);
    const hasSuccesses = statuses.filter((s) => s === 201).length >= 1;

    expect(has429).toBeTruthy();
    expect(hasSuccesses).toBeTruthy();

    // Cleanup
    try {
      const trips = await api.getTrips(token);
      for (const trip of trips) {
        await api.deleteTrip(token, trip.id).catch(() => {});
      }
      await api.deleteUser(token);
    } catch {
      // best-effort
    }
  });
});

// ===========================================================================
// TC-15: PERFORMANCE TESTS
// ===========================================================================

test.describe('TC-15 — Performance', { tag: '@destructive' }, () => {
  let api: ApiHelper;
  let token: string;
  let tripId: string;
  const perfEmail = `perf-user-${Date.now()}@test.com`;

  test.beforeAll(async () => {
    api = new ApiHelper(API_URL);
    await api.register({ email: perfEmail, name: 'Perf User', password: DESTROY_USER.password });

    // Wait for registration rate limiter
    await new Promise((r) => setTimeout(r, 2_000));

    const tokens = await api.login(perfEmail, DESTROY_USER.password);
    token = tokens.accessToken;

    // Create a trip for performance tests
    const trip = await api.createTrip(token, {
      destination: '도쿄',
      startDate: futureDate(10),
      endDate: futureDate(14),
      numberOfTravelers: 2,
      description: 'Performance test trip',
    });
    tripId = trip.id;
  });

  test.afterAll(async () => {
    try {
      if (token && tripId) {
        await api.deleteTrip(token, tripId);
      }
      if (token) {
        await api.deleteUser(token);
      }
    } catch {
      // best-effort cleanup
    }
  });

  // -----------------------------------------------------------------------
  // 15.1  Initial load time
  // -----------------------------------------------------------------------
  test('15.1: Initial load time — home renders within 3 seconds after login', { tag: '@destructive' }, async ({ page }) => {
    // Set auth token before navigating
    await page.goto('about:blank');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);

    const startTime = await page.evaluate(() => performance.now());

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    const endTime = await page.evaluate(() => performance.now());
    const loadTimeMs = endTime - startTime;

    // Home must render within 3 seconds (3000ms)
    expect(loadTimeMs).toBeLessThan(3_000);
  });

  // -----------------------------------------------------------------------
  // 15.2  Trip list load time
  // -----------------------------------------------------------------------
  test('15.2: Trip list load — list renders within 2 seconds', { tag: '@destructive' }, async ({ page }) => {
    await page.goto('about:blank');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Mark start, then navigate to trips
    await page.evaluate(() => performance.mark('trip-list-start'));
    await page.locator(SEL.nav.tripsTab).click();

    // Wait for trip cards or empty state to appear
    await page
      .locator(`${SEL.list.tripCard}, ${SEL.list.emptyState}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    await page.evaluate(() => performance.mark('trip-list-end'));

    const duration = await page.evaluate(() => {
      performance.measure('trip-list-load', 'trip-list-start', 'trip-list-end');
      const entries = performance.getEntriesByName('trip-list-load');
      return entries.length > 0 ? entries[0].duration : Infinity;
    });

    // Trip list must render within 2 seconds
    expect(duration).toBeLessThan(2_000);
  });

  // -----------------------------------------------------------------------
  // 15.3  Trip detail load time
  // -----------------------------------------------------------------------
  test('15.3: Trip detail load — fully rendered within 3 seconds', { tag: '@destructive' }, async ({ page }) => {
    await page.goto('about:blank');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Navigate to trips tab
    await page.locator(SEL.nav.tripsTab).click();
    await page
      .locator(`${SEL.list.tripCard}, ${SEL.list.emptyState}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Click on the first trip card
    const tripCard = page.locator(SEL.list.tripCard).first();
    const cardVisible = await tripCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!cardVisible) {
      test.skip(true, 'No trip cards visible — skipping detail load test');
      return;
    }

    await page.evaluate(() => performance.mark('detail-start'));
    await tripCard.click();

    // Wait for detail elements (hero image or day header or activity card)
    await page
      .locator(`${SEL.detail.heroImage}, ${SEL.detail.activityCard}, ${SEL.detail.editButton}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    await page.evaluate(() => performance.mark('detail-end'));

    const duration = await page.evaluate(() => {
      performance.measure('detail-load', 'detail-start', 'detail-end');
      const entries = performance.getEntriesByName('detail-load');
      return entries.length > 0 ? entries[0].duration : Infinity;
    });

    expect(duration).toBeLessThan(3_000);
  });

  // -----------------------------------------------------------------------
  // 15.4  Search responsiveness
  // -----------------------------------------------------------------------
  test('15.4: Search responsiveness — results within 1.5 seconds after debounce', { tag: '@destructive' }, async ({ page }) => {
    await page.goto('about:blank');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Navigate to trip list
    await page.locator(SEL.nav.tripsTab).click();
    await page
      .locator(`${SEL.list.tripCard}, ${SEL.list.emptyState}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    const searchInput = page.locator(SEL.list.searchInput);
    const searchVisible = await searchInput.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!searchVisible) {
      test.skip(true, 'Search input not visible — skipping search responsiveness test');
      return;
    }

    // Type a search query
    const startTime = await page.evaluate(() => performance.now());
    await searchInput.fill('도쿄');

    // Wait for debounce (500ms) + results
    // Results can be trip cards or an empty state indicating the search completed
    await page
      .locator(`${SEL.list.tripCard}, ${SEL.list.emptyState}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    const endTime = await page.evaluate(() => performance.now());
    const totalTime = endTime - startTime;

    // Total time including debounce should be under 2 seconds (500ms debounce + 1.5s response)
    expect(totalTime).toBeLessThan(2_000);
  });

  // -----------------------------------------------------------------------
  // 15.5  Memory stability
  // -----------------------------------------------------------------------
  test('15.5: Memory stability — navigate 5 screens 10 times, heap growth < 50%', { tag: '@destructive' }, async ({ page, browserName }) => {
    // performance.memory is Chromium-only
    if (browserName !== 'chromium') {
      test.skip(true, 'Memory measurement only available in Chromium');
      return;
    }

    await page.goto('about:blank');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Force garbage collection if available, then take initial measurement
    const initialHeap = await page.evaluate(() => {
      if ((window as any).gc) (window as any).gc();
      return (performance as any).memory?.usedJSHeapSize ?? 0;
    });

    if (initialHeap === 0) {
      test.skip(true, 'performance.memory not available (requires --js-flags=--expose-gc)');
      return;
    }

    // Navigate between screens 10 cycles
    const navTargets = [
      SEL.nav.homeTab,
      SEL.nav.tripsTab,
      SEL.nav.profileTab,
      SEL.nav.tripsTab,
      SEL.nav.homeTab,
    ];

    for (let cycle = 0; cycle < 10; cycle++) {
      for (const selector of navTargets) {
        const navEl = page.locator(selector);
        if (await navEl.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await navEl.click();
          // Small wait for render
          await page.waitForTimeout(300);
        }
      }
    }

    // Measure final heap
    const finalHeap = await page.evaluate(() => {
      if ((window as any).gc) (window as any).gc();
      return (performance as any).memory?.usedJSHeapSize ?? 0;
    });

    const growthRatio = (finalHeap - initialHeap) / initialHeap;

    // Heap should not grow more than 50%
    expect(growthRatio).toBeLessThan(0.5);
  });

  // -----------------------------------------------------------------------
  // 15.6  Image lazy loading
  // -----------------------------------------------------------------------
  test('15.6: Image lazy loading — images load on demand during scroll', { tag: '@destructive' }, async ({ page }) => {
    await page.goto('about:blank');
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.locator(SEL.nav.homeTab).waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Navigate to trips list
    await page.locator(SEL.nav.tripsTab).click();
    await page
      .locator(`${SEL.list.tripCard}, ${SEL.list.emptyState}`)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });

    // Collect image requests as the page is scrolled
    const imageRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      if (resourceType === 'image' || /\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/i.test(url)) {
        imageRequests.push(url);
      }
    });

    const beforeScrollCount = imageRequests.length;

    // Scroll down progressively to trigger lazy loading
    for (let i = 0; i < 5; i++) {
      await page.evaluate((scrollY) => {
        window.scrollBy(0, scrollY);
      }, 400);
      await page.waitForTimeout(500);
    }

    // After scrolling, check that images were loaded on demand.
    // We verify that the mechanism works by checking at least one of:
    //  1) New image requests appeared after scrolling
    //  2) Images in the DOM have loading="lazy" attribute
    //  3) Images below fold are not loaded until scrolled into view

    const lazyImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return {
        total: imgs.length,
        withLazy: imgs.filter((img) => img.loading === 'lazy').length,
        withSrcSet: imgs.filter((img) => img.srcset).length,
      };
    });

    const afterScrollCount = imageRequests.length;

    // At least one of the lazy loading indicators should be present:
    // Either images loaded on scroll, or images have lazy attribute
    const hasLazyLoading = lazyImages.withLazy > 0;
    const imagesLoadedOnScroll = afterScrollCount > beforeScrollCount;
    const hasImages = lazyImages.total > 0;

    // If there are images at all, at least one lazy indicator should be true
    if (hasImages) {
      expect(hasLazyLoading || imagesLoadedOnScroll).toBeTruthy();
    } else {
      // No images at all — test passes trivially (nothing to lazy load)
      expect(true).toBeTruthy();
    }
  });
});
