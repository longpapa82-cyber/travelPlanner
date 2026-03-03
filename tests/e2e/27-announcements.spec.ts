import { test, expect } from '@playwright/test';
import { WORKERS } from '../helpers/constants';
import { ApiHelper } from '../fixtures/api-helper';

// ────────────────────────────────────────────────────────────────
// TC-27: Announcements System — API-level E2E
// Tests the complete announcement lifecycle: admin CRUD, publish,
// user-facing list, read tracking, and dismiss.
// Admin tests require ADMIN_PASSWORD env var for admin account.
// ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'a090723@naver.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const USER = WORKERS.W1;

test.describe('Announcements — Public Endpoints', () => {
  let api: ApiHelper;
  let userToken: string;

  test.beforeAll(async () => {
    api = new ApiHelper();
    await api.register(USER);
    const auth = await api.login(USER.email, USER.password);
    userToken = auth.accessToken;
  });

  test('TC-27-01: GET /announcements returns array', async () => {
    const res = await api.rawRequest('GET', '/announcements', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(Array.isArray(data)).toBe(true);
  });

  test('TC-27-02: GET /announcements/unread-count returns count number', async () => {
    const res = await api.rawRequest('GET', '/announcements/unread-count', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(typeof data.count).toBe('number');
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test('TC-27-03: GET /announcements/:id with non-existent UUID returns 404', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000099';
    const res = await api.rawRequest('GET', `/announcements/${fakeUuid}`, { token: userToken });
    expect(res.status).toBe(404);
  });

  test('TC-27-04: PATCH /announcements/:id/read with invalid UUID returns 400', async () => {
    const res = await api.rawRequest('PATCH', '/announcements/invalid-uuid/read', {
      token: userToken,
    });
    expect([400, 422]).toContain(res.status);
  });

  test('TC-27-05: PATCH /announcements/:id/read with non-existent UUID returns 404', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000099';
    const res = await api.rawRequest('PATCH', `/announcements/${fakeUuid}/read`, {
      token: userToken,
    });
    expect(res.status).toBe(404);
  });

  test('TC-27-06: PATCH /announcements/:id/dismiss with invalid UUID returns 400', async () => {
    const res = await api.rawRequest('PATCH', '/announcements/invalid-uuid/dismiss', {
      token: userToken,
    });
    expect([400, 422]).toContain(res.status);
  });

  test('TC-27-07: PATCH /announcements/:id/dismiss with non-existent UUID returns 404', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000099';
    const res = await api.rawRequest('PATCH', `/announcements/${fakeUuid}/dismiss`, {
      token: userToken,
    });
    expect(res.status).toBe(404);
  });

  test('TC-27-08: Announcement list items have expected fields', async () => {
    const res = await api.rawRequest('GET', '/announcements', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;

    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('content');
      expect(item).toHaveProperty('priority');
      expect(item).toHaveProperty('displayType');
      expect(typeof item.isRead).toBe('boolean');
      expect(typeof item.isDismissed).toBe('boolean');
    }
    // If no announcements exist, test still passes — just validates array shape
  });
});

test.describe('Announcements — Security', () => {
  let api: ApiHelper;
  let userToken: string;

  test.beforeAll(async () => {
    api = new ApiHelper();
    await api.register(USER);
    const auth = await api.login(USER.email, USER.password);
    userToken = auth.accessToken;
  });

  test('TC-27-09: GET /announcements without auth returns 401', async () => {
    const res = await api.rawRequest('GET', '/announcements');
    expect(res.status).toBe(401);
  });

  test('TC-27-10: GET /announcements/unread-count without auth returns 401', async () => {
    const res = await api.rawRequest('GET', '/announcements/unread-count');
    expect(res.status).toBe(401);
  });

  test('TC-27-11: PATCH /announcements/:id/read without auth returns 401', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000001';
    const res = await api.rawRequest('PATCH', `/announcements/${fakeUuid}/read`);
    expect(res.status).toBe(401);
  });

  test('TC-27-12: PATCH /announcements/:id/dismiss without auth returns 401', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000001';
    const res = await api.rawRequest('PATCH', `/announcements/${fakeUuid}/dismiss`);
    expect(res.status).toBe(401);
  });

  test('TC-27-13: GET /admin/announcements with regular user returns 403', async () => {
    const res = await api.rawRequest('GET', '/admin/announcements', { token: userToken });
    expect(res.status).toBe(403);
  });

  test('TC-27-14: POST /admin/announcements with regular user returns 403', async () => {
    const res = await api.rawRequest('POST', '/admin/announcements', {
      token: userToken,
      body: {
        type: 'system',
        title: { ko: '테스트', en: 'Test' },
        content: { ko: '내용', en: 'Content' },
        startDate: new Date().toISOString(),
      },
    });
    expect(res.status).toBe(403);
  });

  test('TC-27-15: PUT /admin/announcements/:id with regular user returns 403', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000001';
    const res = await api.rawRequest('PATCH', `/admin/announcements/${fakeUuid}`, {
      token: userToken,
      body: { title: { ko: '변경', en: 'Changed' } },
    });
    expect(res.status).toBe(403);
  });

  test('TC-27-16: DELETE /admin/announcements/:id with regular user returns 403', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000001';
    const res = await api.rawRequest('DELETE', `/admin/announcements/${fakeUuid}`, {
      token: userToken,
    });
    expect(res.status).toBe(403);
  });

  test('TC-27-17: PATCH /admin/announcements/:id/publish with regular user returns 403', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000001';
    const res = await api.rawRequest('PATCH', `/admin/announcements/${fakeUuid}/publish`, {
      token: userToken,
    });
    expect(res.status).toBe(403);
  });

  test('TC-27-18: PATCH /admin/announcements/:id/unpublish with regular user returns 403', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000001';
    const res = await api.rawRequest('PATCH', `/admin/announcements/${fakeUuid}/unpublish`, {
      token: userToken,
    });
    expect(res.status).toBe(403);
  });

  test('TC-27-19: Admin endpoints without auth returns 401', async () => {
    const endpoints = [
      { method: 'GET' as const, path: '/admin/announcements' },
      { method: 'POST' as const, path: '/admin/announcements' },
      { method: 'GET' as const, path: '/admin/announcements/00000000-0000-4000-8000-000000000001' },
      { method: 'PATCH' as const, path: '/admin/announcements/00000000-0000-4000-8000-000000000001' },
      { method: 'DELETE' as const, path: '/admin/announcements/00000000-0000-4000-8000-000000000001' },
      { method: 'PATCH' as const, path: '/admin/announcements/00000000-0000-4000-8000-000000000001/publish' },
      { method: 'PATCH' as const, path: '/admin/announcements/00000000-0000-4000-8000-000000000001/unpublish' },
    ];

    for (const ep of endpoints) {
      const res = await api.rawRequest(ep.method, ep.path);
      expect(res.status).toBe(401);
    }
  });
});

