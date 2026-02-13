import { test, expect } from '@playwright/test';
import { API_URL, WORKERS, TIMEOUTS } from '../helpers/constants';
import { ApiHelper } from '../fixtures/api-helper';

// ────────────────────────────────────────────────────────────────
// TC-21: Collaborator Feature — API-level E2E verification
// Tests invite, list, role management, and removal of collaborators.
// Uses W7 (trip owner) and W8 (collaborator).
// ────────────────────────────────────────────────────────────────

const OWNER = WORKERS.W7;
const COLLAB = WORKERS.W8;

test.describe('Collaborator Feature E2E', () => {
  let api: ApiHelper;
  let ownerToken: string;
  let collabToken: string;
  let tripId: string;

  test.beforeAll(async () => {
    api = new ApiHelper();

    // Ensure both users exist
    await api.register(OWNER);
    await api.register(COLLAB);

    // Login both
    const ownerAuth = await api.login(OWNER.email, OWNER.password);
    ownerToken = ownerAuth.accessToken;

    const collabAuth = await api.login(COLLAB.email, COLLAB.password);
    collabToken = collabAuth.accessToken;

    // Create a trip for collaboration
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const endDate = new Date(future);
    endDate.setDate(endDate.getDate() + 5);

    const trip = await api.createTrip(ownerToken, {
      destination: '서울',
      startDate: future.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      description: 'Collaborator test trip',
    });
    tripId = trip.id;
  });

  test.afterAll(async () => {
    // Cleanup: delete the trip
    if (tripId && ownerToken) {
      await api.deleteTrip(ownerToken, tripId).catch(() => {});
    }
  });

  test('TC-21-01: Owner can invite a collaborator as viewer', async () => {
    const result = await api.addCollaborator(ownerToken, tripId, COLLAB.email, 'viewer');
    expect(result).toBeTruthy();
    expect(result.role).toBe('viewer');
  });

  test('TC-21-02: Owner can list collaborators', async () => {
    const collabs = await api.getCollaborators(ownerToken, tripId);
    expect(collabs.length).toBeGreaterThanOrEqual(1);

    const invited = collabs.find((c: any) => c.user?.email === COLLAB.email);
    expect(invited).toBeTruthy();
    expect(invited.role).toBe('viewer');
  });

  test('TC-21-03: Duplicate invite returns error', async () => {
    await expect(
      api.addCollaborator(ownerToken, tripId, COLLAB.email, 'viewer')
    ).rejects.toThrow();
  });

  test('TC-21-04: Owner can remove collaborator', async () => {
    const collabs = await api.getCollaborators(ownerToken, tripId);
    const invited = collabs.find((c: any) => c.user?.email === COLLAB.email);
    expect(invited).toBeTruthy();

    await api.removeCollaborator(ownerToken, tripId, invited.id);

    const after = await api.getCollaborators(ownerToken, tripId);
    const removed = after.find((c: any) => c.user?.email === COLLAB.email);
    expect(removed).toBeUndefined();
  });

  test('TC-21-05: Re-invite after removal works', async () => {
    const result = await api.addCollaborator(ownerToken, tripId, COLLAB.email, 'editor');
    expect(result).toBeTruthy();
    expect(result.role).toBe('editor');

    const collabs = await api.getCollaborators(ownerToken, tripId);
    const reInvited = collabs.find((c: any) => c.user?.email === COLLAB.email);
    expect(reInvited).toBeTruthy();
    expect(reInvited.role).toBe('editor');
  });

  test('TC-21-06: Non-owner cannot invite collaborators', async () => {
    // W8 (collaborator) tries to invite someone else
    await expect(
      api.addCollaborator(collabToken, tripId, 'random@test.com', 'viewer')
    ).rejects.toThrow();
  });

  test('TC-21-07: Cannot invite non-existent user', async () => {
    await expect(
      api.addCollaborator(ownerToken, tripId, 'nonexistent-user-12345@fake.com', 'viewer')
    ).rejects.toThrow();
  });
});
