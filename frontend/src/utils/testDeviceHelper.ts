/**
 * Test Device Helper for AdMob
 *
 * Helps identify and configure test devices for AdMob ads.
 * This is crucial for Alpha testing to ensure testers see ads.
 */

import mobileAds from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

/**
 * Known test device hashes from Alpha testers
 * These should be added as you identify them from logs
 */
const ALPHA_TEST_DEVICE_HASHES: string[] = [
  // Add device hashes here as you find them in logs
  // Example: '33BE2250B43518CCDA7DE426D04EE231'
];

/**
 * Shows the device hash in console for easy identification
 * Call this during app startup to identify test devices
 */
export async function logTestDeviceInfo(): Promise<void> {
  try {
    console.log('[AdMob] ========================================');
    console.log('[AdMob] TEST DEVICE INFORMATION');
    console.log('[AdMob] ========================================');
    console.log('[AdMob] Platform:', Platform.OS);
    console.log('[AdMob] Dev Mode:', __DEV__ ? 'YES' : 'NO');

    // The device hash will be shown in AdMob logs when an ad request is made
    console.log('[AdMob] To find your device hash:');
    console.log('[AdMob] 1. Run the app and try to load an ad');
    console.log('[AdMob] 2. Look for "Use RequestConfiguration.Builder().setTestDeviceIds(Arrays.asList("YOUR_DEVICE_HASH"))" in logs');
    console.log('[AdMob] 3. Add that hash to ALPHA_TEST_DEVICE_HASHES array');
    console.log('[AdMob] ========================================');

    // If you're seeing no ads at all, this message helps debug
    if (!__DEV__) {
      console.log('[AdMob] PRODUCTION BUILD DETECTED');
      console.log('[AdMob] - Real ads will be shown (if AdMob account is approved)');
      console.log('[AdMob] - Test devices will see test ads');
      console.log('[AdMob] - If you see no ads, check:');
      console.log('[AdMob]   1. AdMob account approval status');
      console.log('[AdMob]   2. Ad unit IDs are correct');
      console.log('[AdMob]   3. Network connectivity');
      console.log('[AdMob]   4. Device is not using ad blocker/VPN');
      console.log('[AdMob] ========================================');
    }
  } catch (error) {
    console.error('[AdMob] Failed to log test device info:', error);
  }
}

/**
 * Configure test devices for Alpha testing
 * This ensures Alpha testers can see test ads even in production builds
 */
export async function configureAlphaTestDevices(): Promise<void> {
  const allTestDevices = [
    'EMULATOR',
    'SIMULATOR',
    ...ALPHA_TEST_DEVICE_HASHES,
  ];

  await mobileAds().setRequestConfiguration({
    testDeviceIdentifiers: allTestDevices,
  });

  console.log(`[AdMob] Configured ${allTestDevices.length} test devices`);
}

/**
 * Helper to determine if current device should see test ads
 */
export function shouldShowTestAds(): boolean {
  // Always show test ads in dev mode
  if (__DEV__) return true;

  // In production, only specific test devices see test ads
  // This is handled by the testDeviceIdentifiers configuration
  return false;
}