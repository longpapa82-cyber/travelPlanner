/**
 * Ad Frequency Capping Utility
 *
 * Controls how often full-screen ads (interstitial, app-open, rewarded) are shown.
 * - Minimum 3-minute interval between any full-screen ad
 * - Maximum 5 full-screen ads per session
 * - Last-shown timestamp persisted in AsyncStorage across launches
 * - Session count is in-memory only (resets on app restart)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@ad_last_fullscreen_shown';
const MIN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_SESSION_COUNT = 5;

let sessionCount = 0;
let lastShownTimestamp = 0;
let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      lastShownTimestamp = parseInt(stored, 10) || 0;
    }
  } catch {
    // Silently ignore — default to 0
  }
  initialized = true;
}

/**
 * Check whether a full-screen ad can be shown right now.
 * Returns true if both the time interval and session cap are satisfied.
 */
export async function canShowFullScreenAd(): Promise<boolean> {
  await ensureInitialized();
  if (sessionCount >= MAX_SESSION_COUNT) return false;
  const elapsed = Date.now() - lastShownTimestamp;
  return elapsed >= MIN_INTERVAL_MS;
}

/**
 * Record that a full-screen ad was just shown.
 * Updates both in-memory state and persisted timestamp.
 */
export async function recordFullScreenAdShown(): Promise<void> {
  sessionCount++;
  lastShownTimestamp = Date.now();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(lastShownTimestamp));
  } catch {
    // Non-critical — best-effort persistence
  }
}

/**
 * Reset the session counter (e.g. on fresh app launch if needed).
 */
export function resetSessionCount(): void {
  sessionCount = 0;
}
