/**
 * AdMob Test Device Detection
 *
 * Identifies test devices to show test ads during development/testing
 * while ensuring production users see real ads.
 */

import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import mobileAds from 'react-native-google-mobile-ads';

// Test device IDs (add your test devices here)
const TEST_DEVICE_IDS = [
  // Common test device IDs
  'EMULATOR',
  'SIMULATOR',
  // Add your actual test device IDs here
  // You can find these in AdMob logs when running the app
];

// Email domains that indicate internal testers
const TESTER_EMAIL_DOMAINS = [
  '@longpapa82.com',
  // Add your company/testing domains here
];

let isTestDevice: boolean | null = null;

/**
 * Determines if the current device should show test ads
 */
export async function isTestingDevice(): Promise<boolean> {
  // Cache the result
  if (isTestDevice !== null) return isTestDevice;

  try {
    // 1. Always show test ads in development
    if (__DEV__) {
      isTestDevice = true;
      return true;
    }

    // 2. Check if running on emulator/simulator
    const isEmulator = await DeviceInfo.isEmulator();
    if (isEmulator) {
      isTestDevice = true;
      return true;
    }

    // 3. Check device ID against test device list
    const deviceId = DeviceInfo.getUniqueId();
    if (TEST_DEVICE_IDS.includes(deviceId)) {
      isTestDevice = true;
      return true;
    }

    // 4. Check if it's a debug build (not from store)
    const buildType = await DeviceInfo.getBuildId();
    if (buildType.includes('debug') || buildType.includes('test')) {
      isTestDevice = true;
      return true;
    }

    // 5. Default to production ads
    isTestDevice = false;
    return false;
  } catch (error) {
    // If we can't determine, default to production ads for safety
    console.warn('[AdMob] Could not determine test device status:', error);
    isTestDevice = false;
    return false;
  }
}

/**
 * Configures AdMob for test or production mode
 */
export async function configureAdMobTestMode(): Promise<void> {
  const isTest = await isTestingDevice();

  if (isTest) {
    // Configure test device IDs for AdMob
    await mobileAds().setRequestConfiguration({
      testDeviceIdentifiers: ['EMULATOR', 'SIMULATOR'],
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    console.log('[AdMob] Configured for TEST mode - showing test ads');
  } else {
    console.log('[AdMob] Configured for PRODUCTION mode - showing real ads');
  }
}

/**
 * Gets the appropriate ad unit ID based on test/production mode
 */
export async function getAdUnitId(
  productionId: string,
  testId: string
): Promise<string> {
  const isTest = await isTestingDevice();
  return isTest ? testId : productionId;
}