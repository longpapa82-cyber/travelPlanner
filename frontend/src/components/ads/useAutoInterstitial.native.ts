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
import { logAutoIntl } from './autoInterstitialDiag'; // ⚠️ TEMP diag (2026-06-09)
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
  //
  // V (2026-06-09): `isReady` is in the deps so this callback is recreated when
  // consent resolves. react-navigation re-runs the focus effect on a new
  // callback while the screen is focused — so if focus happened BEFORE consent
  // was ready (the original bug: BLOCKED !isReady), arming now retries the
  // instant isReady flips true instead of waiting for the next manual focus.
  useFocusEffect(
    useCallback(() => {
    // ⚠️ TEMP DIAG (2026-06-09): record to AsyncStorage (Ad Debug reads it).
    // console.log is invisible on production Hermes builds, so we trace on-device.
    logAutoIntl(`focus: ready=${isReady} unit=${!!INTERSTITIAL_UNIT_ID} prem=${isPremiumRef.current} admin=${isAdminRef.current}`);
    // Don't even arm the timer until consent has resolved and ads are eligible.
    if (!isReady) { logAutoIntl('BLOCKED !isReady'); return; }
    if (!INTERSTITIAL_UNIT_ID) { logAutoIntl('BLOCKED no unit id'); return; }
    if (isPremiumRef.current || isAdminRef.current) { logAutoIntl('BLOCKED premium/admin'); return; }

    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    const timer = setTimeout(async () => {
      if (cancelled) return;
      // Re-check guards at fire time (state may have changed during the delay).
      if (isPremiumRef.current || isAdminRef.current || isLoggingOutRef.current) {
        logAutoIntl(`BLOCKED at fire: prem=${isPremiumRef.current} admin=${isAdminRef.current} logout=${isLoggingOutRef.current}`);
        return;
      }
      // Respect the frequency cap before requesting an ad we couldn't show.
      const allowed = await canShowAd('interstitial');
      logAutoIntl(`timer fired, canShowAd=${allowed}`);
      if (cancelled || !allowed) return;

      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });
      logAutoIntl('load() requested');

      unsubscribers.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          logAutoIntl('✅ LOADED — calling show()');
          // Re-check guards once more right before the native show.
          if (cancelled || isPremiumRef.current || isAdminRef.current || isLoggingOutRef.current) {
            logAutoIntl('BLOCKED at show time');
            return;
          }
          ad.show().catch((e) => logAutoIntl(`show() threw ${String(e)}`));
          recordAdShown('interstitial').catch(() => {});
        }),
      );

      // no-fill / network error and close: handled (and listeners cleaned up
      // below) so the app is never trapped behind the native full-screen ad.
      unsubscribers.push(ad.addAdEventListener(AdEventType.ERROR, (e) => logAutoIntl(`❌ ERROR (no-fill/net) ${JSON.stringify(e)}`)));
      unsubscribers.push(ad.addAdEventListener(AdEventType.CLOSED, () => logAutoIntl('CLOSED')));

      ad.load();
    }, FIRST_SHOW_DELAY_MS);
    logAutoIntl(`🔫 armed: attempt in ${FIRST_SHOW_DELAY_MS / 1000}s`);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribers.forEach((unsub) => unsub());
    };
    }, [isReady]),
  );
}
