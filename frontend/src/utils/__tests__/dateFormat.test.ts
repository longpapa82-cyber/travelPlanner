/**
 * V172 (F-1): timezone-safe date formatting unit tests.
 *
 * The bug we fixed: `toISOString().split('T')[0]` returns the UTC calendar
 * day, not the user's local day. For users east of UTC during morning
 * hours, that gives "today" when the local clock says "tomorrow", which
 * tripped the `start <= today` validation in CreateTripScreen.
 */
import { formatLocalYmd, addDaysLocal, localMidnightToday } from '../dateFormat';

describe('formatLocalYmd', () => {
  test('zero-pads month and day', () => {
    expect(formatLocalYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatLocalYmd(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  test('returns the local calendar day even at end-of-day local time', () => {
    // 2026-04-25 23:30 local — toISOString() of this instant in any
    // timezone east of UTC would land on 2026-04-26 in UTC. formatLocalYmd
    // must return 2026-04-25 regardless.
    const lateNight = new Date(2026, 3, 25, 23, 30, 0);
    expect(formatLocalYmd(lateNight)).toBe('2026-04-25');
  });

  test('returns the local calendar day even at start-of-day local time', () => {
    const earlyMorning = new Date(2026, 3, 25, 0, 30, 0);
    expect(formatLocalYmd(earlyMorning)).toBe('2026-04-25');
  });

  test('handles month rollover correctly', () => {
    expect(formatLocalYmd(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatLocalYmd(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('addDaysLocal', () => {
  test('addDaysLocal(0) is local midnight today', () => {
    const today = addDaysLocal(0);
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
    expect(today.getSeconds()).toBe(0);
    expect(today.getMilliseconds()).toBe(0);
  });

  test('addDaysLocal(1) is exactly one calendar day after today', () => {
    const today = localMidnightToday();
    const tomorrow = addDaysLocal(1);
    const diff = tomorrow.getTime() - today.getTime();
    // 24h ± 1h DST tolerance.
    expect(diff).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });

  test('addDaysLocal handles month rollover', () => {
    // We can't manipulate Date.now() easily here, but we can sanity-check
    // that addDaysLocal(31) is always at least 30 calendar days later.
    const farFuture = addDaysLocal(31);
    const today = localMidnightToday();
    expect(farFuture.getTime() - today.getTime()).toBeGreaterThan(
      30 * 24 * 60 * 60 * 1000,
    );
  });
});

describe('formatLocalYmd + addDaysLocal — V171 regression', () => {
  test('"oneself + 1" via addDaysLocal serializes to a non-today calendar day', () => {
    // The exact V171 user complaint: pressing [당일] sets startDate to
    // today's calendar day, so validation `start <= today` blocks them.
    // After F-1, the duration helpers must produce a strictly greater day.
    const today = formatLocalYmd(localMidnightToday());
    const tomorrow = formatLocalYmd(addDaysLocal(1));
    expect(tomorrow > today).toBe(true);
  });
});
