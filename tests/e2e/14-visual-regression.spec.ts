import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, API_URL, WORKERS, TIMEOUTS, VIEWPORTS } from '../helpers/constants';
import { SEL } from '../helpers/selectors';

// ---------------------------------------------------------------------------
// TC-22: Visual Regression Tests (screenshot comparison)
//
// Worker: W12 (test-w12@test.com / Test1234!@)
// Pre-seeded trips: 도쿄 (upcoming), 바르셀로나 (completed)
//
// First run creates baseline screenshots in
//   tests/e2e/__screenshots__/
// Subsequent runs compare against baselines.
// ---------------------------------------------------------------------------

const W12 = WORKERS.W12;

const STORAGE_KEYS = {
  AUTH_TOKEN: '@travelplanner:auth_token',
  REFRESH_TOKEN: '@travelplanner:refresh_token',
};

/** Theme storage key used by the app's ThemeContext */
const THEME_STORAGE_KEY = '@travel_planner_theme';

/** Default screenshot comparison options — 5 % pixel tolerance. */
const SCREENSHOT_OPTS = { maxDiffPixelRatio: 0.05 } as const;

/** How long to wait for React Native Web rendering to stabilise. */
const STABLE_RENDER_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clear all auth state so the app behaves as a first-time visitor.
 * The page must already be navigated to the base URL origin.
 */
async function clearAuth(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* no-op in RN Web when storage is unavailable */
    }
  });
}

/**
 * Navigate past onboarding (skip) to reach the login screen.
 * Expects the page to already be at a cleared-auth state.
 */
async function skipOnboardingToLogin(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const skipBtn = page.locator(SEL.auth.skipButton).first();
  try {
    await skipBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.SHORT });
    await skipBtn.click();
  } catch {
    // Onboarding may not appear if already dismissed — fall through
  }

  // Wait for login screen to stabilise
  await page.locator(SEL.auth.emailInput).first().waitFor({
    state: 'visible',
    timeout: TIMEOUTS.MEDIUM,
  });
}

/**
 * Login via API and inject the token into localStorage, then reload.
 * Returns the page in an authenticated + home-screen-visible state.
 */
async function loginAsW12(page: Page) {
  const loginRes = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: W12.email, password: W12.password },
  });
  const auth = await loginRes.json();
  const token = auth.accessToken || auth.access_token;

  // Navigate to the base URL first so localStorage is accessible
  await page.goto(BASE_URL, { waitUntil: 'commit' });

  await page.evaluate(
    ({ t, keys }) => {
      try {
        localStorage.setItem(keys.AUTH_TOKEN, t);
        localStorage.setItem(keys.REFRESH_TOKEN, '');
      } catch {
        /* no-op */
      }
    },
    { t: token, keys: STORAGE_KEYS },
  );

  // Reload so the React app reads the injected token
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(STABLE_RENDER_MS);
}

/**
 * Wait for all animations / lazy-loaded content to settle before
 * taking a screenshot.
 */
async function waitForStableRender(page: Page, ms = STABLE_RENDER_MS) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// beforeEach — navigate to base URL and inject auth so that tests relying
// on authenticated state start correctly.  Individual tests that need
// unauthenticated state will call clearAuth() explicitly.
// ---------------------------------------------------------------------------
test.beforeEach(async ({ page }) => {
  // Obtain a fresh token via API
  const loginRes = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: W12.email, password: W12.password },
  });
  const auth = await loginRes.json();
  const token = auth.accessToken || auth.access_token;

  // Navigate first — localStorage is only accessible when page has an origin
  await page.goto(BASE_URL, { waitUntil: 'commit' });

  // Inject auth token into localStorage
  await page.evaluate(
    ({ accessToken, refreshToken, keys }) => {
      localStorage.setItem(keys.AUTH_TOKEN, accessToken);
      localStorage.setItem(keys.REFRESH_TOKEN, refreshToken);
    },
    {
      accessToken: token,
      refreshToken: '',
      keys: STORAGE_KEYS,
    },
  );
});

