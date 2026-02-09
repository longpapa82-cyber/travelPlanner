import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS, BASE_URL, TIMEOUTS } from './helpers/constants';

export default defineConfig({
  testDir: './e2e',
  timeout: TIMEOUTS.LONG,
  expect: { timeout: TIMEOUTS.SHORT },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 8,

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['json', { outputFile: 'test-results.json' }]]
    : [['html', { open: 'on-failure' }], ['list']],

  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: TIMEOUTS.MEDIUM,
    navigationTimeout: TIMEOUTS.NAVIGATION,
    locale: 'ko-KR',
  },

  projects: [
    // ── Primary: Chromium Mobile (main test suite) ──────────────
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORTS.MOBILE,
      },
    },

    // ── Cross-browser: runs after primary passes ────────────────
    {
      name: 'firefox-tablet',
      dependencies: ['chromium-mobile'],
      use: {
        ...devices['Desktop Firefox'],
        viewport: VIEWPORTS.TABLET,
      },
      grep: /@crossbrowser/,
    },
    {
      name: 'webkit-desktop',
      dependencies: ['chromium-mobile'],
      use: {
        ...devices['Desktop Safari'],
        viewport: VIEWPORTS.DESKTOP,
      },
      grep: /@crossbrowser/,
    },

    // ── Destructive: serial, runs last ──────────────────────────
    {
      name: 'destructive',
      dependencies: ['chromium-mobile'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORTS.MOBILE,
      },
      grep: /@destructive/,
    },
  ],

  webServer: {
    command: 'echo "Servers should already be running"',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 5000,
  },
});
