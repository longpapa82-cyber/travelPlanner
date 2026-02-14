import { test, expect } from '@playwright/test';
import { WORKERS, TIMEOUTS } from '../helpers/constants';
import { ApiHelper } from '../fixtures/api-helper';

// ────────────────────────────────────────────────────────────────
// TC-25: Trip Duplicate + iCal Export — API-level E2E
// Uses W5 (detail/activity worker) which has seed trips with activities
// created in global-setup. Reuses existing trips to avoid AI generation
// timeouts. Uses W8 for unauthorized-access tests.
// ────────────────────────────────────────────────────────────────

const USER = WORKERS.W5;
const OTHER = WORKERS.W8;

test.describe('Trip Duplicate & iCal Export E2E', () => {
  let api: ApiHelper;
  let userToken: string;
  let otherToken: string;
  let tripId: string;
  let emptyTripId: string;

  test.beforeAll(async () => {
    api = new ApiHelper();
    await api.register(USER);
    await api.register(OTHER);

    const auth = await api.login(USER.email, USER.password);
    userToken = auth.accessToken;

    const otherAuth = await api.login(OTHER.email, OTHER.password);
    otherToken = otherAuth.accessToken;

    // Reuse existing seed trips from global-setup instead of creating new ones
    // (trip creation triggers AI generation which can take >130s)
    const trips = await api.getTrips(userToken);
    if (trips.length > 0) {
      // Pick the first trip that has itineraries with activities
      const tripWithActivities = trips.find((t: any) =>
        t.itineraries?.some((it: any) => it.activities?.length > 0),
      );
      tripId = (tripWithActivities || trips[0]).id;
    }
  });

  // ── Duplicate Tests ─────────────────────────────────────

  test('TC-25-01: Duplicate trip creates new trip with different ID', async () => {
    test.skip(!tripId, 'No seed trip available');
    const duplicate = await api.duplicateTrip(userToken, tripId);

    expect(duplicate).toHaveProperty('id');
    expect(duplicate.id).not.toBe(tripId);

    // Cleanup duplicated trip
    await api.deleteTrip(userToken, duplicate.id).catch(() => {});
  });

  test('TC-25-02: Duplicated trip includes activities', async () => {
    test.skip(!tripId, 'No seed trip available');
    const duplicate = await api.duplicateTrip(userToken, tripId);

    // Get full trip detail to check activities
    const detail = await api.getTrip(userToken, duplicate.id);

    if (detail.itineraries?.length > 0) {
      const activities = detail.itineraries[0].activities || [];
      expect(activities.length).toBeGreaterThanOrEqual(1);
    }

    await api.deleteTrip(userToken, duplicate.id).catch(() => {});
  });

  test('TC-25-03: Cannot duplicate another user\'s trip', async () => {
    test.skip(!tripId, 'No seed trip available');
    await expect(
      api.duplicateTrip(otherToken, tripId),
    ).rejects.toThrow(/40[034]/);
  });

  // ── iCal Export Tests ───────────────────────────────────

  test('TC-25-04: Export iCal returns valid calendar format', async () => {
    test.skip(!tripId, 'No seed trip available');
    const ical = await api.exportIcal(userToken, tripId);

    expect(ical.status).toBe(200);
    expect(ical.headers['content-type']).toContain('text/calendar');
    expect(ical.text).toContain('BEGIN:VCALENDAR');
    expect(ical.text).toContain('END:VCALENDAR');
    expect(ical.text).toContain('PRODID:-//TravelPlanner//EN');
  });

  test('TC-25-05: iCal VEVENT includes activity info', async () => {
    test.skip(!tripId, 'No seed trip available');
    const ical = await api.exportIcal(userToken, tripId);
    const text = ical.text;

    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('END:VEVENT');
    expect(text).toContain('SUMMARY:');
    expect(text).toContain('DTSTART:');
    expect(text).toContain('DTEND:');
  });

  test('TC-25-06: Empty trip exports valid calendar without events', async () => {
    // Create a minimal trip (no activities). Use long timeout for AI generation.
    test.setTimeout(TIMEOUTS.AI_GENERATION);

    const future = new Date();
    future.setDate(future.getDate() + 90);
    const endDate = new Date(future);
    endDate.setDate(endDate.getDate() + 2);

    const emptyTrip = await api.createTrip(userToken, {
      destination: '빈여행테스트',
      startDate: future.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    emptyTripId = emptyTrip.id;

    // Remove all activities from the trip's itineraries
    if (emptyTrip.itineraries) {
      for (const itin of emptyTrip.itineraries) {
        const activities = itin.activities || [];
        for (let i = activities.length - 1; i >= 0; i--) {
          await api.deleteActivity(userToken, emptyTripId, itin.id, i).catch(() => {});
        }
      }
    }

    const ical = await api.exportIcal(userToken, emptyTripId);

    expect(ical.status).toBe(200);
    expect(ical.text).toContain('BEGIN:VCALENDAR');
    expect(ical.text).toContain('END:VCALENDAR');
    // No events since we removed all activities
    expect(ical.text).not.toContain('BEGIN:VEVENT');

    await api.deleteTrip(userToken, emptyTripId).catch(() => {});
  });

  test('TC-25-07: Cannot export another user\'s trip', async () => {
    test.skip(!tripId, 'No seed trip available');
    const ical = await api.exportIcal(otherToken, tripId);
    // Should be 403 or 404
    expect(ical.status).toBeGreaterThanOrEqual(400);
  });
});
