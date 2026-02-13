import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { WORKERS, API_URL, TEST_PASSWORD } from '../helpers/constants';
import { ApiHelper } from './api-helper';
import * as fs from 'fs';
import * as path from 'path';

type WorkerKey = keyof typeof WORKERS;

interface AuthFixtures {
  authenticatedPage: Page;
  apiHelper: ApiHelper;
  workerUser: (typeof WORKERS)[WorkerKey];
  authToken: string;
}

/**
 * Custom fixture that provides an authenticated page for each worker.
 * Each worker gets its own user based on workerIndex.
 */
export const test = base.extend<AuthFixtures>({
  apiHelper: async ({}, use) => {
    await use(new ApiHelper(API_URL));
  },

  workerUser: async ({}, use, workerInfo) => {
    const keys: WorkerKey[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'DESTROY'];
    const key = keys[workerInfo.workerIndex % keys.length] || 'W1';
    await use(WORKERS[key]);
  },

  authToken: async ({ apiHelper, workerUser }, use) => {
    const tokens = await apiHelper.login(workerUser.email, workerUser.password);
    await use(tokens.accessToken);
  },

  authenticatedPage: async ({ page, workerUser }, use) => {
    // Load stored auth state if available
    const stateDir = path.join(__dirname, '..', '.auth');
    const stateFile = path.join(stateDir, `${workerUser.email}.json`);

    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      // Set tokens in localStorage via page evaluation
      await page.goto('about:blank');
      await page.evaluate((authState) => {
        if (authState.accessToken) {
          localStorage.setItem('@travelplanner:auth_token', authState.accessToken);
        }
        if (authState.refreshToken) {
          localStorage.setItem('@travelplanner:refresh_token', authState.refreshToken);
        }
      }, state);
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
