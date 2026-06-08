/**
 * Trip-Detail Visit Ad Policy
 *
 * TripDetailScreen is the most-visited surface in the app, yet it had ZERO
 * automatic ad coverage. Interstitials only fired on trip create/edit, which
 * are rare events — so most active usage produced no ad requests at all.
 *
 * This module counts how many times the user has entered a trip-detail screen
 * (persisted forever in AsyncStorage so heavy users keep accruing across app
 * restarts) and decides, on each visit, whether this is an "ad visit".
 *
 * The frequency caps in adFrequency.ts (60s global cooldown + per-type session
 * cap) still apply on top of this, so even if this policy says "show", a too-
 * recent ad will still be suppressed. This policy only controls the CADENCE of
 * *attempts*; adFrequency controls the hard ceiling.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_VISIT_COUNT = '@trip_detail_visit_count';

/**
 * Read the persisted lifetime visit count (0 if never visited / on error).
 */
async function readVisitCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_VISIT_COUNT);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Persist the visit count (best-effort).
 */
async function writeVisitCount(count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_VISIT_COUNT, String(count));
  } catch {
    // Non-critical
  }
}

/**
 * ⬇️⬇️⬇️  YOUR CODE GOES HERE  ⬇️⬇️⬇️
 *
 * Decide whether a trip-detail visit with the given (1-based) lifetime visit
 * count should trigger an interstitial ad attempt.
 *
 * This is the core revenue ⇄ UX lever. Things to weigh:
 *   - Return `true` every Nth visit. Smaller N = more ads (more revenue, more
 *     annoyance on repeat-checking the same trip). We agreed on a "moderate"
 *     posture, so something in the 3–4 range is reasonable.
 *   - Should the FIRST visit ever show an ad? Showing an ad before the user has
 *     even seen their trip once is the most jarring case — consider skipping
 *     low counts so content lands first.
 *   - `visitCount` is the lifetime count AFTER incrementing for this visit
 *     (so the very first entry is visitCount === 1).
 *
 * Example shape (replace with your decision):
 *   if (visitCount < 2) return false;        // let the first view be ad-free
 *   return visitCount % 3 === 0;             // then every 3rd visit
 *
 * @param visitCount lifetime trip-detail entry count, 1-based, post-increment
 * @returns true if this visit should attempt to show an interstitial
 */
/** Visits before the very first ad — let the user see a trip before any ad. */
const FREE_VISITS = 1;
/** After the free visits, attempt an ad on every Nth visit. */
const AD_EVERY_N_VISITS = 3;

export function shouldShowAdOnVisit(visitCount: number): boolean {
  // Skip the earliest visits so content always lands first (least jarring).
  if (visitCount <= FREE_VISITS) return false;
  // Then attempt an ad on every Nth visit. adFrequency's global cooldown +
  // session cap still gate whether it actually shows, keeping exposure moderate.
  return visitCount % AD_EVERY_N_VISITS === 0;
}

/**
 * Call once per trip-detail entry. Increments the persisted lifetime counter
 * and returns whether THIS visit should attempt an interstitial, along with the
 * new count (handy for the debug screen / "next ad in N visits" display).
 */
export async function registerTripVisit(): Promise<{ visitCount: number; shouldShowAd: boolean }> {
  const next = (await readVisitCount()) + 1;
  await writeVisitCount(next);
  return { visitCount: next, shouldShowAd: shouldShowAdOnVisit(next) };
}

/**
 * Read-only snapshot for diagnostics (does NOT increment).
 */
export async function getTripVisitSnapshot(): Promise<{ visitCount: number }> {
  return { visitCount: await readVisitCount() };
}
