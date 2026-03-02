import { test, expect } from '@playwright/test';
import { API_URL, TIMEOUTS } from '../helpers/constants';

// ────────────────────────────────────────────────────────────────
// TC-28: OAuth Redirect Verification
// Validates that OAuth callback endpoints redirect to the correct
// frontend URL (not localhost) in production environments.
// ────────────────────────────────────────────────────────────────

test.describe('OAuth Redirect Verification', () => {
  test('TC-28-01: Google OAuth entry point redirects to Google', async ({ request }) => {
    // The GET /auth/google endpoint should redirect to accounts.google.com
    const response = await request.get(`${API_URL}/auth/google`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    // Should return 302 redirect to Google
    const status = response.status();
    expect([302, 301, 303]).toContain(status);
    const location = response.headers()['location'] || '';
    expect(location).toContain('accounts.google.com');
  });

  test('TC-28-02: Kakao OAuth entry point redirects to Kakao', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/kakao`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const status = response.status();
    expect([302, 301, 303]).toContain(status);
    const location = response.headers()['location'] || '';
    expect(location).toContain('kauth.kakao.com');
  });

  test('TC-28-03: Auth controller fallback uses production URL', async () => {
    // This test validates the code-level fix by checking the source code pattern.
    // In production, FRONTEND_URL should be set, so the fallback is rarely hit.
    // The important thing is that the fallback is NOT localhost in production.
    const fs = await import('fs');
    const path = await import('path');

    // Read the auth controller source
    const controllerPath = path.resolve(__dirname, '../../backend/src/auth/auth.controller.ts');
    const source = fs.readFileSync(controllerPath, 'utf8');

    // Verify all OAuth callbacks use the production-safe pattern
    const callbackMatches = source.match(/const frontendUrl = process\.env\.FRONTEND_URL \|\|\s*\n?\s*\(process\.env\.NODE_ENV === 'production'/g);

    // Should find 3 occurrences (Google, Apple, Kakao)
    expect(callbackMatches).toBeTruthy();
    expect(callbackMatches!.length).toBe(3);

    // Verify no bare localhost fallback remains
    const bareLocalhostFallback = source.match(/FRONTEND_URL \|\| ['"]exp:\/\/localhost/g);
    expect(bareLocalhostFallback).toBeNull();
  });
});
