/**
 * Rewarded Ad Hook - Native (iOS/Android)
 *
 * Shows a rewarded ad with a callback on reward earned.
 * Uses react-native-google-mobile-ads RewardedAd.
 * Frequency-capped via adFrequency utility.
 *
 * FIXED ISSUES:
 * - Now properly uses test ads in development
 * - Better error handling and logging
 * - Configures test devices properly
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { canShowFullScreenAd, recordFullScreenAdShown } from './adFrequency';

const extra = Constants.expoConfig?.extra || {};

// Get ad unit IDs based on environment
const getAdUnitId = () => {
  // Always use test ads in development
  if (__DEV__) {
    console.log('[AdMob] Using TEST rewarded ad ID for development');
    return TestIds.REWARDED;
  }

  // Production IDs from app.config.js
  const productionId = Platform.OS === 'ios'
    ? extra.admob?.rewardedAdUnitId?.ios
    : extra.admob?.rewardedAdUnitId?.android;

  if (!productionId) {
    console.error('[AdMob] Production rewarded ad unit ID not configured!');
    // Fallback to test ads if production IDs missing
    return TestIds.REWARDED;
  }

  console.log('[AdMob] Using PRODUCTION rewarded ad ID:', productionId.substring(0, 20) + '...');
  return productionId;
};

export function useRewardedAd(): {
  isLoaded: boolean;
  show: (onReward?: () => void) => Promise<void>;
  load: () => void;
  reload: () => void;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<RewardedAd | null>(null);
  const rewardCallbackRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    // Clean up previous listeners if any
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }

    const adUnitId = getAdUnitId();

    if (!adUnitId) {
      console.error('[AdMob] No rewarded ad unit ID available');
      return;
    }

    console.log('[AdMob] Creating rewarded ad with ID:', adUnitId.substring(0, 20) + '...');

    try {
      const rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
        // Add test device identifiers for debugging
        keywords: __DEV__ ? ['test', 'development'] : undefined,
      });

      const loadedUnsub = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          console.log('[AdMob] ✅ Rewarded ad loaded successfully');
          setIsLoaded(true);
          retryCountRef.current = 0; // Reset retry count on successful load
        },
      );

      const earnedUnsub = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          console.log('[AdMob] 🎁 User earned reward:', reward);
          if (rewardCallbackRef.current) {
            rewardCallbackRef.current();
            rewardCallbackRef.current = null;
          }
        },
      );

      const closedUnsub = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Rewarded ad closed by user');
        setIsLoaded(false);
        // Preload next ad after a short delay
        setTimeout(() => {
          console.log('[AdMob] Preloading next rewarded ad...');
          rewarded.load();
        }, 1000);
      });

      const errorUnsub = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('[AdMob] ❌ Rewarded ad error:', error);
        console.error('[AdMob] Error details:', JSON.stringify(error, null, 2));
        setIsLoaded(false);

        // Retry loading with exponential backoff (max 3 retries)
        if (retryCountRef.current < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000);
          retryCountRef.current++;

          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            console.log(`[AdMob] Retrying rewarded ad load (attempt ${retryCountRef.current}/3)...`);
            rewarded.load();
          }, delay);
        } else {
          console.error('[AdMob] Failed to load rewarded ad after 3 attempts');
        }
      });

      // Store ad reference
      adRef.current = rewarded;

      // Start loading the ad
      console.log('[AdMob] Starting to load rewarded ad...');
      rewarded.load();

      // Store cleanup function
      listenerCleanupRef.current = () => {
        loadedUnsub();
        earnedUnsub();
        closedUnsub();
        errorUnsub();
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
      };
    } catch (error) {
      console.error('[AdMob] Failed to create rewarded ad:', error);
    }
  }, []);

  useEffect(() => {
    console.log('[AdMob] useRewardedAd hook mounted, initializing...');
    load();

    return () => {
      console.log('[AdMob] useRewardedAd hook unmounting, cleaning up...');
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
    };
  }, [load]);

  const show = useCallback(
    async (onReward?: () => void) => {
      console.log('[AdMob] Attempting to show rewarded ad, isLoaded:', isLoaded);

      const canShow = await canShowFullScreenAd();
      if (!canShow) {
        console.log('[AdMob] Cannot show ad due to frequency cap');
        return;
      }

      if (!isLoaded || !adRef.current) {
        console.warn('[AdMob] Rewarded ad not loaded yet, cannot show');
        // Try to reload
        reload();
        return;
      }

      try {
        rewardCallbackRef.current = onReward || null;
        console.log('[AdMob] Showing rewarded ad...');
        await adRef.current.show();
        await recordFullScreenAdShown();
      } catch (error) {
        console.error('[AdMob] Failed to show rewarded ad:', error);
        // Try to reload for next time
        reload();
      }
    },
    [isLoaded],
  );

  // Manual reload function for production retry
  const reload = useCallback(() => {
    console.log('[AdMob] Manual reload requested for rewarded ad');
    retryCountRef.current = 0; // Reset retry counter
    if (adRef.current) {
      setIsLoaded(false);
      adRef.current.load();
    } else {
      // Reinitialize if no ad reference
      load();
    }
  }, [load]);

  return { isLoaded, show, load, reload };
}