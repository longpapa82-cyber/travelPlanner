import { test, expect } from '@playwright/test';
import { API_URL } from '../helpers/constants';

// ────────────────────────────────────────────────────────────────
// TC-28: OAuth Redirect Verification
// Validates that OAuth entry endpoints redirect to the correct
// identity providers, and that callback code uses production URLs
// (not localhost) as the frontend redirect target.
// ────────────────────────────────────────────────────────────────

test.describe('OAuth Redirect Verification', () => {
  test('TC-28-01: GET /auth/google redirects to accounts.google.com', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/google`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const status = response.status();
    expect([302, 301, 303]).toContain(status);

    const location = response.headers()['location'] || '';
    expect(location).toContain('accounts.google.com');
  });

  test('TC-28-02: Google OAuth redirect includes required params', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/google`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const location = response.headers()['location'] || '';

    // OAuth 2.0 redirect should include response_type, client_id, redirect_uri
    expect(location).toContain('client_id');
    expect(location).toContain('redirect_uri');
    expect(location).toContain('scope');
  });

  test('TC-28-03: Google OAuth redirect_uri points to backend callback', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/google`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const location = response.headers()['location'] || '';

    // redirect_uri should point back to our backend, not to localhost in production
    const url = new URL(location);
    const redirectUri = url.searchParams.get('redirect_uri') || '';
    expect(redirectUri).toContain('/auth/google/callback');

    // In production, redirect_uri should not contain localhost
    if (API_URL.includes('mytravel-planner.com')) {
      expect(redirectUri).not.toContain('localhost');
    }
  });

  test('TC-28-04: GET /auth/kakao redirects to kauth.kakao.com', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/kakao`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const status = response.status();
    expect([302, 301, 303]).toContain(status);

    const location = response.headers()['location'] || '';
    expect(location).toContain('kauth.kakao.com');
  });

  test('TC-28-05: Kakao OAuth redirect includes required params', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/kakao`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const location = response.headers()['location'] || '';

    expect(location).toContain('client_id');
    expect(location).toContain('redirect_uri');
  });

  test('TC-28-06: Kakao OAuth redirect_uri points to backend callback', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/kakao`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const location = response.headers()['location'] || '';

    const url = new URL(location);
    const redirectUri = url.searchParams.get('redirect_uri') || '';
    expect(redirectUri).toContain('/auth/kakao/callback');

    if (API_URL.includes('mytravel-planner.com')) {
      expect(redirectUri).not.toContain('localhost');
    }
  });

  test('TC-28-07: OAuth callback source code uses production-safe frontendUrl', async () => {
    // Validates the code-level fix: all OAuth callbacks must use
    // FRONTEND_URL env var with a production-safe fallback pattern.
    const fs = await import('fs');
    const path = await import('path');

    const controllerPath = path.resolve(__dirname, '../../backend/src/auth/auth.controller.ts');
    const source = fs.readFileSync(controllerPath, 'utf8');

    // Verify all OAuth callbacks check process.env.FRONTEND_URL first
    const frontendUrlChecks = source.match(/process\.env\.FRONTEND_URL/g);
    // Should find at least 3 (Google, Apple, Kakao callbacks)
    expect(frontendUrlChecks).toBeTruthy();
    expect(frontendUrlChecks!.length).toBeGreaterThanOrEqual(3);

    // Verify production fallback uses mytravel-planner.com (not bare localhost)
    const productionFallback = source.match(/process\.env\.NODE_ENV === 'production'/g);
    expect(productionFallback).toBeTruthy();
    expect(productionFallback!.length).toBeGreaterThanOrEqual(3);

    // Verify no bare localhost fallback remains (without NODE_ENV guard)
    const bareLocalhostFallback = source.match(/FRONTEND_URL \|\| ['"]exp:\/\/localhost/g);
    expect(bareLocalhostFallback).toBeNull();
  });

  test('TC-28-08: Non-existent OAuth provider returns 404', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/nonexistent`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const status = response.status();
    expect(status).toBe(404);
  });

  test('TC-28-09: OAuth callback without code/state returns error', async ({ request }) => {
    // Calling the callback directly without proper OAuth flow should fail
    const response = await request.get(`${API_URL}/auth/google/callback`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const status = response.status();
    // Should fail with 401 (Unauthorized) or 302 (redirect to error page)
    expect([302, 401, 403]).toContain(status);
  });

  test('TC-28-10: Kakao callback without code returns error', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/kakao/callback`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    const status = response.status();
    expect([302, 401, 403]).toContain(status);
  });
});
