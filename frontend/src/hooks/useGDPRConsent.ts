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
import { logAutoIntl } from '../components/ads/autoInterstitialDiag'; // ⚠️ TEMP diag (2026-06-09)

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
      logAutoIntl('GDPR: 5s TIMEOUT → isReady=true'); // ⚠️ TEMP diag
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
      logAutoIntl('GDPR: before initializeAds()'); // ⚠️ TEMP diag
      const { AdsConsent, AdsConsentStatus } = await import('react-native-google-mobile-ads');
      const { initializeAds, getATTStatus } = await import('../utils/initAds.native');

      await initializeAds();
      logAutoIntl('GDPR: initializeAds() done'); // ⚠️ TEMP diag

      const consentInfo = await AdsConsent.requestInfoUpdate();
      logAutoIntl(`GDPR: requestInfoUpdate done status=${consentInfo.status}`); // ⚠️ TEMP diag
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
      logAutoIntl(`GDPR: CATCH ${String(error).slice(0, 60)}`); // ⚠️ TEMP diag
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
      logAutoIntl('GDPR: finally → isReady=true'); // ⚠️ TEMP diag
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
