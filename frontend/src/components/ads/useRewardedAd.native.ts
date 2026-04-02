/**
 * Rewarded Ad Hook - Native (iOS/Android)
 *
 * Shows a rewarded ad with a callback on reward earned.
 * Uses react-native-google-mobile-ads RewardedAd.
 * Frequency-capped via adFrequency utility.
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

const REWARDED_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.OS === 'ios'
    ? extra.admob?.rewardedAdUnitId?.ios || ''
    : extra.admob?.rewardedAdUnitId?.android || '';

// Log configuration issues in production
if (!REWARDED_UNIT_ID && !__DEV__) {
  console.error('[AdMob] Rewarded ad unit ID not configured. Check app.config.js admob settings.');
}

export function useRewardedAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<RewardedAd | null>(null);
  const rewardCallbackRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (!REWARDED_UNIT_ID) {
      console.warn('[AdMob] No rewarded ad unit ID configured');
      return;
    }

    const rewarded = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedUnsub = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setIsLoaded(true);
        retryCountRef.current = 0; // Reset retry count on successful load
      },
    );

    const earnedUnsub = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewardCallbackRef.current?.();
        rewardCallbackRef.current = null;
      },
    );

    const closedUnsub = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      rewarded.load();
    });

    const errorUnsub = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('[AdMob] Rewarded ad error:', error);
      setIsLoaded(false);

      // Retry loading with exponential backoff (max 3 retries)
      if (retryCountRef.current < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000);
        retryCountRef.current++;

        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`[AdMob] Retrying rewarded ad load (attempt ${retryCountRef.current})`);
          rewarded.load();
        }, delay);
      }
    });

    adRef.current = rewarded;
    rewarded.load();

    return () => {
      loadedUnsub();
      earnedUnsub();
      closedUnsub();
      errorUnsub();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const show = useCallback(
    async (onReward?: () => void) => {
      const canShow = await canShowFullScreenAd();
      if (canShow && isLoaded && adRef.current) {
        rewardCallbackRef.current = onReward || null;
        await adRef.current.show();
        await recordFullScreenAdShown();
      }
    },
    [isLoaded],
  );

  // Manual reload function for production retry
  const reload = useCallback(() => {
    retryCountRef.current = 0; // Reset retry counter
    if (adRef.current) {
      adRef.current.load();
    }
  }, []);

  return { isLoaded, show, load, reload };
}