// ── Admin CRUD Lifecycle (requires ADMIN_PASSWORD env var) ───────────
// These tests perform the full announcement lifecycle:
// create -> read -> update -> publish -> user sees it -> read/dismiss -> unpublish -> delete
test.describe('Announcements — Admin CRUD Lifecycle', () => {
  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD env var not set — skipping admin lifecycle tests');

  let api: ApiHelper;
  let adminToken: string;
  let userToken: string;
  let createdAnnouncementId: string;

  test.beforeAll(async () => {
    api = new ApiHelper();

    // Login as admin
    const adminAuth = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = adminAuth.accessToken;

    // Login as regular user
    await api.register(USER);
    const userAuth = await api.login(USER.email, USER.password);
    userToken = userAuth.accessToken;
  });

  test.describe.configure({ mode: 'serial' });

  test('TC-27-20: POST /admin/announcements creates announcement', async () => {
    const res = await api.rawRequest('POST', '/admin/announcements', {
      token: adminToken,
      body: {
        type: 'system',
        title: { ko: 'E2E 테스트 공지', en: 'E2E Test Announcement' },
        content: { ko: 'E2E 테스트 내용입니다.', en: 'This is an E2E test announcement.' },
        priority: 'normal',
        displayType: 'banner',
        targetAudience: 'all',
        startDate: new Date().toISOString(),
      },
    });
    expect(res.status).toBe(201);
    const data = res.body?.data ?? res.body;
    expect(data).toHaveProperty('id');
    expect(data.type).toBe('system');
    expect(data.isPublished).toBe(false);
    createdAnnouncementId = data.id;
  });

  test('TC-27-21: GET /admin/announcements lists with pagination', async () => {
    const res = await api.rawRequest('GET', '/admin/announcements?page=1&limit=10', {
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('totalPages');
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  test('TC-27-22: GET /admin/announcements/:id returns announcement detail', async () => {
    const res = await api.rawRequest('GET', `/admin/announcements/${createdAnnouncementId}`, {
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data.id).toBe(createdAnnouncementId);
    expect(data.title).toEqual({ ko: 'E2E 테스트 공지', en: 'E2E Test Announcement' });
  });

  test('TC-27-23: PATCH /admin/announcements/:id updates announcement', async () => {
    const res = await api.rawRequest('PATCH', `/admin/announcements/${createdAnnouncementId}`, {
      token: adminToken,
      body: {
        title: { ko: 'E2E 수정된 공지', en: 'E2E Updated Announcement' },
        priority: 'high',
      },
    });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data.title).toEqual({ ko: 'E2E 수정된 공지', en: 'E2E Updated Announcement' });
    expect(data.priority).toBe('high');
  });

  test('TC-27-24: Unpublished announcement not visible to users', async () => {
    const res = await api.rawRequest('GET', '/announcements', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    const found = data.find((a: any) => a.id === createdAnnouncementId);
    expect(found).toBeUndefined();
  });

  test('TC-27-25: PATCH /admin/announcements/:id/publish publishes', async () => {
    const res = await api.rawRequest('PATCH', `/admin/announcements/${createdAnnouncementId}/publish`, {
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data.isPublished).toBe(true);
  });

  test('TC-27-26: Published announcement visible to users', async () => {
    const res = await api.rawRequest('GET', '/announcements', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    const found = data.find((a: any) => a.id === createdAnnouncementId);
    expect(found).toBeTruthy();
    expect(found.title).toBe('E2E 수정된 공지'); // ko locale (Accept-Language: ko)
  });

  test('TC-27-27: GET /announcements/:id returns detail for user', async () => {
    const res = await api.rawRequest('GET', `/announcements/${createdAnnouncementId}`, {
      token: userToken,
    });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data.id).toBe(createdAnnouncementId);
    expect(data.isRead).toBe(false);
    expect(data.isDismissed).toBe(false);
  });

  test('TC-27-28: Unread count includes published announcement', async () => {
    const res = await api.rawRequest('GET', '/announcements/unread-count', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  test('TC-27-29: PATCH /announcements/:id/read marks as read', async () => {
    const res = await api.rawRequest('PATCH', `/announcements/${createdAnnouncementId}/read`, {
      token: userToken,
    });
    expect(res.status).toBe(204);

    // Verify read status
    const detail = await api.rawRequest('GET', `/announcements/${createdAnnouncementId}`, {
      token: userToken,
    });
    const data = detail.body?.data ?? detail.body;
    expect(data.isRead).toBe(true);
  });

  test('TC-27-30: Reading again is idempotent (no error)', async () => {
    const res = await api.rawRequest('PATCH', `/announcements/${createdAnnouncementId}/read`, {
      token: userToken,
    });
    expect(res.status).toBe(204);
  });

  test('TC-27-31: PATCH /announcements/:id/dismiss marks as dismissed', async () => {
    const res = await api.rawRequest('PATCH', `/announcements/${createdAnnouncementId}/dismiss`, {
      token: userToken,
    });
    expect(res.status).toBe(204);

    // Verify dismissed status
    const detail = await api.rawRequest('GET', `/announcements/${createdAnnouncementId}`, {
      token: userToken,
    });
    const data = detail.body?.data ?? detail.body;
    expect(data.isDismissed).toBe(true);
  });

  test('TC-27-32: PATCH /admin/announcements/:id/unpublish unpublishes', async () => {
    const res = await api.rawRequest('PATCH', `/admin/announcements/${createdAnnouncementId}/unpublish`, {
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    expect(data.isPublished).toBe(false);
  });

  test('TC-27-33: Unpublished announcement no longer visible to users', async () => {
    const res = await api.rawRequest('GET', '/announcements', { token: userToken });
    expect(res.status).toBe(200);
    const data = res.body?.data ?? res.body;
    const found = data.find((a: any) => a.id === createdAnnouncementId);
    expect(found).toBeUndefined();
  });

  test('TC-27-34: DELETE /admin/announcements/:id deletes announcement (cleanup)', async () => {
    const res = await api.rawRequest('DELETE', `/admin/announcements/${createdAnnouncementId}`, {
      token: adminToken,
    });
    expect(res.status).toBe(200);

    // Verify deleted
    const detail = await api.rawRequest('GET', `/admin/announcements/${createdAnnouncementId}`, {
      token: adminToken,
    });
    expect(detail.status).toBe(404);
  });

  test('TC-27-35: DELETE non-existent announcement returns 404', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000099';
    const res = await api.rawRequest('DELETE', `/admin/announcements/${fakeUuid}`, {
      token: adminToken,
    });
    expect(res.status).toBe(404);
  });

  test('TC-27-36: POST /admin/announcements with invalid body returns 400', async () => {
    const res = await api.rawRequest('POST', '/admin/announcements', {
      token: adminToken,
      body: {
        // Missing required fields: type, title, content, startDate
        priority: 'normal',
      },
    });
    expect(res.status).toBe(400);
  });

  test('TC-27-37: POST /admin/announcements with invalid type enum returns 400', async () => {
    const res = await api.rawRequest('POST', '/admin/announcements', {
      token: adminToken,
      body: {
        type: 'invalid_type',
        title: { ko: '테스트', en: 'Test' },
        content: { ko: '내용', en: 'Content' },
        startDate: new Date().toISOString(),
      },
    });
    expect(res.status).toBe(400);
  });
});
