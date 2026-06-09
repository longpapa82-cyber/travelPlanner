/**
 * Auto-Interstitial Ad Hook - Native (iOS/Android)
 *
 * Ports the proven "load → show immediately on LOADED" pattern from the myBaby
 * project, where auto-interstitials reliably surface. The previous travelPlanner
 * approach pre-loaded an interstitial on mount and only showed it later from a
 * rare user action (trip create/edit, every-3rd visit). That split between
 * load-time and show-time, combined with the low fill rate of non-personalized
 * (NPA) iOS ad requests, meant the ad was usually stale or unloaded by the time
 * show() was called — so it almost never appeared.
 *
 * This hook instead, on a host screen the user reaches often (the trip list),
 * waits a short delay then loads a fresh interstitial and shows it the instant
 * it loads — no gap for the ad to expire and no dependence on a rare trigger.
 *
 * Guards preserved from travelPlanner:
 *  - isPremium / isAdmin → never show (paid + operational accounts are ad-free)
 *  - isLoggingOut        → never show (Invariant 36 logout race window)
 *  - canShowAd('interstitial') frequency cap (global cooldown + session cap)
 *  - consent isReady     → wait so the request matches the NPA decision
 *
 * Freeze safety (myBaby lesson): LOADED/ERROR/CLOSED listeners are all handled
 * and every listener is unsubscribed on cleanup so the app is never "trapped"
 * behind a native full-screen ad.
 */

import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { canShowAd, recordAdShown } from './adFrequency';
import { usePremium } from '../../contexts/PremiumContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGDPRConsent } from '../../hooks/useGDPRConsent';

const extra = Constants.expoConfig?.extra || {};

const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.OS === 'ios'
    ? extra.admob?.interstitialAdUnitId?.ios || ''
    : extra.admob?.interstitialAdUnitId?.android || '';

/**
 * Delay after the host screen mounts before loading+showing the auto ad.
 * Lets the screen's own content land first so the ad doesn't slam the user the
 * instant they arrive (myBaby uses 20s on its feed). Revenue ⇄ UX lever.
 */
const FIRST_SHOW_DELAY_MS = 15000;

/**
 * Mount on a frequently-visited screen to enable automatic interstitials.
 * Fire-and-forget: returns nothing. All exposure is still gated by the
 * frequency caps in adFrequency, so this won't over-show.
 */
export function useAutoInterstitial(): void {
  const { isPremium, isAdmin } = usePremium();
  const { isLoggingOut } = useAuth();
  const { isReady } = useGDPRConsent();

  // Latest-value refs so the focus callback / delayed timer act on current
  // state without needing these as dependencies (useFocusEffect re-runs on
  // every focus regardless, so we don't want a stale-closure tax either).
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  const isLoggingOutRef = useRef(isLoggingOut);
  isLoggingOutRef.current = isLoggingOut;

  // Re-arm on EVERY screen focus, not once on mount. A tab screen mounts once
  // and never unmounts, so a plain useEffect gave only a single ad chance for
  // the whole app session. useFocusEffect fires each time the user lands on the
  // host screen, so the auto ad gets a fresh chance per visit.
  useFocusEffect(
    useCallback(() => {
    // Don't even arm the timer until consent has resolved and ads are eligible.
    if (!isReadyRef.current) return;
    if (!INTERSTITIAL_UNIT_ID) return;
    if (isPremiumRef.current || isAdminRef.current) return;

    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    const timer = setTimeout(async () => {
      if (cancelled) return;
      // Re-check guards at fire time (state may have changed during the delay).
      if (isPremiumRef.current || isAdminRef.current || isLoggingOutRef.current) {
        console.log('[AutoIntl] ⛔ guard blocked', { premium: isPremiumRef.current, admin: isAdminRef.current, loggingOut: isLoggingOutRef.current });
        return;
      }
      // Respect the frequency cap before requesting an ad we couldn't show.
      const allowed = await canShowAd('interstitial');
      console.log('[AutoIntl] ⏱️ timer fired, canShowAd(interstitial)=', allowed);
      if (cancelled || !allowed) return;

      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });
      console.log('[AutoIntl] 📋 load() requested, unit=', INTERSTITIAL_UNIT_ID);

      unsubscribers.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          console.log('[AutoIntl] ✅ LOADED — calling show()');
          // Re-check guards once more right before the native show.
          if (cancelled || isPremiumRef.current || isAdminRef.current || isLoggingOutRef.current) {
            console.log('[AutoIntl] ⛔ guard blocked at show time');
            return;
          }
          ad.show().catch((e) => console.log('[AutoIntl] ❌ show() threw', String(e)));
          recordAdShown('interstitial').catch(() => {});
        }),
      );

      // no-fill / network error and close: handled (and listeners cleaned up
      // below) so the app is never trapped behind the native full-screen ad.
      unsubscribers.push(ad.addAdEventListener(AdEventType.ERROR, (e) => console.log('[AutoIntl] ❌ ERROR (no-fill/network)', JSON.stringify(e))));
      unsubscribers.push(ad.addAdEventListener(AdEventType.CLOSED, () => console.log('[AutoIntl] 🔒 CLOSED')));

      ad.load();
    }, FIRST_SHOW_DELAY_MS);
    console.log('[AutoIntl] 🔫 armed: will attempt in', FIRST_SHOW_DELAY_MS / 1000, 's');

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribers.forEach((unsub) => unsub());
    };
    }, []),
  );
}
