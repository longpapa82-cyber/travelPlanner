/**
 * Korea Standard Time (Asia/Seoul, UTC+9, no DST) date helpers.
 *
 * Why this exists: this backend runs in a UTC container (Docker, no TZ set), so
 * `new Date(y, m, d)` yields UTC midnight. For 00:00–09:00 KST that midnight is
 * still *yesterday* in Korea, making "오늘" counts (signups, DAU, API usage) show
 * yesterday's data during the Korean morning. These helpers anchor "today" (and
 * the current month) to the KST calendar.
 */

/**
 * The UTC instant of the most recent KST midnight (00:00 Asia/Seoul) at or before `now`.
 *
 * KST has a fixed +9 offset and no DST, so KST midnight is always the KST
 * calendar day's 00:00 expressed in UTC (= that day minus 9h). We derive the KST
 * calendar date via Intl (robust, no manual offset arithmetic) and rebuild the
 * instant as `${kstDate}T00:00:00+09:00`.
 */
export function kstMidnightUtc(now: Date = new Date()): Date {
  // en-CA → YYYY-MM-DD, formatted in the Asia/Seoul zone.
  const kstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // 00:00 of that KST date, written with the explicit +09:00 offset, is the exact
  // UTC instant of KST midnight.
  return new Date(`${kstDate}T00:00:00+09:00`);
}

/**
 * The KST calendar year / month / day for `now`.
 *
 * `month` is 1-based (January = 1) to mirror the YYYY-MM-DD wire format; callers
 * that need the JS 0-based month should subtract 1. Derived via Intl so it stays
 * correct regardless of the container's own timezone (which is UTC).
 */
export function kstParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const kstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = kstDate.split('-').map((p) => parseInt(p, 10));
  return { year, month, day };
}

/**
 * The UTC instant of the first day of the current KST month (KST midnight on the
 * 1st). Used to anchor month-to-date windows to the Korean calendar month.
 */
export function kstMonthStartUtc(now: Date = new Date()): Date {
  const { year, month } = kstParts(now);
  const mm = String(month).padStart(2, '0');
  return new Date(`${year}-${mm}-01T00:00:00+09:00`);
}
