/**
 * GDPR/UMP Consent Hook (Native)
 *
 * Uses Google UMP SDK via react-native-google-mobile-ads AdsConsent API.
 * For EU users, shows the consent form before personalized ads.
 * Non-EU users pass through without interruption.
 *
 * SINGLETON (2026-06-09): consent is resolved ONCE at the module level and the
 * result is shared by every caller. Previously this hook ran its full async
 * resolution per component instance — AdBanner (mounted on 3 screens),
 * useAutoInterstitial, useInterstitialAd, useAppOpenAd, useRewardedAd each
 * spun up their own copy. That fragmented `isReady`: a late-resolving instance
 * could report isReady=false at the exact moment a consumer checked it (e.g.
 * useAutoInterstitial's focus callback), and since the consumer didn't re-run on
 * the later flip, the auto-interstitial never armed. Centralizing fixes both the
 * redundant initializeAds() calls and the per-instance isReady race.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type ConsentStatus = 'unknown' | 'required' | 'not_required' | 'obtained';

interface GDPRConsentResult {
  consentStatus: ConsentStatus;
  canShowPersonalizedAds: boolean;
  isReady: boolean;
}

// ── Module-level shared state ───────────────────────────────────────────────
let sharedState: GDPRConsentResult = {
  consentStatus: 'unknown',
  canShowPersonalizedAds: true,
  isReady: false,
};
let resolutionPromise: Promise<void> | null = null;
const subscribers = new Set<(s: GDPRConsentResult) => void>();

function publish(next: Partial<GDPRConsentResult>): void {
  sharedState = { ...sharedState, ...next };
  subscribers.forEach((fn) => fn(sharedState));
}

/**
 * Resolve consent exactly once, process-wide. Subsequent callers await the same
 * in-flight promise (or return instantly if already resolved).
 */
function resolveConsentOnce(): Promise<void> {
  if (sharedState.isReady) return Promise.resolve();
  if (resolutionPromise) return resolutionPromise;

  resolutionPromise = (async () => {
    // Safety timeout: if initialization hangs, proceed with non-personalized ads.
    let settled = false;
    const safety = setTimeout(async () => {
      if (settled || sharedState.isReady) return;
      let attGranted = false;
      if (Platform.OS === 'ios') {
        try {
          const { getATTStatus } = await import('../utils/initAds.native');
          attGranted = await getATTStatus();
        } catch {}
      }
      publish({
        consentStatus: 'unknown',
        canShowPersonalizedAds: Platform.OS === 'ios' ? attGranted : false,
        isReady: true,
      });
    }, 5000);

    try {
      const { AdsConsent, AdsConsentStatus } = await import('react-native-google-mobile-ads');
      const { initializeAds, getATTStatus } = await import('../utils/initAds.native');

      await initializeAds();

      const consentInfo = await AdsConsent.requestInfoUpdate();
      let gdprPersonalized = true;
      let status: ConsentStatus = 'not_required';

      if (consentInfo.status === AdsConsentStatus.REQUIRED) {
        status = 'required';
        gdprPersonalized = false;
      } else if (consentInfo.status === AdsConsentStatus.OBTAINED) {
        status = 'obtained';
        try {
          const purposes = await AdsConsent.getUserChoices();
          gdprPersonalized = purposes.storeAndAccessInformationOnDevice;
        } catch (e) {
          console.log('[useGDPRConsent] Error getting UMP choices:', e);
          gdprPersonalized = false;
        }
      }

      // On iOS, also require ATT permission for personalized ads.
      let attGranted = true;
      if (Platform.OS === 'ios') {
        attGranted = await getATTStatus();
      }

      const allowed = gdprPersonalized && attGranted;
      publish({ consentStatus: status, canShowPersonalizedAds: allowed });
    } catch (error) {
      console.error('[useGDPRConsent] Error checking consent:', error);
      let attGranted = false;
      try {
        const { getATTStatus } = await import('../utils/initAds.native');
        attGranted = await getATTStatus();
      } catch {}
      publish({
        consentStatus: 'unknown',
        canShowPersonalizedAds: Platform.OS === 'ios' ? attGranted : true,
      });
    } finally {
      settled = true;
      clearTimeout(safety);
      publish({ isReady: true });
    }
  })();

  return resolutionPromise;
}

export function useGDPRConsent(): GDPRConsentResult {
  const [state, setState] = useState<GDPRConsentResult>(sharedState);

  useEffect(() => {
    // Subscribe to shared updates, then kick off the one-time resolution.
    subscribers.add(setState);
    setState(sharedState); // sync immediately in case it resolved before mount
    resolveConsentOnce();
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  return state;
}
