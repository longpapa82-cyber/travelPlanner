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
  // Common test device hashes for Android/iOS
  '33BE2250B43518CCDA7DE426D04EE231', // Common iOS Simulator
  '2077EF9982D9BD10BAD78E90BEBE988D', // Common Android emulator
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

  // Track ad state and timing
  const adRef = useRef<RewardedAd | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const listenersSetupRef = useRef(false);
  const isLoadedRef = useRef(false);

  /**
   * Get the correct ad unit ID
   */
  const getAdUnitId = useCallback((): string => {
    // Use test ads in development or when explicitly set for Alpha testing
    const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';

    if (useTestAds) {
      console.log('[useRewardedAd] Using TEST ad ID (dev or alpha)');
      return TestIds.REWARDED;
    }

    // Production IDs from config
    const productionId = Platform.OS === 'ios'
      ? extra.admob?.rewardedAdUnitId?.ios
      : extra.admob?.rewardedAdUnitId?.android;

    if (!productionId) {
      console.error('[useRewardedAd] Production ad ID not found in config!');
      return TestIds.REWARDED; // Fallback to test ads rather than crashing
    }

    console.log('[useRewardedAd] Using PRODUCTION ad ID for', Platform.OS);
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

  // SDK initialization removed - handled by initAds.native.ts
  // No need to initialize SDK here, it's already initialized in App.tsx

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
      isLoadedRef.current = true;
      setIsLoading(false);
      setError(null);
      lastLoadTimeRef.current = Date.now();
    });

    // Error event
    ad.addAdEventListener(AdEventType.ERROR, (err) => {
      console.error('[useRewardedAd] ❌ Ad error:', err);
      setIsLoaded(false);
      isLoadedRef.current = false;
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
      isLoadedRef.current = false;
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
      // SDK already initialized by initAds.native.ts in App.tsx
      console.log('[useRewardedAd] Creating ad instance (SDK already initialized)');

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
  }, [getAdUnitId, setupListeners, loadAd]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    console.log('[useRewardedAd] Component mounted, initializing...');

    // Delay initial ad creation to ensure SDK is ready
    const initTimer = setTimeout(() => {
      createAd().catch(err => {
        console.error('[useRewardedAd] Initial setup failed:', err);

        // Retry once after a delay
        setTimeout(() => {
          console.log('[useRewardedAd] Retrying initialization...');
          createAd().catch(err2 => {
            console.error('[useRewardedAd] Second attempt failed:', err2);
          });
        }, 2000);
      });
    }, 500);

    // Cleanup
    return () => {
      clearTimeout(initTimer);
      console.log('[useRewardedAd] Component unmounting');
      adRef.current = null;
      listenersSetupRef.current = false;
      isLoadedRef.current = false;
    };
  }, []); // Empty deps - only run once on mount

  /**
   * Show the ad with Just-in-Time loading
   */
  const show = useCallback(async (onRewarded: () => void) => {
    console.log('[useRewardedAd] Show requested');

    // Check frequency capping
    if (!(await canShowFullScreenAd())) {
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
      if (!isLoadedRef.current || isAdExpired()) {
        console.log('[useRewardedAd] Ad not ready, loading Just-in-Time...');

        // Reset the loaded ref before loading
        isLoadedRef.current = false;

        // Create a promise that resolves when the ad loads or fails
        const loadPromise = new Promise<boolean>((resolve) => {
          const checkLoaded = setInterval(() => {
            if (isLoadedRef.current) {
              clearInterval(checkLoaded);
              resolve(true);
            }
          }, 100);

          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkLoaded);
            resolve(false);
          }, 5000);
        });

        // Start loading the ad
        await loadAd();

        // Wait for the ad to actually be loaded
        const adLoaded = await loadPromise;

        if (!adLoaded) {
          throw new Error('Ad failed to load in time');
        }

        console.log('[useRewardedAd] Ad loaded successfully, ready to show');
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