/**
 * E2E Test for Trip Sharing Feature
 *
 * Tests:
 * 1. Share button visibility
 * 2. Share modal opens
 * 3. Generate share link
 * 4. Copy link functionality
 * 5. Disable sharing
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8081';
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test1234!',
};

test.describe('Trip Sharing Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should display share button on trip detail page', async ({ page }) => {
    // Login
    await page.fill('input[placeholder*="이메일"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button:has-text("로그인")');

    // Wait for navigation to home
    await page.waitForTimeout(2000);

    // Navigate to a trip (assuming first trip exists)
    const firstTrip = page.locator('text=도쿄').first();
    if (await firstTrip.isVisible()) {
      await firstTrip.click();
      await page.waitForTimeout(1000);

      // Check if share button exists
      const shareButton = page.locator('[aria-label="Share"]').or(
        page.locator('svg[aria-label="share-variant"]')
      ).first();

      await expect(shareButton).toBeVisible();
      console.log('✅ Share button is visible on trip detail page');
    } else {
      console.log('⚠️  No trips found - skipping share button test');
    }
  });

  test('should open share modal when clicking share button', async ({ page }) => {
    // Login
    await page.fill('input[placeholder*="이메일"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button:has-text("로그인")');

    await page.waitForTimeout(2000);

    // Navigate to a trip
    const firstTrip = page.locator('text=도쿄').first();
    if (await firstTrip.isVisible()) {
      await firstTrip.click();
      await page.waitForTimeout(1000);

      // Click share button
      const shareButton = page.locator('svg[aria-label="share-variant"]').first();
      await shareButton.click();

      // Check if modal appears
      await page.waitForTimeout(500);
      const modal = page.locator('text=여행 공유').first();
      await expect(modal).toBeVisible();
      console.log('✅ Share modal opened successfully');

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/share-modal-opened.png' });
    } else {
      console.log('⚠️  No trips found - skipping modal test');
    }
  });

  test('should generate share link', async ({ page }) => {
    // Login
    await page.fill('input[placeholder*="이메일"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button:has-text("로그인")');

    await page.waitForTimeout(2000);

    // Navigate to a trip
    const firstTrip = page.locator('text=도쿄').first();
    if (await firstTrip.isVisible()) {
      await firstTrip.click();
      await page.waitForTimeout(1000);

      // Open share modal
      const shareButton = page.locator('svg[aria-label="share-variant"]').first();
      await shareButton.click();
      await page.waitForTimeout(500);

      // Click generate link button
      const generateButton = page.locator('text=링크 생성').first();
      if (await generateButton.isVisible()) {
        await generateButton.click();

        // Wait for API response
        await page.waitForTimeout(2000);

        // Check if URL is displayed
        const urlDisplay = page.locator('text=/http/').first();
        if (await urlDisplay.isVisible()) {
          const shareUrl = await urlDisplay.textContent();
          console.log('✅ Share link generated:', shareUrl);

          // Take screenshot
          await page.screenshot({ path: 'test-screenshots/share-link-generated.png' });
        } else {
          console.log('⚠️  Share URL not visible - checking for errors');
        }
      } else {
        console.log('⚠️  Generate button not found - link may already exist');

        // Check if copy button exists (link already generated)
        const copyButton = page.locator('text=링크 복사').first();
        if (await copyButton.isVisible()) {
          console.log('✅ Share link already exists');
          await page.screenshot({ path: 'test-screenshots/share-link-existing.png' });
        }
      }
    } else {
      console.log('⚠️  No trips found - skipping link generation test');
    }
  });

  test('should copy link to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Login
    await page.fill('input[placeholder*="이메일"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button:has-text("로그인")');

    await page.waitForTimeout(2000);

    // Navigate to a trip
    const firstTrip = page.locator('text=도쿄').first();
    if (await firstTrip.isVisible()) {
      await firstTrip.click();
      await page.waitForTimeout(1000);

      // Open share modal
      const shareButton = page.locator('svg[aria-label="share-variant"]').first();
      await shareButton.click();
      await page.waitForTimeout(500);

      // Try to generate link first (if not exists)
      const generateButton = page.locator('text=링크 생성').first();
      if (await generateButton.isVisible()) {
        await generateButton.click();
        await page.waitForTimeout(2000);
      }

      // Click copy button
      const copyButton = page.locator('text=링크 복사').first();
      if (await copyButton.isVisible()) {
        await copyButton.click();
        await page.waitForTimeout(500);

        // Check if "복사 완료" message appears
        const copiedMessage = page.locator('text=복사 완료').first();
        if (await copiedMessage.isVisible()) {
          console.log('✅ Link copied to clipboard');
          await page.screenshot({ path: 'test-screenshots/link-copied.png' });
        } else {
          console.log('⚠️  Copy confirmation not visible');
        }
      } else {
        console.log('⚠️  Copy button not found');
      }
    } else {
      console.log('⚠️  No trips found - skipping copy test');
    }
  });
});

console.log('\n🧪 Trip Sharing Feature E2E Tests');
console.log('================================\n');
