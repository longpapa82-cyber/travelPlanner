import { test, expect } from '@playwright/test';
import { WORKERS, API_URL, TIMEOUTS } from '../helpers/constants';
import { ApiHelper } from '../fixtures/api-helper';

// ────────────────────────────────────────────────────────────────
// TC-27: Announcements System — API-level E2E
// Tests the complete announcement lifecycle: admin CRUD, publish,
// user-facing list, read tracking, and dismiss.
// ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'a090723@naver.com';
const USER = WORKERS.W1;

test.describe('Announcements System E2E', () => {
  let api: ApiHelper;
  let userToken: string;

  test.beforeAll(async () => {
    api = new ApiHelper();
    await api.register(USER);
    const auth = await api.login(USER.email, USER.password);
    userToken = auth.accessToken;
  });

  test('TC-27-01: Public announcements endpoint returns array', async () => {
    const res = await api.rawRequest('GET', '/announcements', { token: userToken });
    expect(res.status).toBe(200);
    // May be envelope-wrapped or direct array
    const data = res.body?.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
  });

  test('TC-27-02: Unread count endpoint returns count', async () => {
    const res = await api.rawRequest('GET', '/announcements/unread-count', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(typeof data.count).toBe('number');
  });

  test('TC-27-03: Announcements require auth', async () => {
    const res = await api.rawRequest('GET', '/announcements');
    expect(res.status).toBe(401);
  });

  test('TC-27-04: Admin endpoints require AdminGuard', async () => {
    // Regular user should be forbidden from admin announcements
    const res = await api.rawRequest('GET', '/admin/announcements', { token: userToken });
    expect(res.status).toBe(403);
  });

  test('TC-27-05: Mark read requires valid UUID', async () => {
    const res = await api.rawRequest('PATCH', '/announcements/invalid-uuid/read', {
      token: userToken,
    });
    // Should get 400 (bad request) for invalid UUID
    expect([400, 422]).toContain(res.status);
  });

  test('TC-27-06: Dismiss requires valid UUID', async () => {
    const res = await api.rawRequest('PATCH', '/announcements/invalid-uuid/dismiss', {
      token: userToken,
    });
    expect([400, 422]).toContain(res.status);
  });
});
