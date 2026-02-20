/**
 * Interstitial Ad Hook - Native (iOS/Android)
 *
 * Uses react-native-google-mobile-ads InterstitialAd.
 * Auto-loads on mount, exposes show() to display at strategic moments.
 * Uses test IDs in __DEV__ mode.
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

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);

  const load = useCallback(() => {
    if (!INTERSTITIAL_UNIT_ID) return;

    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedUnsub = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setIsLoaded(true);
    });

    const closedUnsub = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      // Pre-load next ad
      interstitial.load();
    });

    const errorUnsub = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
    });

    adRef.current = interstitial;
    interstitial.load();

    return () => {
      loadedUnsub();
      closedUnsub();
      errorUnsub();
    };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const show = useCallback(async () => {
    const canShow = await canShowFullScreenAd();
    if (canShow && isLoaded && adRef.current) {
      await adRef.current.show();
      await recordFullScreenAdShown();
    }
  }, [isLoaded]);

  return { isLoaded, show, load };
}
