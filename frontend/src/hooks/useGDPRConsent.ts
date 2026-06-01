/**
 * GDPR/UMP Consent Hook (Native)
 *
 * Uses Google UMP SDK via react-native-google-mobile-ads AdsConsent API.
 * For EU users, shows the consent form before personalized ads.
 * Non-EU users pass through without interruption.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

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

    // Safety timeout: if initialization hangs, proceed with non-personalized ads
    const safetyTimeout = setTimeout(async () => {
      if (mounted && !isReady) {
        console.log('[useGDPRConsent] Timeout — proceeding without consent result');
        let attGranted = false;
        if (Platform.OS === 'ios') {
          try {
            const { getATTStatus } = await import('../utils/initAds.native');
            attGranted = await getATTStatus();
          } catch {}
        }
        setConsentStatus('unknown');
        setCanShowPersonalizedAds(Platform.OS === 'ios' ? attGranted : false);
        setIsReady(true);
      }
    }, 5000);

    (async () => {
      try {
        const { AdsConsent, AdsConsentStatus } = await import('react-native-google-mobile-ads');
        const { initializeAds, getATTStatus } = await import('../utils/initAds.native');

        // Wait for the central ad initialization flow to complete (handles UMP + ATT prompts)
        await initializeAds();

        if (!mounted) return;

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

        // On iOS, also require ATT permission for personalized ads
        let attGranted = true;
        if (Platform.OS === 'ios') {
          attGranted = await getATTStatus();
          console.log('[useGDPRConsent] iOS ATT permission status:', attGranted);
        }

        const allowed = gdprPersonalized && attGranted;
        console.log('[useGDPRConsent] Personalization allowed:', allowed, '(GDPR:', gdprPersonalized, 'ATT:', attGranted, ')');

        if (mounted) {
          setConsentStatus(status);
          setCanShowPersonalizedAds(allowed);
        }
      } catch (error) {
        console.error('[useGDPRConsent] Error checking consent:', error);
        if (mounted) {
          setConsentStatus('unknown');
          let attGranted = false;
          try {
            const { getATTStatus } = await import('../utils/initAds.native');
            attGranted = await getATTStatus();
          } catch {}
          setCanShowPersonalizedAds(Platform.OS === 'ios' ? attGranted : true);
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
