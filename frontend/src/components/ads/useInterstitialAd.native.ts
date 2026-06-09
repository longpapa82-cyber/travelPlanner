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
import { canShowAd, recordAdShown } from './adFrequency';

import { useGDPRConsent } from '../../hooks/useGDPRConsent';

const extra = Constants.expoConfig?.extra || {};

const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.OS === 'ios'
    ? extra.admob?.interstitialAdUnitId?.ios || ''
    : extra.admob?.interstitialAdUnitId?.android || '';

/** Delay before reloading after ad close to prevent rapid native memory churn */
const RELOAD_DELAY_MS = 5000;
/**
 * When show() is called but the ad hasn't finished loading yet, wait up to this
 * long for the in-flight load() to complete instead of silently giving up.
 * Trades a tiny delay for a much higher show rate on fast taps.
 */
const SHOW_WAIT_TIMEOUT_MS = 2500;
const SHOW_WAIT_POLL_MS = 100;

export function useInterstitialAd() {
  const [isLoaded, setIsLoaded] = useState(false);
  const { canShowPersonalizedAds, isReady } = useGDPRConsent();
  const adRef = useRef<InterstitialAd | null>(null);
  const mountedRef = useRef(true);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror isLoaded in a ref so show()'s loop reads the latest value without
  // being re-created on every load (avoids stale-closure misses).
  const isLoadedRef = useRef(false);
  const setLoaded = (v: boolean) => {
    isLoadedRef.current = v;
    if (mountedRef.current) setIsLoaded(v);
  };

  useEffect(() => {
    if (!isReady) return;
    mountedRef.current = true;
    if (!INTERSTITIAL_UNIT_ID) return;

    console.log('[AdMob] 📋 Creating InterstitialAd request. requestNonPersonalizedAdsOnly:', !canShowPersonalizedAds);
    // Create ONE instance per mount — reuse via load() for subsequent requests
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
      requestNonPersonalizedAdsOnly: !canShowPersonalizedAds,
    });

    const loadedUnsub = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setLoaded(true);
    });

    const closedUnsub = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      // Delay reload to prevent rapid native SDK resource churn
      reloadTimerRef.current = setTimeout(() => {
        if (mountedRef.current && adRef.current) {
          adRef.current.load();
        }
      }, RELOAD_DELAY_MS);
    });

    const errorUnsub = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setLoaded(false);
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
  }, [isReady, canShowPersonalizedAds]);

  /** Resolve once the ad is loaded, or after the timeout — whichever comes first. */
  const waitForLoad = useCallback(async (): Promise<boolean> => {
    if (isLoadedRef.current) return true;
    if (!adRef.current) return false;
    // Kick a load in case none is in flight (cheap no-op if already loading).
    try { adRef.current.load(); } catch { /* ignore */ }

    const deadline = Date.now() + SHOW_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (!mountedRef.current) return false;
      if (isLoadedRef.current) return true;
      await new Promise((r) => setTimeout(r, SHOW_WAIT_POLL_MS));
    }
    return isLoadedRef.current;
  }, []);

  const show = useCallback(async () => {
    // Check frequency cap FIRST — don't bother waiting for a load we can't show.
    const canShow = await canShowAd('interstitial');
    if (!canShow) return;

    const ready = await waitForLoad();
    if (ready && adRef.current) {
      await adRef.current.show();
      await recordAdShown('interstitial');
    }
  }, [waitForLoad]);

  return { isLoaded, show };
}
