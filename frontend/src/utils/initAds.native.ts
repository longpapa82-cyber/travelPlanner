/**
 * AdMob SDK Initialization (Native only)
 *
 * 1. Requests Google UMP consent (GDPR) before ad initialization
 * 2. ATT is deferred to useTrackingTransparency + PrePermissionATTModal (session >= 3)
 * 3. Initializes AdMob SDK with appropriate content rating
 */
import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

let initialized = false;

export async function initializeAds(): Promise<void> {
  if (initialized) return;

  try {
    console.log('[AdMob] Starting AdMob initialization...');

    // 1. Configure test devices FIRST (important for Alpha testing)
    const testDeviceIds = ['EMULATOR', 'SIMULATOR'];

    // In development, always use test ads
    if (__DEV__) {
      console.log('[AdMob] Development mode - configuring for test ads');
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIdentifiers: testDeviceIds,
      });
    } else {
      console.log('[AdMob] Production mode - using production ads');
      // For production builds (including Alpha), still set test device IDs
      // This allows internal testers to see test ads
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        // Note: In production, only devices with these IDs will see test ads
        // All other devices will see real ads
        testDeviceIdentifiers: testDeviceIds,
      });
    }

    // 2. Google UMP consent (GDPR) — must come after config but before init
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();
      console.log('[AdMob] Consent status:', consentInfo.status);

      if (
        consentInfo.status === AdsConsentStatus.REQUIRED ||
        consentInfo.status === AdsConsentStatus.UNKNOWN
      ) {
        await AdsConsent.loadAndShowConsentFormIfRequired();
      }
    } catch (error) {
      // UMP not configured in AdMob console yet — proceed without consent form
      console.log('[AdMob] UMP consent not configured, proceeding without consent form');
    }

    // 3. ATT is handled by useTrackingTransparency + PrePermissionATTModal
    //    (deferred until session >= 3). Do NOT request here to avoid
    //    conflicting with the deferred pattern and hurting opt-in rates.

    // 4. Initialize AdMob SDK
    const adapterStatuses = await mobileAds().initialize();

    // Log adapter status for debugging
    console.log('[AdMob] Initialization complete. Adapter statuses:');
    Object.keys(adapterStatuses).forEach(adapter => {
      const status = (adapterStatuses as any)[adapter];
      console.log(`[AdMob]   ${adapter}: ${status.state}`);
    });

    initialized = true;
    console.log('[AdMob] ✅ AdMob SDK initialized successfully');

    // 5. Initialize AdManager singleton for ad loading and management
    const AdManager = require('./adManager.native').default;
    await AdManager.getInstance().initialize();
    console.log('[AdMob] ✅ AdManager initialized successfully');
  } catch (error) {
    console.error('[AdMob] ❌ AdMob initialization failed:', error);
  }
}
