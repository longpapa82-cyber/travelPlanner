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

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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

  // Latest-value refs so the delayed callback doesn't act on a stale snapshot.
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  const isLoggingOutRef = useRef(isLoggingOut);
  isLoggingOutRef.current = isLoggingOut;

  useEffect(() => {
    // Don't even arm the timer until consent has resolved and ads are eligible.
    if (!isReady) return;
    if (!INTERSTITIAL_UNIT_ID) return;
    if (isPremium || isAdmin) return;

    let cancelled = false;
    const unsubscribers: (() => void)[] = [];

    const timer = setTimeout(async () => {
      if (cancelled) return;
      // Re-check guards at fire time (state may have changed during the delay).
      if (isPremiumRef.current || isAdminRef.current || isLoggingOutRef.current) return;
      // Respect the frequency cap before requesting an ad we couldn't show.
      const allowed = await canShowAd('interstitial');
      if (cancelled || !allowed) return;

      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      unsubscribers.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          // Re-check guards once more right before the native show.
          if (cancelled || isPremiumRef.current || isAdminRef.current || isLoggingOutRef.current) {
            return;
          }
          ad.show().catch(() => {});
          recordAdShown('interstitial').catch(() => {});
        }),
      );

      // no-fill / network error and close: handled (and listeners cleaned up
      // below) so the app is never trapped behind the native full-screen ad.
      unsubscribers.push(ad.addAdEventListener(AdEventType.ERROR, () => {}));
      unsubscribers.push(ad.addAdEventListener(AdEventType.CLOSED, () => {}));

      ad.load();
    }, FIRST_SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isReady, isPremium, isAdmin]);
}
