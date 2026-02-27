/**
 * Production E2E Playwright Configuration
 *
 * Targets https://mytravel-planner.com (OCI VM.Standard.E2.1.Micro)
 * Run with: PROD_TEST=1 npx playwright test --config=tests/playwright.prod.config.ts
 *
 * Key differences from local config:
 * - workers: 2 (server has only 1GB RAM)
 * - retries: 1 (network can be flaky)
 * - timeouts: ~2x local values
 * - Excludes destructive, accessibility, visual, SNS, weather, network, data integrity, business tests
 * - No webServer (uses already-running production)
 * - ignoreHTTPSErrors for DuckDNS SSL
 */
import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS, BASE_URL, TIMEOUTS } from './helpers/constants';

export default defineConfig({
  testDir: './e2e',
  timeout: TIMEOUTS.LONG,
  expect: { timeout: TIMEOUTS.SHORT },

  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 2,

  reporter: [['html', { open: 'on-failure' }], ['list']],

  globalSetup: require.resolve('./global-setup.prod'),
  globalTeardown: require.resolve('./global-teardown.prod'),

  // Exclude specs that are unsafe or irrelevant for production
  testIgnore: [
    '**/09-destructive-performance*',   // Account deletion + stress tests
    '**/13-accessibility*',             // axe-core scans — local only
    '**/14-visual-regression*',         // Screenshot baselines — local only
    '**/15-sns-auth*',                  // OAuth redirect can't be automated
    '**/17-weather-timezone*',          // External API dependency — flaky
    '**/18-network-conditions*',        // Network throttling — local only
    '**/19-data-integrity*',            // Concurrency stress — prod load risk
    '**/20-business-features*',         // Ad/affiliate not live yet
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: TIMEOUTS.MEDIUM,
    navigationTimeout: TIMEOUTS.NAVIGATION,
    locale: 'ko-KR',
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'prod-chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORTS.MOBILE,
      },
    },
  ],

  // No webServer — production is already running
});
