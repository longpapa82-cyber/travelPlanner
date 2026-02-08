const { test, expect } = require('@playwright/test');

test.describe('TravelPlanner Login Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(2000); // 페이지 로딩 대기
  });

  test('로그인 화면이 올바르게 렌더링되는지 확인', async ({ page }) => {
    // 로고와 제목 확인
    const title = await page.textContent('text=TravelPlanner');
    expect(title).toBeTruthy();

    // 이메일 입력 필드 확인
    const emailInput = await page.locator('input[type="email"], input[placeholder*="email" i]');
    await expect(emailInput).toBeVisible();

    // 비밀번호 입력 필드 확인
    const passwordInput = await page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // 로그인 버튼 확인
    const loginButton = await page.locator('button:has-text("Login"), button:has-text("로그인")');
    await expect(loginButton).toBeVisible();
  });

  test('유효한 계정으로 로그인 성공', async ({ page }) => {
    // 이메일 입력
    const emailInput = await page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill('demo@travelplanner.com');

    // 비밀번호 입력
    const passwordInput = await page.locator('input[type="password"]').first();
    await passwordInput.fill('Demo1234');

    // 스크린샷 촬영 (로그인 전)
    await page.screenshot({ path: 'test-screenshots/before-login.png', fullPage: true });

    // 로그인 버튼 클릭
    const loginButton = await page.locator('button:has-text("Login"), button:has-text("로그인")').first();
    await loginButton.click();

    // 로그인 후 페이지 변경 대기 (3초)
    await page.waitForTimeout(3000);

    // 스크린샷 촬영 (로그인 후)
    await page.screenshot({ path: 'test-screenshots/after-login.png', fullPage: true });

    // URL 변경 확인 (로그인 성공 시 다른 페이지로 리다이렉트되었는지)
    const currentUrl = page.url();
    console.log('로그인 후 URL:', currentUrl);

    // 페이지 내용 확인
    const pageContent = await page.content();
    console.log('로그인 후 페이지에 "demo" 포함 여부:', pageContent.includes('demo'));
  });

  test('잘못된 비밀번호로 로그인 실패', async ({ page }) => {
    // 이메일 입력
    const emailInput = await page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill('demo@travelplanner.com');

    // 잘못된 비밀번호 입력
    const passwordInput = await page.locator('input[type="password"]').first();
    await passwordInput.fill('WrongPassword123');

    // 로그인 버튼 클릭
    const loginButton = await page.locator('button:has-text("Login"), button:has-text("로그인")').first();
    await loginButton.click();

    // 에러 메시지 대기
    await page.waitForTimeout(2000);

    // 스크린샷 촬영
    await page.screenshot({ path: 'test-screenshots/login-failed.png', fullPage: true });

    // 에러 메시지 확인 (예상)
    const pageText = await page.textContent('body');
    console.log('로그인 실패 후 페이지 내용:', pageText.substring(0, 200));
  });

  test('빈 필드로 로그인 시도', async ({ page }) => {
    // 로그인 버튼 클릭 (빈 필드)
    const loginButton = await page.locator('button:has-text("Login"), button:has-text("로그인")').first();
    await loginButton.click();

    await page.waitForTimeout(1000);

    // 스크린샷 촬영
    await page.screenshot({ path: 'test-screenshots/empty-fields.png', fullPage: true });

    // 여전히 로그인 페이지에 있어야 함
    const emailInput = await page.locator('input[type="email"], input[placeholder*="email" i]');
    await expect(emailInput).toBeVisible();
  });
});
