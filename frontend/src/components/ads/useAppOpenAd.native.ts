/**
 * App Open Ad Hook - Native (iOS/Android)
 *
 * Shows an ad when the app returns to the foreground after >=30s.
 * Uses react-native-google-mobile-ads AppOpenAd.
 * Frequency-capped via adFrequency utility.
 *
 * IMPORTANT: Creates ONE ad instance per mount to prevent native SDK resource
 * accumulation. Reload after CLOSED is delayed to avoid rapid memory churn.
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

/** Delay before reloading after ad close to prevent rapid native SDK resource churn */
const RELOAD_DELAY_MS = 10000;

export function useAppOpenAd() {
  // Hook must be called unconditionally (Rules of Hooks)
  const { isPremium } = usePremium();

  const adRef = useRef<AppOpenAd | null>(null);
  const isLoadedRef = useRef(false);
  const backgroundTimestamp = useRef(0);
  const mountedRef = useRef(true);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to access latest isPremium in async handlers without stale closure
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const loadAd = useCallback(() => {
    if (!APP_OPEN_UNIT_ID || isPremium) {
      // Clear any existing ad instance when user becomes premium
      if (adRef.current) {
        isLoadedRef.current = false;
        adRef.current = null;
      }
      return;
    }

    // Create ONE instance per mount — reuse via load() for subsequent requests
    const appOpen = AppOpenAd.createForAdRequest(APP_OPEN_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedUnsub = appOpen.addAdEventListener(AdEventType.LOADED, () => {
      if (mountedRef.current) isLoadedRef.current = true;
    });

    const closedUnsub = appOpen.addAdEventListener(AdEventType.CLOSED, () => {
      if (mountedRef.current) isLoadedRef.current = false;
      // Delay reload to prevent rapid SDK resource churn
      reloadTimerRef.current = setTimeout(() => {
        if (mountedRef.current && adRef.current) {
          adRef.current.load();
        }
      }, RELOAD_DELAY_MS);
    });

    const errorUnsub = appOpen.addAdEventListener(AdEventType.ERROR, () => {
      if (mountedRef.current) isLoadedRef.current = false;
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
    mountedRef.current = true;
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
        if (canShow && isLoadedRef.current && adRef.current && !isPremiumRef.current) {
          await adRef.current.show();
          await recordFullScreenAdShown();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      mountedRef.current = false;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      cleanup?.();
      subscription.remove();
      adRef.current = null;
    };
  }, [loadAd]);
}
