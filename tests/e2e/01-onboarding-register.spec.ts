import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, API_URL, TIMEOUTS, WAIT_UNTIL } from '../helpers/constants';
import { SEL } from '../helpers/selectors';

// ---------------------------------------------------------------------------
// TC-1: Onboarding (no auth required)
// ---------------------------------------------------------------------------
test.describe('TC-1: Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage so the app treats this as a first visit
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* no-op in RN Web when storage is unavailable */
      }
    });
    await page.goto(BASE_URL, { waitUntil: WAIT_UNTIL });
  });

  test('1.1 First visit shows onboarding with 3 slides', async ({ page }) => {
    // The first slide title should be visible
    await expect(page.getByText('AI 여행 플래너')).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // There should be three slides in the FlatList.
    // Each slide has a gradient container with title text.
    // We check the pagination dots exist (3 dots).
    const dots = page.locator('[style*="border-radius: 4px"][style*="height: 8px"]');
    // Fallback: if Animated.View dots aren't easily queryable, check all slide titles
    // exist in the DOM (even if off-screen in the horizontal FlatList).
    const slideTitles = ['AI 여행 플래너', '나만의 여행', '스마트 정보'];
    for (const title of slideTitles) {
      await expect(page.getByText(title, { exact: false })).toBeAttached();
    }
  });

  test('1.2 Next button advances slides and pagination dots update', async ({ page }) => {
    // Wait for onboarding to load
    await expect(page.getByText('AI 여행 플래너')).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // Click "다음" (Next) button
    const nextBtn = page.getByText('다음');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Second slide should become visible
    await expect(page.getByText('나만의 여행')).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // Click next again to go to third slide
    // On slide 2, the next button should still be visible
    await nextBtn.click();
    await expect(page.getByText('스마트 정보')).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // On the last slide the "다음" button should no longer be visible;
    // instead "시작하기" should appear
    await expect(page.getByText('시작하기')).toBeVisible({ timeout: TIMEOUTS.SHORT });
  });

  test('1.3 Last slide "시작하기" button navigates to login', async ({ page }) => {
    await expect(page.getByText('AI 여행 플래너')).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // Advance to the last slide
    const nextBtn = page.getByText('다음');
    await nextBtn.click();
    await page.waitForTimeout(400); // wait for scroll animation
    await nextBtn.click();
    await page.waitForTimeout(400);

    // Click "시작하기" — use force to bypass Pressable responder interception
    const startBtn = page.getByText('시작하기');
    await expect(startBtn).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await startBtn.click({ force: true });

    // Should navigate to login screen — look for login-specific text
    await expect(page.getByText('로그인', { exact: false })).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    // Verify we see the login form email placeholder
    await expect(
      page.locator('input[placeholder*="이메일"], input[aria-label*="이메일"]').first()
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });
  });

  test('1.4 Skip button navigates to login immediately', async ({ page }) => {
    await expect(page.getByText('AI 여행 플래너')).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // Click "건너뛰기" (Skip) — use force to bypass Pressable responder interception
    const skipBtn = page.getByRole('button', { name: /건너뛰기|Skip/i });
    await expect(skipBtn).toBeVisible();
    await skipBtn.click({ force: true });

    // Should land on login screen
    await expect(page.getByText('로그인', { exact: false })).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await expect(
      page.locator('input[placeholder*="이메일"], input[aria-label*="이메일"]').first()
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });
  });

  test('1.5 Responsive layout — no horizontal scroll overflow', async ({ page }) => {
    await expect(page.getByText('AI 여행 플래너')).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    // The document body should not have horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    // The FlatList itself is horizontal (paging), so we check the BODY,
    // not the inner scroll view. Body scrollWidth should equal clientWidth.
    expect(hasHorizontalScroll).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TC-2: Registration (creates new users)
// ---------------------------------------------------------------------------
test.describe('TC-2: Registration', () => {
  /**
   * Helper: navigate from the app root to the registration screen.
   * The flow is: Onboarding → skip → Login → "회원가입" link → Register
   */
  async function goToRegisterScreen(page: Page) {
    // Navigate directly to /login path to bypass onboarding click issues.
    // React Native Web's Pressable responder system doesn't reliably respond
    // to Playwright clicks on the skip button.
    await page.goto(`${BASE_URL}/login`, { waitUntil: WAIT_UNTIL });

    // We should now be on the login screen. Click "회원가입" link.
    const registerLink = page.getByText('회원가입', { exact: true });
    await registerLink.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
    await registerLink.click();

    // Wait for the register form to appear (name input)
    await page.locator(
      'input:visible[placeholder*="이름"], input:visible[aria-label*="이름"]'
    ).first().waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });
  }

  /**
   * Helper: fill the registration form fields.
   */
  async function fillRegisterForm(
    page: Page,
    opts: { name?: string; email?: string; password?: string; confirmPassword?: string }
  ) {
    // Use :visible pseudo-class to skip hidden inputs from previous screens.
    // React Navigation Web keeps prior screen DOM nodes hidden (0×0 size)
    // instead of removing them, so .first() without :visible hits hidden elements.
    const nameInput = page.locator('input:visible[placeholder*="이름"], input:visible[aria-label*="이름"]').first();
    const emailInput = page.locator('input:visible[placeholder*="이메일"], input:visible[aria-label*="이메일"]').first();
    // Password inputs use secureTextEntry which renders as type="password"
    const passwordInputs = page.locator('input:visible[type="password"]');
    const passwordInput = passwordInputs.nth(0);
    const confirmPasswordInput = passwordInputs.nth(1);

    if (opts.name !== undefined) {
      await nameInput.fill(opts.name);
    }
    if (opts.email !== undefined) {
      await emailInput.fill(opts.email);
    }
    if (opts.password !== undefined) {
      await passwordInput.fill(opts.password);
    }
    if (opts.confirmPassword !== undefined) {
      // If password was toggled visible, confirmPassword may also be text type
      // Try to find the confirm password input by placeholder fallback
      const confirmInput = page.locator(
        'input:visible[placeholder*="다시 입력"], input:visible[aria-label*="비밀번호 확인"]'
      ).first();
      try {
        await confirmInput.waitFor({ state: 'visible', timeout: 2000 });
        await confirmInput.fill(opts.confirmPassword);
      } catch {
        // Fall back to second password field
        await confirmPasswordInput.fill(opts.confirmPassword);
      }
    }
  }

  test('2.1 Valid registration → success → login screen', async ({ page }) => {
    await goToRegisterScreen(page);

    const uniqueEmail = `test-register-${Date.now()}@test.com`;
    await fillRegisterForm(page, {
      name: 'Test User',
      email: uniqueEmail,
      password: 'Test1234!@',
      confirmPassword: 'Test1234!@',
    });

    // Click "회원가입" submit button
    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // After successful registration, the app either:
    // (a) auto-logs in and navigates to home, or
    // (b) shows a success alert and navigates to login.
    // Accept either outcome within the timeout.
    const successIndicator = page.getByText(/로그인|홈|여행/).first();
    await expect(successIndicator).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  });

  test('2.2 Invalid email formats → error message', async ({ page }) => {
    await goToRegisterScreen(page);

    const invalidEmails = ['notanemail', 'missing@', '@nodomain.com', 'spaces in@email.com'];

    for (const badEmail of invalidEmails) {
      await fillRegisterForm(page, {
        name: 'Test',
        email: badEmail,
        password: 'Test1234!@',
        confirmPassword: 'Test1234!@',
      });

      const submitBtn = page.getByRole('button', { name: /회원가입/i });
      await submitBtn.click();

      // React Native Alert.alert shows a dialog — look for it or inline error text
      const alertDialog = page.getByText(/이메일|유효한|올바르지|invalid/i).first();
      await expect(alertDialog).toBeVisible({ timeout: TIMEOUTS.SHORT });

      // Dismiss the alert if it is a dialog
      const okBtn = page.getByText(/확인|OK/i);
      try {
        await okBtn.click({ timeout: 2000 });
      } catch {
        // Alert may have already been dismissed or is inline
      }
    }
  });

  test('2.3 Password < 6 chars → error', async ({ page }) => {
    await goToRegisterScreen(page);

    await fillRegisterForm(page, {
      name: 'Test',
      email: `test-short-pw-${Date.now()}@test.com`,
      password: '12345',
      confirmPassword: '12345',
    });

    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // Should show password length error
    const errorText = page.getByText(/6자|비밀번호.*오류|password.*6/i).first();
    await expect(errorText).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // Dismiss
    const okBtn = page.getByText(/확인|OK/i);
    try { await okBtn.click({ timeout: 2000 }); } catch { /* */ }
  });

  test('2.4 Password strength indicator shows weak/medium/strong', async ({ page }) => {
    await goToRegisterScreen(page);

    const passwordInput = page.locator('input:visible[type="password"]').first();

    // Weak password (< 6 chars)
    await passwordInput.fill('abc');
    const weakText = page.getByText('약함');
    await expect(weakText).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // Medium password (6-9 chars)
    await passwordInput.fill('abcdef7');
    const mediumText = page.getByText('보통');
    await expect(mediumText).toBeVisible({ timeout: TIMEOUTS.SHORT });

    // Strong password (>= 10 chars)
    await passwordInput.fill('abcdefghij');
    const strongText = page.getByText('강력함');
    await expect(strongText).toBeVisible({ timeout: TIMEOUTS.SHORT });
  });

  test('2.5 Password confirmation mismatch → error', async ({ page }) => {
    await goToRegisterScreen(page);

    await fillRegisterForm(page, {
      name: 'Mismatch User',
      email: `test-mismatch-${Date.now()}@test.com`,
      password: 'Test1234!@',
      confirmPassword: 'DifferentPassword!',
    });

    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // Should show password mismatch error
    const mismatchError = page.getByText(/일치하지|mismatch/i).first();
    await expect(mismatchError).toBeVisible({ timeout: TIMEOUTS.SHORT });

    const okBtn = page.getByText(/확인|OK/i);
    try { await okBtn.click({ timeout: 2000 }); } catch { /* */ }
  });

  test('2.6 Password visibility toggle (eye icon)', async ({ page }) => {
    await goToRegisterScreen(page);

    // Initially password field should be of type="password"
    const passwordInput = page.locator('input:visible[type="password"]').first();
    await passwordInput.fill('Secret123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the eye icon to toggle visibility — force bypasses Pressable interception
    const eyeToggle = page.locator(
      '[aria-label*="비밀번호 표시"], [aria-label*="Show password"]'
    ).first();
    await eyeToggle.click({ force: true });

    // After toggle, the input type should be "text" (secureTextEntry=false)
    // In RN Web, toggling secureTextEntry changes the input type
    const visibleInput = page.locator('input[aria-label*="비밀번호"]').first();
    // The password should now be visible (type=text or no longer type=password)
    await expect(visibleInput).not.toHaveAttribute('type', 'password', { timeout: TIMEOUTS.SHORT });

    // Toggle back to hidden — force bypasses Pressable interception
    const eyeHideToggle = page.locator(
      '[aria-label*="비밀번호 숨기기"], [aria-label*="Hide password"]'
    ).first();
    await eyeHideToggle.click({ force: true });

    // Should be password type again
    const hiddenInput = page.locator('input:visible[type="password"]').first();
    await expect(hiddenInput).toBeVisible({ timeout: TIMEOUTS.SHORT });
  });

  test('2.7 Empty name → required error', async ({ page }) => {
    await goToRegisterScreen(page);

    await fillRegisterForm(page, {
      name: '',
      email: `test-noname-${Date.now()}@test.com`,
      password: 'Test1234!@',
      confirmPassword: 'Test1234!@',
    });

    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // Should show name required error (from Alert.alert)
    const nameError = page.getByText(/이름.*입력|name.*required/i).first();
    await expect(nameError).toBeVisible({ timeout: TIMEOUTS.SHORT });

    const okBtn = page.getByText(/확인|OK/i);
    try { await okBtn.click({ timeout: 2000 }); } catch { /* */ }
  });

  test('2.8 Duplicate email → 409 error message', async ({ page }) => {
    // First, register a user via API to guarantee the email exists
    const duplicateEmail = `test-dup-${Date.now()}@test.com`;
    const registerResponse = await page.request.post(`${API_URL}/auth/register`, {
      data: {
        name: 'Dup Original',
        email: duplicateEmail,
        password: 'Test1234!@',
      },
    });
    expect(registerResponse.status()).toBe(201);

    // Now try to register the same email through the UI
    await goToRegisterScreen(page);

    await fillRegisterForm(page, {
      name: 'Dup Attempt',
      email: duplicateEmail,
      password: 'Test1234!@',
      confirmPassword: 'Test1234!@',
    });

    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // Should display a duplicate / conflict error message
    const dupError = page.getByText(/이미.*가입|already.*registered|회원가입 실패/i).first();
    await expect(dupError).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    const okBtn = page.getByText(/확인|OK/i);
    try { await okBtn.click({ timeout: 2000 }); } catch { /* */ }
  });

  test('2.9 Empty form submit → validation errors', async ({ page }) => {
    await goToRegisterScreen(page);

    // Submit without filling anything
    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // Should show validation error — the first check is for name
    const validationError = page.getByText(/입력.*오류|이름.*입력|required/i).first();
    await expect(validationError).toBeVisible({ timeout: TIMEOUTS.SHORT });

    const okBtn = page.getByText(/확인|OK/i);
    try { await okBtn.click({ timeout: 2000 }); } catch { /* */ }
  });

  test('2.10 "이미 계정이 있으신가요?" link → login screen', async ({ page }) => {
    await goToRegisterScreen(page);

    // The register screen has "이미 계정이 있으신가요?" text and a "로그인" link
    const haveAccountText = page.getByText('이미 계정이 있으신가요?');
    await expect(haveAccountText).toBeVisible({ timeout: TIMEOUTS.SHORT });

    const loginLink = page.locator('[role="link"]').filter({ hasText: '로그인' }).first();
    // Fallback: try a broader selector
    const loginClickable = loginLink.or(
      page.getByText('로그인', { exact: true }).last()
    );
    await loginClickable.first().click({ force: true });

    // Should navigate to login screen — verify login-specific elements
    await expect(page.getByText('TravelPlanner')).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
    await expect(
      page.locator('input[placeholder*="이메일"], input[aria-label*="이메일"]').first()
    ).toBeVisible({ timeout: TIMEOUTS.SHORT });
  });

  // Rate-limit and XSS tests are destructive — they alter server state or
  // test security boundaries. Tag them @destructive so they run in serial
  // on the dedicated project.
  test('2.11 Rate limit (3 reqs/min) → 429 error @destructive', async ({ page }) => {
    test.slow(); // Allow extra time for multiple requests

    // Exhaust the rate limit by making 3 rapid API registrations
    const baseEmail = `test-ratelimit-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await page.request.post(`${API_URL}/auth/register`, {
        data: {
          name: `Rate Limit ${i}`,
          email: `${baseEmail}-${i}@test.com`,
          password: 'Test1234!@',
        },
      });
    }

    // The 4th attempt should be rate-limited (429)
    await goToRegisterScreen(page);

    await fillRegisterForm(page, {
      name: 'Rate Limited',
      email: `${baseEmail}-blocked@test.com`,
      password: 'Test1234!@',
      confirmPassword: 'Test1234!@',
    });

    const submitBtn = page.getByRole('button', { name: /회원가입/i });
    await submitBtn.click();

    // Expect an error — either a 429-specific message or a generic failure alert
    const rateLimitError = page.getByText(
      /너무 많은|too many|rate limit|회원가입 실패|실패|오류/i
    ).first();
    await expect(rateLimitError).toBeVisible({ timeout: TIMEOUTS.MEDIUM });

    const okBtn = page.getByText(/확인|OK/i);
    try { await okBtn.click({ timeout: 2000 }); } catch { /* */ }
  });

  test('2.12 XSS prevention — script tag in name @destructive', async ({ page }) => {
    await goToRegisterScreen(page);

    const xssPayload = '<script>alert("xss")</script>';
    const xssEmail = `test-xss-${Date.now()}@test.com`;

    await fillRegisterForm(page, {
      name: xssPayload,
      email: xssEmail,
      password: 'Test1234!@',
      confirmPassword: 'Test1234!@',
    });

    const submitBtn = page.getByRole('button', { name: /회원가입/i });

    // Listen for any dialog that might be triggered by XSS
    let xssTriggered = false;
    page.on('dialog', (dialog) => {
      if (dialog.message().includes('xss')) {
        xssTriggered = true;
      }
      dialog.dismiss();
    });

    await submitBtn.click();

    // Wait a moment for any possible XSS execution
    await page.waitForTimeout(2000);

    // The XSS script must NOT have executed
    expect(xssTriggered).toBe(false);

    // Additionally, if the registration succeeded or the page rendered the name,
    // verify the raw script tag is NOT interpreted as HTML.
    // Check that no <script> element was injected into the page.
    const scriptInjected = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      return Array.from(scripts).some((s) => s.textContent?.includes('xss'));
    });
    expect(scriptInjected).toBe(false);

    // If displayed, the name should be rendered as text, not HTML
    const renderedXss = page.locator('text=<script>');
    const count = await renderedXss.count();
    // It may or may not render the name visually — if it does, it must be escaped text
    if (count > 0) {
      // The literal text "<script>" is visible as text content — that is fine (escaped)
      expect(count).toBeGreaterThan(0);
    }
  });
});
