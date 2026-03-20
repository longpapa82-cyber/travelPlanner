/**
 * Production Smoke E2E Configuration
 *
 * Read-only tests against https://mytravel-planner.com
 * Run: npx playwright test --config=tests/playwright.smoke.config.ts --reporter=list
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/smoke',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 4,

  reporter: [['list']],

  use: {
    baseURL: 'https://mytravel-planner.com',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'smoke-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
