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

export function useRewardedAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<RewardedAd | null>(null);
  const rewardCallbackRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    if (!REWARDED_UNIT_ID) return;

    const rewarded = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedUnsub = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setIsLoaded(true);
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

    const errorUnsub = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
    });

    adRef.current = rewarded;
    rewarded.load();

    return () => {
      loadedUnsub();
      earnedUnsub();
      closedUnsub();
      errorUnsub();
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

  return { isLoaded, show, load };
}