// ===========================================================================
// TC-22: 비주얼 리그레션 (Visual Regression) @visual
// ===========================================================================
test.describe('TC-22: 비주얼 리그레션 (Visual Regression) @visual', () => {
  // ──────────────────────────────────────────────────────────────
  // 22.1 온보딩 화면 스크린샷 (Onboarding screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.1 온보딩 화면 스크린샷 (Onboarding screenshot)', async ({ page }) => {
    // Clear auth so the app shows the onboarding flow
    await clearAuth(page);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(STABLE_RENDER_MS);

    // --- Slide 1 ---
    // Wait for the first onboarding slide title to appear
    await expect(
      page.getByText('AI 여행 플래너').or(page.getByText('AI Travel Planner')).first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('onboarding-slide1.png', SCREENSHOT_OPTS);

    // --- Slide 2 ---
    const nextBtn = page.locator(SEL.auth.nextButton).first();
    await expect(nextBtn).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await expect(
      page.getByText('나만의 여행').or(page.getByText('Your Own Trip')).first(),
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('onboarding-slide2.png', SCREENSHOT_OPTS);

    // --- Slide 3 ---
    const nextBtn2 = page.locator(SEL.auth.nextButton).first();
    await nextBtn2.click();
    await page.waitForTimeout(1000);
    await expect(
      page.getByText('스마트 정보').or(page.getByText('Smart Info')).first(),
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('onboarding-slide3.png', SCREENSHOT_OPTS);
  });

  // ──────────────────────────────────────────────────────────────
  // 22.2 로그인 화면 스크린샷 (Login screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.2 로그인 화면 스크린샷 (Login screenshot)', async ({ page }) => {
    await clearAuth(page);
    await skipOnboardingToLogin(page);

    // Ensure the login form is fully rendered
    await expect(
      page.locator(SEL.auth.emailInput).first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('login-screen.png', {
      ...SCREENSHOT_OPTS,
      fullPage: true,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.3 회원가입 화면 스크린샷 (Register screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.3 회원가입 화면 스크린샷 (Register screenshot)', async ({ page }) => {
    await clearAuth(page);
    await skipOnboardingToLogin(page);

    // Navigate to register screen from login
    const registerLink = page.locator(SEL.auth.registerButton).first();
    await registerLink.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await registerLink.click();
    await page.waitForTimeout(1000);

    // Wait for the register form to appear — check for name input or register title
    await expect(
      page.locator(SEL.auth.nameInput)
        .or(page.getByText('회원가입', { exact: false }))
        .first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('register-screen.png', {
      ...SCREENSHOT_OPTS,
      fullPage: true,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.4 홈 화면 스크린샷 (Home screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.4 홈 화면 스크린샷 (Home screenshot)', async ({ page }) => {
    await loginAsW12(page);

    // Wait for home content to load (new trip button, which is language-agnostic)
    await expect(
      page.locator(SEL.home.newTripButton).first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // Wait for images and dynamic content to settle
    await waitForStableRender(page);

    // Mask dynamic elements that change between runs (dates, greeting time)
    const dynamicMasks = [
      page.locator('[data-testid="dynamic-date"]'),
      page.locator('[data-testid="greeting-time"]'),
    ];

    await expect(page).toHaveScreenshot('home-screen.png', {
      ...SCREENSHOT_OPTS,
      mask: dynamicMasks,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.5 여행 생성 화면 스크린샷 (Create trip screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.5 여행 생성 화면 스크린샷 (Create trip screenshot)', async ({ page }) => {
    await loginAsW12(page);

    // Click the new trip button on the home screen
    const newTripBtn = page.locator(SEL.home.newTripButton).first();
    await newTripBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await newTripBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for the create trip form to load (destination input or quick-pick grid)
    await expect(
      page.locator(SEL.create.destinationInput)
        .or(page.locator(SEL.create.submitButton))
        .first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('create-trip-screen.png', {
      ...SCREENSHOT_OPTS,
      fullPage: true,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.6 여행 목록 화면 스크린샷 (Trip list screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.6 여행 목록 화면 스크린샷 (Trip list screenshot)', async ({ page }) => {
    await loginAsW12(page);

    // Navigate to the Trips tab
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await tripsTab.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await tripsTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for trip cards to load (W12 has 2 pre-seeded trips)
    await page.locator(SEL.list.tripCard).first().waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MEDIUM,
    });
    await waitForStableRender(page);

    // Mask dynamic dates and D-Day counters on trip cards
    const dynamicMasks = [
      page.locator('[data-testid="trip-dday"]'),
      page.locator('[data-testid="dynamic-date"]'),
    ];

    await expect(page).toHaveScreenshot('trip-list-screen.png', {
      ...SCREENSHOT_OPTS,
      mask: dynamicMasks,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.7 여행 상세 화면 스크린샷 (Trip detail screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.7 여행 상세 화면 스크린샷 (Trip detail screenshot)', async ({ page }) => {
    await loginAsW12(page);

    // Navigate to the Trips tab
    const tripsTab = page.locator(SEL.nav.tripsTab).first();
    await tripsTab.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await tripsTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for trip cards and click the 도쿄 (upcoming) trip
    await page.locator(SEL.list.tripCard).first().waitFor({
      state: 'visible',
      timeout: TIMEOUTS.MEDIUM,
    });
    const tokyoCard = page.locator(SEL.list.tripCard).filter({ hasText: '도쿄' }).first();
    await tokyoCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for the detail screen: hero image and/or Day 1 header
    await expect(
      page.locator(SEL.detail.heroImage)
        .or(page.getByText(/Day 1/i).first())
        .first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    // Mask dynamic elements (dates, weather, time zone info)
    const dynamicMasks = [
      page.locator('[data-testid="dynamic-date"]'),
      page.locator('[data-testid="weather-info"]'),
      page.locator('[data-testid="timezone-info"]'),
      page.locator('[data-testid="trip-dday"]'),
    ];

    await expect(page).toHaveScreenshot('trip-detail-screen.png', {
      ...SCREENSHOT_OPTS,
      mask: dynamicMasks,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.8 프로필 화면 스크린샷 (Profile screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.8 프로필 화면 스크린샷 (Profile screenshot)', async ({ page }) => {
    await loginAsW12(page);

    // Navigate to Profile tab
    const profileTab = page.locator(SEL.nav.profileTab).first();
    await profileTab.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await profileTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Wait for profile info to load
    await expect(
      page.getByText(W12.name).or(page.locator(SEL.profile.nameDisplay).first()).first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    await expect(page).toHaveScreenshot('profile-screen.png', {
      ...SCREENSHOT_OPTS,
      fullPage: true,
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 22.9 다크 모드 홈 스크린샷 (Dark mode home screenshot)
  //
  // The app supports dark mode via ThemeContext + Switch in ProfileScreen.
  // We enable dark mode by injecting the theme storage key directly into
  // localStorage, which is more reliable than clicking the Switch toggle
  // (React Native Web renders Switch as an opaque element that may not
  // respond to standard Playwright click selectors).
  // ──────────────────────────────────────────────────────────────
  test('22.9 다크 모드 홈 스크린샷 (Dark mode home screenshot)', async ({ page }) => {
    // Login first to get auth set up
    const loginRes = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: W12.email, password: W12.password },
    });
    const auth = await loginRes.json();
    const token = auth.accessToken || auth.access_token;

    // Navigate to set localStorage
    await page.goto(BASE_URL, { waitUntil: 'commit' });

    // Inject both auth token and dark mode preference
    await page.evaluate(
      ({ t, keys, themeKey }) => {
        try {
          localStorage.setItem(keys.AUTH_TOKEN, t);
          localStorage.setItem(keys.REFRESH_TOKEN, '');
          localStorage.setItem(themeKey, 'dark');
        } catch {
          /* no-op */
        }
      },
      { t: token, keys: STORAGE_KEYS, themeKey: THEME_STORAGE_KEY },
    );

    // Reload so the app picks up both auth and dark mode from localStorage
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(STABLE_RENDER_MS);

    // Wait for home content in dark mode
    await expect(
      page.locator(SEL.home.newTripButton).first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    // Mask dynamic content
    const dynamicMasks = [
      page.locator('[data-testid="dynamic-date"]'),
      page.locator('[data-testid="greeting-time"]'),
    ];

    await expect(page).toHaveScreenshot('home-dark-mode.png', {
      ...SCREENSHOT_OPTS,
      mask: dynamicMasks,
    });

    // Cleanup: reset theme to light via localStorage
    await page.evaluate(
      ({ themeKey }) => {
        try {
          localStorage.setItem(themeKey, 'light');
        } catch {
          /* no-op */
        }
      },
      { themeKey: THEME_STORAGE_KEY },
    );
  });

  // ──────────────────────────────────────────────────────────────
  // 22.10 반응형 태블릿 홈 스크린샷 (Tablet viewport screenshot)
  // ──────────────────────────────────────────────────────────────
  test('22.10 반응형 태블릿 홈 스크린샷 (Tablet viewport screenshot)', async ({ page }) => {
    // Set viewport to tablet dimensions BEFORE navigating
    await page.setViewportSize(VIEWPORTS.TABLET);

    await loginAsW12(page);

    // Wait for home content to load at tablet resolution
    await expect(
      page.locator(SEL.home.newTripButton).first(),
    ).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await waitForStableRender(page);

    // Mask dynamic elements
    const dynamicMasks = [
      page.locator('[data-testid="dynamic-date"]'),
      page.locator('[data-testid="greeting-time"]'),
    ];

    await expect(page).toHaveScreenshot('home-tablet.png', {
      ...SCREENSHOT_OPTS,
      mask: dynamicMasks,
    });
  });
});
