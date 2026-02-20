/**
 * App Open Ad Hook - Native (iOS/Android)
 *
 * Shows an ad when the app returns to the foreground after >=3 minutes.
 * Uses react-native-google-mobile-ads AppOpenAd.
 * Frequency-capped via adFrequency utility.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  AppOpenAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { canShowFullScreenAd, recordFullScreenAdShown } from './adFrequency';

const extra = Constants.expoConfig?.extra || {};

const APP_OPEN_UNIT_ID = __DEV__
  ? TestIds.APP_OPEN
  : Platform.OS === 'ios'
    ? extra.admob?.appOpenAdUnitId?.ios || ''
    : extra.admob?.appOpenAdUnitId?.android || '';

export function useAppOpenAd() {
  const adRef = useRef<AppOpenAd | null>(null);
  const isLoadedRef = useRef(false);
  const backgroundTimestamp = useRef(0);

  const loadAd = useCallback(() => {
    if (!APP_OPEN_UNIT_ID) return;

    const appOpen = AppOpenAd.createForAdRequest(APP_OPEN_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedUnsub = appOpen.addAdEventListener(AdEventType.LOADED, () => {
      isLoadedRef.current = true;
    });

    const closedUnsub = appOpen.addAdEventListener(AdEventType.CLOSED, () => {
      isLoadedRef.current = false;
      appOpen.load();
    });

    const errorUnsub = appOpen.addAdEventListener(AdEventType.ERROR, () => {
      isLoadedRef.current = false;
    });

    adRef.current = appOpen;
    appOpen.load();

    return () => {
      loadedUnsub();
      closedUnsub();
      errorUnsub();
    };
  }, []);

  useEffect(() => {
    const cleanup = loadAd();

    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp.current = Date.now();
        return;
      }

      // App returning to foreground
      if (nextState === 'active' && backgroundTimestamp.current > 0) {
        const canShow = await canShowFullScreenAd();
        if (canShow && isLoadedRef.current && adRef.current) {
          await adRef.current.show();
          await recordFullScreenAdShown();
        }
        backgroundTimestamp.current = 0;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      cleanup?.();
      subscription.remove();
    };
  }, [loadAd]);
}
