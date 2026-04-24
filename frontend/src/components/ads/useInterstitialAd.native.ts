/**
 * Interstitial Ad Hook - Native (iOS/Android)
 *
 * Uses react-native-google-mobile-ads InterstitialAd.
 * Auto-loads on mount, exposes show() to display at strategic moments.
 * Uses test IDs in __DEV__ mode.
 *
 * IMPORTANT: Creates ONE ad instance per mount to prevent native SDK resource
 * accumulation. Previous implementation called createForAdRequest() on every
 * load(), leaking native ad objects and eventually crashing the SDK.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { canShowFullScreenAd, recordFullScreenAdShown } from './adFrequency';

const extra = Constants.expoConfig?.extra || {};

const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.OS === 'ios'
    ? extra.admob?.interstitialAdUnitId?.ios || ''
    : extra.admob?.interstitialAdUnitId?.android || '';

/** Delay before reloading after ad close to prevent rapid native memory churn */
const RELOAD_DELAY_MS = 5000;

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const mountedRef = useRef(true);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    if (!INTERSTITIAL_UNIT_ID) return;

    // Create ONE instance per mount — reuse via load() for subsequent requests
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedUnsub = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      if (mountedRef.current) setIsLoaded(true);
    });

    const closedUnsub = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      if (mountedRef.current) setIsLoaded(false);
      // Delay reload to prevent rapid native SDK resource churn
      reloadTimerRef.current = setTimeout(() => {
        if (mountedRef.current && adRef.current) {
          adRef.current.load();
        }
      }, RELOAD_DELAY_MS);
    });

    const errorUnsub = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      if (mountedRef.current) setIsLoaded(false);
    });

    adRef.current = interstitial;
    interstitial.load();

    return () => {
      mountedRef.current = false;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      loadedUnsub();
      closedUnsub();
      errorUnsub();
      adRef.current = null;
    };
  }, []);

  const show = useCallback(async () => {
    const canShow = await canShowFullScreenAd();
    if (canShow && isLoaded && adRef.current) {
      await adRef.current.show();
      await recordFullScreenAdShown();
    }
  }, [isLoaded]);

  return { isLoaded, show };
}
