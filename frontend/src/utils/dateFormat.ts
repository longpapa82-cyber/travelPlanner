/**
 * V172 (F-1): Local-calendar date formatting helpers.
 *
 * `Date.prototype.toISOString()` always serializes in UTC, so combining it
 * with `.split('T')[0]` gives the *UTC* calendar day, not the user's local
 * day. For users east of UTC in the morning hours, this means a freshly-
 * computed `tomorrow` in local time can be serialized as today's date — the
 * V171 root cause for the "기간 버튼을 누르면 출발일이 오늘로 뜬다" bug.
 *
 * Use `formatLocalYmd` whenever the API contract is "calendar day, no
 * timezone" (e.g. trip startDate/endDate).
 */

/**
 * Format a Date as "YYYY-MM-DD" using the runtime's local timezone.
 * Never crosses the UTC date boundary.
 *
 * `formatLocalYmd(new Date('2026-04-25T01:00:00+09:00'))` → "2026-04-25"
 * (regardless of what UTC says about that instant).
 */
export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build a Date representing local midnight (00:00:00.000) of *today*.
 * Useful for `start <= today` style validation comparisons that should
 * match the user's calendar, not UTC's.
 */
export function localMidnightToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Build a Date representing local midnight N days from today.
 * `addDaysLocal(1)` → tomorrow at local 00:00.
 *
 * Implementation note: `setDate(getDate() + n)` correctly handles month and
 * year rollovers in the local timezone — that's why we don't use
 * `Date.now() + n*86400000`, which silently breaks on DST transitions.
 */
export function addDaysLocal(days: number): Date {
  const d = localMidnightToday();
  d.setDate(d.getDate() + days);
  return d;
}
