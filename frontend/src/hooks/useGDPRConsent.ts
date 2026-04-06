/**
 * GDPR/UMP Consent Hook (Native)
 *
 * Uses Google UMP SDK via react-native-google-mobile-ads AdsConsent API.
 * For EU users, shows the consent form before personalized ads.
 * Non-EU users pass through without interruption.
 */

import { useEffect, useState, useCallback } from 'react';

type ConsentStatus = 'unknown' | 'required' | 'not_required' | 'obtained';

interface GDPRConsentResult {
  consentStatus: ConsentStatus;
  canShowPersonalizedAds: boolean;
  isReady: boolean;
}

export function useGDPRConsent(): GDPRConsentResult {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('unknown');
  const [canShowPersonalizedAds, setCanShowPersonalizedAds] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Safety timeout: if UMP SDK hangs, proceed with non-personalized ads
    const safetyTimeout = setTimeout(() => {
      if (mounted && !isReady) {
        console.log('[useGDPRConsent] Timeout — proceeding without UMP result');
        setConsentStatus('not_required');
        setCanShowPersonalizedAds(false);
        setIsReady(true);
      }
    }, 5000);

    (async () => {
      try {
        const { AdsConsent, AdsConsentStatus } = await import('react-native-google-mobile-ads');

        // Request consent info update (checks geography, prior consent)
        const consentInfo = await AdsConsent.requestInfoUpdate();

        if (!mounted) return;

        if (consentInfo.status === AdsConsentStatus.REQUIRED) {
          // EU user who hasn't consented yet — show form
          setConsentStatus('required');
          try {
            const formResult = await AdsConsent.loadAndShowConsentFormIfRequired();
            if (!mounted) return;
            if (formResult.status === AdsConsentStatus.OBTAINED) {
              setConsentStatus('obtained');
              // Check if they allowed personalized ads
              const purposes = await AdsConsent.getUserChoices();
              setCanShowPersonalizedAds(purposes.storeAndAccessInformationOnDevice);
            } else {
              setConsentStatus('required');
              setCanShowPersonalizedAds(false);
            }
          } catch {
            // Form load/show failed — fall back to non-personalized
            if (mounted) setCanShowPersonalizedAds(false);
          }
        } else if (consentInfo.status === AdsConsentStatus.OBTAINED) {
          setConsentStatus('obtained');
          const purposes = await AdsConsent.getUserChoices();
          if (mounted) setCanShowPersonalizedAds(purposes.storeAndAccessInformationOnDevice);
        } else {
          // NOT_REQUIRED (non-EU) or UNKNOWN
          setConsentStatus('not_required');
          setCanShowPersonalizedAds(true);
        }
      } catch {
        // UMP SDK not available or error — default to non-personalized
        if (mounted) {
          setConsentStatus('not_required');
          setCanShowPersonalizedAds(true);
        }
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  return { consentStatus, canShowPersonalizedAds, isReady };
}
