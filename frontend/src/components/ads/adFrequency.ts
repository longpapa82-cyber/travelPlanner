/**
 * Ad Frequency Capping Utility
 *
 * Controls how often full-screen ads are shown, with PER-TYPE caps.
 *
 * Why per-type (prior bug): interstitial, app-open, and rewarded ads used to
 * share ONE counter and ONE timestamp. Showing an app-open ad on launch then
 * blocked interstitials for the next interval, and a single rewarded view ate
 * into the whole session budget. Splitting the budget per ad type lets each
 * surface fire on its own schedule.
 *
 * Design:
 * - A short GLOBAL cooldown still applies across all full-screen ads, so two
 *   different ad types can't stack back-to-back (jarring UX).
 * - Each ad type also has its OWN minimum interval and session cap.
 * - Rewarded ads are user-initiated (tap "watch ad for reward"), so they are
 *   NOT gated by caps — gating them would deny a reward the user explicitly
 *   asked for. They still update the global cooldown so a reward view doesn't
 *   immediately collide with an auto ad.
 *
 * Persistence:
 * - Per-type last-shown timestamps persist in AsyncStorage across launches.
 * - Session counts are in-memory only (reset on app restart).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type AdType = 'interstitial' | 'appOpen' | 'rewarded';

const STORAGE_KEY_PREFIX = '@ad_last_shown:';
const STORAGE_KEY_GLOBAL = '@ad_last_fullscreen_shown'; // kept = legacy global timestamp

// ── Tunables (revenue ⇄ UX trade-off — adjust here) ────────────────────────
/** Minimum gap between ANY two full-screen ads, regardless of type. */
const GLOBAL_COOLDOWN_MS = 60 * 1000; // 1 minute

interface AdTypePolicy {
  /** Minimum gap between two ads OF THIS TYPE. */
  minIntervalMs: number;
  /** Max times this type may show per session. null = uncapped. */
  maxSessionCount: number | null;
}

const POLICY: Record<AdType, AdTypePolicy> = {
  // Interstitial: fires on trip create/edit. Allow reasonably often.
  interstitial: { minIntervalMs: 90 * 1000, maxSessionCount: 8 },
  // App-open: fires on foreground return. Keep rarer to avoid annoyance.
  appOpen: { minIntervalMs: 4 * 60 * 1000, maxSessionCount: 4 },
  // Rewarded: user-initiated → uncapped, no per-type interval.
  rewarded: { minIntervalMs: 0, maxSessionCount: null },
};
// ───────────────────────────────────────────────────────────────────────────

const sessionCounts: Record<AdType, number> = {
  interstitial: 0,
  appOpen: 0,
  rewarded: 0,
};
const lastShownByType: Record<AdType, number> = {
  interstitial: 0,
  appOpen: 0,
  rewarded: 0,
};
let lastShownGlobal = 0;
let initialized = false;

function storageKey(type: AdType): string {
  return `${STORAGE_KEY_PREFIX}${type}`;
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true; // set first so concurrent callers don't double-init
  try {
    const entries = await AsyncStorage.multiGet([
      storageKey('interstitial'),
      storageKey('appOpen'),
      storageKey('rewarded'),
      STORAGE_KEY_GLOBAL,
    ]);
    for (const [key, value] of entries) {
      const ts = value ? parseInt(value, 10) || 0 : 0;
      if (key === STORAGE_KEY_GLOBAL) {
        lastShownGlobal = ts;
      } else if (key === storageKey('interstitial')) {
        lastShownByType.interstitial = ts;
      } else if (key === storageKey('appOpen')) {
        lastShownByType.appOpen = ts;
      } else if (key === storageKey('rewarded')) {
        lastShownByType.rewarded = ts;
      }
    }
  } catch {
    // Silently ignore — defaults to 0
  }
}

/**
 * Check whether a full-screen ad of the given type can be shown right now.
 * Returns true only if the global cooldown, the per-type interval, and the
 * per-type session cap are all satisfied.
 */
export async function canShowAd(type: AdType): Promise<boolean> {
  await ensureInitialized();
  const now = Date.now();

  // Global cooldown applies to every full-screen ad.
  if (now - lastShownGlobal < GLOBAL_COOLDOWN_MS) return false;

  const policy = POLICY[type];
  if (policy.maxSessionCount !== null && sessionCounts[type] >= policy.maxSessionCount) {
    return false;
  }
  if (now - lastShownByType[type] < policy.minIntervalMs) return false;

  return true;
}

/**
 * Record that a full-screen ad of the given type was just shown.
 * Updates in-memory state and persists both the per-type and global timestamp.
 */
export async function recordAdShown(type: AdType): Promise<void> {
  const now = Date.now();
  sessionCounts[type]++;
  lastShownByType[type] = now;
  lastShownGlobal = now;
  try {
    await AsyncStorage.multiSet([
      [storageKey(type), String(now)],
      [STORAGE_KEY_GLOBAL, String(now)],
    ]);
  } catch {
    // Non-critical — best-effort persistence
  }
}

/**
 * Snapshot of the frequency-cap state for diagnostics/debug UI.
 * Shows, per type, whether it's currently blocked and by which rule.
 */
export interface AdFrequencySnapshot {
  globalCooldownRemainingMs: number;
  perType: Record<AdType, {
    sessionCount: number;
    maxSessionCount: number | null;
    intervalRemainingMs: number;
    blockedReason: 'ok' | 'globalCooldown' | 'sessionCap' | 'interval';
  }>;
}

export async function getFrequencySnapshot(): Promise<AdFrequencySnapshot> {
  await ensureInitialized();
  const now = Date.now();
  const globalRemaining = Math.max(0, GLOBAL_COOLDOWN_MS - (now - lastShownGlobal));

  const types: AdType[] = ['interstitial', 'appOpen', 'rewarded'];
  const perType = {} as AdFrequencySnapshot['perType'];
  for (const type of types) {
    const policy = POLICY[type];
    const intervalRemaining = Math.max(0, policy.minIntervalMs - (now - lastShownByType[type]));
    let blockedReason: 'ok' | 'globalCooldown' | 'sessionCap' | 'interval' = 'ok';
    if (globalRemaining > 0) blockedReason = 'globalCooldown';
    else if (policy.maxSessionCount !== null && sessionCounts[type] >= policy.maxSessionCount) blockedReason = 'sessionCap';
    else if (intervalRemaining > 0) blockedReason = 'interval';
    perType[type] = {
      sessionCount: sessionCounts[type],
      maxSessionCount: policy.maxSessionCount,
      intervalRemainingMs: intervalRemaining,
      blockedReason,
    };
  }
  return { globalCooldownRemainingMs: globalRemaining, perType };
}

/** Reset all per-type session counters (e.g. on fresh app launch if needed). */
export function resetSessionCount(): void {
  sessionCounts.interstitial = 0;
  sessionCounts.appOpen = 0;
  sessionCounts.rewarded = 0;
}

// ── Backward-compatible shims (deprecated) ─────────────────────────────────
/** @deprecated Use canShowAd(type). Treated as an interstitial check. */
export async function canShowFullScreenAd(): Promise<boolean> {
  return canShowAd('interstitial');
}
/** @deprecated Use recordAdShown(type). Treated as an interstitial record. */
export async function recordFullScreenAdShown(): Promise<void> {
  return recordAdShown('interstitial');
}
