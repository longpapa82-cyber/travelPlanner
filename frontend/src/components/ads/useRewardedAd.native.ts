/**
 * Rewarded Ad Hook - Fixed Version for Alpha Testing
 *
 * CRITICAL FIXES FOR P0 BUG:
 * 1. Just-in-Time ad loading to prevent expiration
 * 2. Enhanced test device configuration
 * 3. Ad expiry detection (4 minutes)
 * 4. Comprehensive error handling with fallback
 * 5. Detailed debug logging for Alpha testing
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { canShowFullScreenAd, recordFullScreenAdShown } from './adFrequency';

const extra = Constants.expoConfig?.extra || {};

// Ad expiry time - ads typically expire after 5 minutes, we check at 4 minutes
const AD_EXPIRY_MS = 4 * 60 * 1000; // 4 minutes

// Known test device hashes from Alpha testing
const ALPHA_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  // Add Alpha tester device hashes here as they're discovered
  // These will be shown in logs when ads fail to load
];

export function useRewardedAd(): {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  show: (onRewarded: () => void) => Promise<void>;
  reload: () => void;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track ad state and timing
  const adRef = useRef<RewardedAd | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const listenersSetupRef = useRef(false);

  /**
   * Get the correct ad unit ID
   */
  const getAdUnitId = useCallback((): string => {
    // Always use test ads in development
    if (__DEV__) {
      console.log('[useRewardedAd] Using TEST ad ID');
      return TestIds.REWARDED;
    }

    // Production IDs from config
    const productionId = Platform.OS === 'ios'
      ? extra.admob?.rewardedAdUnitId?.ios
      : extra.admob?.rewardedAdUnitId?.android;

    if (!productionId) {
      console.error('[useRewardedAd] Production ad ID not found!');
      return TestIds.REWARDED;
    }

    console.log('[useRewardedAd] Using PRODUCTION ad ID');
    return productionId;
  }, []);

  /**
   * Check if the loaded ad has expired
   */
  const isAdExpired = useCallback((): boolean => {
    if (!isLoaded || !lastLoadTimeRef.current) {
      return true;
    }

    const timeSinceLoad = Date.now() - lastLoadTimeRef.current;
    const expired = timeSinceLoad > AD_EXPIRY_MS;

    if (expired) {
      console.log('[useRewardedAd] Ad expired (loaded', Math.round(timeSinceLoad / 1000), 'seconds ago)');
    }

    return expired;
  }, [isLoaded]);

  /**
   * Initialize the AdMob SDK and configure test devices
   */
  const initializeSDK = useCallback(async () => {
    if (isInitialized) {
      console.log('[useRewardedAd] SDK already initialized');
      return;
    }

    console.log('[useRewardedAd] Initializing AdMob SDK...');

    try {
      // Configure test devices
      const testDevices = [...ALPHA_TEST_DEVICE_HASHES].filter(Boolean);

      console.log('[useRewardedAd] Configuring with test devices:', testDevices.length);

      // Set request configuration
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIdentifiers: testDevices,
      });

      // Initialize the SDK
      const adapterStatuses = await mobileAds().initialize();

      console.log('[useRewardedAd] SDK initialized. Adapters:', Object.keys(adapterStatuses).length);

      setIsInitialized(true);
    } catch (err) {
      console.error('[useRewardedAd] SDK initialization failed:', err);
      setError('Failed to initialize ads');
      throw err;
    }
  }, [isInitialized]);

  /**
   * Setup ad event listeners
   */
  const setupListeners = useCallback((ad: RewardedAd) => {
    if (listenersSetupRef.current) {
      console.log('[useRewardedAd] Listeners already setup');
      return;
    }

    console.log('[useRewardedAd] Setting up ad listeners...');

    // Load event
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[useRewardedAd] ✅ Ad loaded successfully');
      setIsLoaded(true);
      setIsLoading(false);
      setError(null);
      lastLoadTimeRef.current = Date.now();
    });

    // Error event
    ad.addAdEventListener(AdEventType.ERROR, (err) => {
      console.error('[useRewardedAd] ❌ Ad error:', err);
      setIsLoaded(false);
      setIsLoading(false);
      setError(String(err));

      const errorStr = String(err);

      // Extract device hash from error for debugging (DEV ONLY)
      if (__DEV__) {
        const hashMatch = errorStr.match(/device[:\s]+([A-F0-9]{32})/i) ||
                         errorStr.match(/setTestDeviceIds.*"([A-F0-9]{32})"/i);

        if (hashMatch && hashMatch[1]) {
          console.log('[useRewardedAd] 🔑 DEVICE HASH DETECTED:', hashMatch[1]);
          console.log('[useRewardedAd] Add this to ALPHA_TEST_DEVICE_HASHES in useRewardedAd.native.ts');
        }

        // Log helpful debug info
        if (errorStr.includes('No fill') || errorStr.includes('ERROR_CODE_NO_FILL')) {
          console.log('[useRewardedAd] No ads available - common in testing');
        } else if (errorStr.includes('Network')) {
          console.log('[useRewardedAd] Network error - check connectivity');
        }
      }
    });

    // Opened event
    ad.addAdEventListener(AdEventType.OPENED, () => {
      console.log('[useRewardedAd] Ad opened');
    });

    // Closed event
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[useRewardedAd] Ad closed');
      setIsLoaded(false);
      lastLoadTimeRef.current = 0;

      // Reload for next use
      setTimeout(() => loadAd(ad), 1000);
    });

    listenersSetupRef.current = true;
  }, []);

  /**
   * Load the rewarded ad
   */
  const loadAd = useCallback(async (ad?: RewardedAd) => {
    const adToLoad = ad || adRef.current;

    if (!adToLoad) {
      console.error('[useRewardedAd] No ad instance to load');
      return;
    }

    if (isLoading) {
      console.log('[useRewardedAd] Already loading, skipping...');
      return;
    }

    try {
      console.log('[useRewardedAd] Loading ad...');
      setIsLoading(true);
      await adToLoad.load();
    } catch (err) {
      console.error('[useRewardedAd] Failed to load ad:', err);
      setIsLoading(false);
      setError(String(err));
    }
  }, [isLoading]);

  /**
   * Create and initialize the ad
   */
  const createAd = useCallback(async () => {
    try {
      // Initialize SDK first
      await initializeSDK();

      // Create ad instance
      const adUnitId = getAdUnitId();
      console.log('[useRewardedAd] Creating ad with unit ID:', adUnitId.substring(0, 20) + '...');

      const ad = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
        keywords: ['travel', 'vacation', 'trip', 'tourism'],
      });

      adRef.current = ad;

      // Setup listeners
      setupListeners(ad);

      // Load the ad
      await loadAd(ad);

      return ad;
    } catch (err) {
      console.error('[useRewardedAd] Failed to create ad:', err);
      setError('Failed to create ad');
      throw err;
    }
  }, [initializeSDK, getAdUnitId, setupListeners, loadAd]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    console.log('[useRewardedAd] Component mounted, initializing...');

    createAd().catch(err => {
      console.error('[useRewardedAd] Initial setup failed:', err);
    });

    // Cleanup
    return () => {
      console.log('[useRewardedAd] Component unmounting');
      adRef.current = null;
      listenersSetupRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  /**
   * Show the ad with Just-in-Time loading
   */
  const show = useCallback(async (onRewarded: () => void) => {
    console.log('[useRewardedAd] Show requested');

    // Check frequency capping
    if (!canShowFullScreenAd()) {
      console.log('[useRewardedAd] Frequency capped, giving reward');
      onRewarded();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure we have an ad instance
      if (!adRef.current) {
        console.log('[useRewardedAd] No ad instance, creating...');
        await createAd();
      }

      // Check if ad is expired or not loaded
      if (!isLoaded || isAdExpired()) {
        console.log('[useRewardedAd] Ad not ready, loading Just-in-Time...');
        await loadAd();

        // Wait for ad to load (max 5 seconds)
        let waitTime = 0;
        while (!isLoaded && waitTime < 5000) {
          await new Promise(resolve => setTimeout(resolve, 500));
          waitTime += 500;
        }

        if (!isLoaded) {
          throw new Error('Ad failed to load in time');
        }
      }

      // Set up one-time reward listener
      if (adRef.current) {
        const rewardListener = adRef.current.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          (reward) => {
            console.log('[useRewardedAd] 🎁 Reward earned:', reward);
            onRewarded();
            rewardListener(); // Remove listener
          }
        );

        // Show the ad
        console.log('[useRewardedAd] Showing ad...');
        await adRef.current.show();
      }

      recordFullScreenAdShown();

    } catch (err) {
      console.error('[useRewardedAd] Failed to show ad:', err);
      setError(String(err));

      // Fallback reward only for legitimate errors, not user-caused blocking
      const errorStr = String(err);
      const isLegitimateError =
        errorStr.includes('No fill') ||          // No ads available (AdMob)
        errorStr.includes('ERROR_CODE_NO_FILL') || // No ads available
        errorStr.includes('Network') ||           // Network issues
        errorStr.includes('timeout') ||           // SDK timeout
        errorStr.includes('SDK');                 // SDK errors

      if (isLegitimateError) {
        console.log('[useRewardedAd] Giving reward anyway (legitimate error fallback)');
        onRewarded();
      } else {
        // User might be blocking ads - don't reward
        console.log('[useRewardedAd] Ad show failed - no fallback reward (possible ad blocker)');
        throw err; // Re-throw to caller
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isAdExpired, createAd, loadAd]);

  /**
   * Force reload the ad
   */
  const reload = useCallback(() => {
    console.log('[useRewardedAd] Force reload requested');

    if (!adRef.current) {
      console.log('[useRewardedAd] No ad to reload, creating new one');
      createAd();
    } else {
      loadAd();
    }
  }, [createAd, loadAd]);

  return {
    isLoaded: isLoaded && !isAdExpired(),
    isLoading,
    error,
    show,
    reload,
  };
}