/**
 * AdMob SDK Initialization (Native only) - Enhanced Version
 *
 * CRITICAL FIXES:
 * 1. Single initialization point to prevent race conditions
 * 2. Enhanced test device detection and configuration
 * 3. Comprehensive error logging for Alpha testing
 * 4. Device hash extraction from error messages
 * 5. Proper SDK initialization before AdManager
 */
import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import { Platform, DeviceEventEmitter } from 'react-native';

// Known test device hashes - Add Alpha tester devices here
const ALPHA_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  // Add your Alpha tester device hashes here
  // They will be shown in console logs when ads fail to load
];

let initialized = false;
let initializationPromise: Promise<void> | null = null;

export async function initializeAds(): Promise<void> {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    console.log('[AdMob] ⏳ Waiting for existing initialization...');
    return initializationPromise;
  }

  if (initialized) {
    console.log('[AdMob] ✅ Already initialized');
    return Promise.resolve();
  }

  // Create and store the initialization promise
  initializationPromise = performInitialization();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

async function performInitialization(): Promise<void> {
  try {
    console.log('[AdMob] 🚀 Starting comprehensive AdMob initialization...');
    console.log('[AdMob] 📱 Platform:', Platform.OS);
    console.log('[AdMob] 🔧 Mode:', __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION');

    // 1. Configure test devices FIRST (critical for Alpha testing)
    const testDeviceIds = [...ALPHA_TEST_DEVICE_HASHES];

    console.log('[AdMob] 📝 Configuring test devices:', testDeviceIds.length);

    // Set request configuration
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers: testDeviceIds,
    });

    // 2. Google UMP consent (GDPR) — must come after config but before init
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();
      console.log('[AdMob] 📋 Consent status:', consentInfo.status);

      if (
        consentInfo.status === AdsConsentStatus.REQUIRED ||
        consentInfo.status === AdsConsentStatus.UNKNOWN
      ) {
        console.log('[AdMob] 📋 Showing consent form...');
        const consentResult = await AdsConsent.loadAndShowConsentFormIfRequired();
        console.log('[AdMob] 📋 Consent form result:', consentResult);
      }
    } catch (error) {
      // UMP not configured in AdMob console yet — proceed without consent form
      console.log('[AdMob] ℹ️  UMP consent not configured, proceeding without consent form');
    }

    // 3. ATT is handled by useTrackingTransparency + PrePermissionATTModal
    //    (deferred until session >= 3). Do NOT request here.

    // 4. Initialize AdMob SDK
    console.log('[AdMob] 🎯 Initializing AdMob SDK...');
    const adapterStatuses = await mobileAds().initialize();

    // Log adapter status for debugging
    console.log('[AdMob] 📊 SDK Initialization complete. Adapter statuses:');
    Object.keys(adapterStatuses).forEach(adapter => {
      const status = (adapterStatuses as any)[adapter];
      console.log(`[AdMob]   ${adapter}: ${status.state} (${status.description || 'ready'})`);
    });

    initialized = true;
    console.log('[AdMob] ✅ AdMob SDK initialized successfully');

    // 5. Log helpful debugging information
    logDebugInfo();

    // 6. Set up device hash detection listener
    setupDeviceHashDetection();

    // 7. Initialize AdManager singleton for ad loading and management
    // Use dynamic import to ensure proper module resolution
    const AdManager = require('./adManager').default;
    await AdManager.initialize();
    console.log('[AdMob] ✅ AdManager initialized successfully');

  } catch (error) {
    console.error('[AdMob] ❌ AdMob initialization failed:', error);

    // Extract device hash from error if present
    extractDeviceHashFromError(error);

    // Log helpful debugging info
    logInitializationError(error);

    // Don't throw - allow app to continue without ads
    // But set initialized to false so we can retry
    initialized = false;
  }
}

/**
 * Extract device hash from error messages
 */
