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
import { usePremium } from '../../contexts/PremiumContext';

const extra = Constants.expoConfig?.extra || {};

const APP_OPEN_UNIT_ID = __DEV__
  ? TestIds.APP_OPEN
  : Platform.OS === 'ios'
    ? extra.admob?.appOpenAdUnitId?.ios || ''
    : extra.admob?.appOpenAdUnitId?.android || '';

export function useAppOpenAd() {
  // Hook must be called unconditionally (Rules of Hooks)
  const { isPremium } = usePremium();

  const adRef = useRef<AppOpenAd | null>(null);
  const isLoadedRef = useRef(false);
  const backgroundTimestamp = useRef(0);

  const loadAd = useCallback(() => {
    if (!APP_OPEN_UNIT_ID || isPremium) return;

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
  }, [isPremium]);

  useEffect(() => {
    const cleanup = loadAd();

    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp.current = Date.now();
        return;
      }

      // App returning to foreground — require minimum 30s in background
      // to prevent firing right after a rewarded/interstitial ad closes
      if (nextState === 'active' && backgroundTimestamp.current > 0) {
        const bgDuration = Date.now() - backgroundTimestamp.current;
        backgroundTimestamp.current = 0;
        if (bgDuration < 30000) return; // Skip if background < 30s (ad transition)
        const canShow = await canShowFullScreenAd();
        if (canShow && isLoadedRef.current && adRef.current) {
          await adRef.current.show();
          await recordFullScreenAdShown();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      cleanup?.();
      subscription.remove();
    };
  }, [loadAd]);
}
