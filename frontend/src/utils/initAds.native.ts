/**
 * AdMob SDK Initialization (Native only)
 *
 * 1. Requests Google UMP consent (GDPR) before ad initialization
 * 2. Requests ATT permission on iOS 14+ so Google respects tracking preference
 * 3. Initializes AdMob SDK with appropriate content rating
 */
import { Platform } from 'react-native';
import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

let initialized = false;

export async function initializeAds(): Promise<void> {
  if (initialized) return;

  try {
    // 1. Google UMP consent (GDPR) — must come before SDK init
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();
      if (
        consentInfo.status === AdsConsentStatus.REQUIRED ||
        consentInfo.status === AdsConsentStatus.UNKNOWN
      ) {
        await AdsConsent.loadAndShowConsentFormIfRequired();
      }
    } catch {
      // UMP not configured in AdMob console yet — proceed without consent form
    }

    // 2. Request ATT before SDK init so Google respects the choice (iOS only)
    if (Platform.OS === 'ios') {
      try {
        const { requestTrackingPermissionsAsync } = await import(
          'expo-tracking-transparency'
        );
        await requestTrackingPermissionsAsync();
      } catch {
        // ATT not available (older iOS or simulator) — proceed anyway
      }
    }

    // 3. Configure and initialize AdMob
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    await mobileAds().initialize();
    initialized = true;
  } catch (error) {
    if (__DEV__) {
      console.warn('AdMob initialization failed:', error);
    }
  }
}