function extractDeviceHashFromError(error: any): void {
  const errorMessage = String(error);

  // Look for device hash patterns in error messages
  const patterns = [
    /device:\s*([A-F0-9]{32})/i,
    /setTestDeviceIds.*"([A-F0-9]{32})"/i,
    /test device ID.*([A-F0-9]{32})/i,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      const hash = match[1];
      console.log('[AdMob] 🔑 DEVICE HASH DETECTED:', hash);
      console.log('[AdMob] ⚠️  ACTION REQUIRED:');
      console.log('[AdMob]    1. Add this hash to ALPHA_TEST_DEVICE_HASHES in initAds.native.ts');
      console.log('[AdMob]    2. Rebuild the app');
      console.log('[AdMob]    3. Test ads should then work on this device');

      DeviceEventEmitter.emit('AdMobDeviceHashDetected', hash);
      break;
    }
  }
}

/**
 * Set up device hash detection from various sources
 */
function setupDeviceHashDetection(): void {
  // Listen for device hash detection from ad loading errors
  DeviceEventEmitter.addListener('AdMobDeviceHashDetected', (hash: string) => {
    if (hash && !ALPHA_TEST_DEVICE_HASHES.includes(hash)) {
      console.log('[AdMob] 🔑 New device hash detected:', hash);
      console.log('[AdMob] ⚠️  Add to ALPHA_TEST_DEVICE_HASHES and rebuild');
    }
  });
}

/**
 * Log helpful debugging information
 */
function logDebugInfo(): void {
  console.log('[AdMob] 🔍 DEBUGGING INFORMATION:');
  console.log('[AdMob] ========================================');
  console.log('[AdMob] Platform:', Platform.OS);
  console.log('[AdMob] Dev Mode:', __DEV__ ? 'YES' : 'NO');
  console.log('[AdMob] Test Devices Configured:', ALPHA_TEST_DEVICE_HASHES.length);

  if (!__DEV__) {
    console.log('[AdMob] 📱 PRODUCTION BUILD - IMPORTANT:');
    console.log('[AdMob]    • Real ads will be shown (if AdMob approved)');
    console.log('[AdMob]    • Test devices will see test ads');
    console.log('[AdMob]    • If NO ADS appear, check:');
    console.log('[AdMob]      1. Device hash is in ALPHA_TEST_DEVICE_HASHES');
    console.log('[AdMob]      2. AdMob account approval status');
    console.log('[AdMob]      3. Ad unit IDs are correct');
    console.log('[AdMob]      4. Network connectivity');
    console.log('[AdMob]      5. No ad blocker/VPN active');
  }

  console.log('[AdMob] ========================================');
  console.log('[AdMob] 💡 TO FIND YOUR DEVICE HASH:');
  console.log('[AdMob]    1. Try to load an ad');
  console.log('[AdMob]    2. Check console for "DEVICE HASH DETECTED"');
  console.log('[AdMob]    3. Add hash to ALPHA_TEST_DEVICE_HASHES');
  console.log('[AdMob]    4. Rebuild and test again');
  console.log('[AdMob] ========================================');
}

/**
 * Log helpful information when initialization fails
 */
function logInitializationError(error: any): void {
  const errorStr = String(error);

  console.log('[AdMob] ❌ INITIALIZATION FAILURE ANALYSIS:');

  if (errorStr.includes('Module not found') || errorStr.includes('Cannot find module')) {
    console.log('[AdMob] ℹ️  Module issue. Try:');
    console.log('[AdMob]    1. npm install react-native-google-mobile-ads');
    console.log('[AdMob]    2. cd ios && pod install');
    console.log('[AdMob]    3. Rebuild the app');
  } else if (errorStr.includes('Application ID') || errorStr.includes('app ID')) {
    console.log('[AdMob] ℹ️  App ID issue. Check:');
    console.log('[AdMob]    1. app.config.js has correct androidAppId/iosAppId');
    console.log('[AdMob]    2. IDs match your AdMob account');
    console.log('[AdMob]    3. Rebuild after config changes');
  } else if (errorStr.includes('Network')) {
    console.log('[AdMob] ℹ️  Network issue. Check:');
    console.log('[AdMob]    1. Internet connectivity');
    console.log('[AdMob]    2. Firewall/proxy settings');
    console.log('[AdMob]    3. AdMob services accessibility');
  }
}

// Export for debugging purposes
export function getTestDeviceHashes(): string[] {
  return [...ALPHA_TEST_DEVICE_HASHES];
}

export function isAdsInitialized(): boolean {
  return initialized;
}