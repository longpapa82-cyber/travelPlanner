/**
 * AdMob SDK Initialization (Native only)
 *
 * Requests ATT permission on iOS 14+ before initializing AdMob,
 * so Google can respect the user's tracking preference from the start.
 */
import { Platform } from 'react-native';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';

let initialized = false;

export async function initializeAds(): Promise<void> {
  if (initialized) return;

  try {
    // Request ATT before SDK init so Google respects the choice
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
