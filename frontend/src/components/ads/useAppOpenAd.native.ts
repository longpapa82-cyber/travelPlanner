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
import { canShowAd, recordAdShown } from './adFrequency';
import { usePremium } from '../../contexts/PremiumContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGDPRConsent } from '../../hooks/useGDPRConsent';

const extra = Constants.expoConfig?.extra || {};

const APP_OPEN_UNIT_ID = __DEV__
  ? TestIds.APP_OPEN
  : Platform.OS === 'ios'
    ? extra.admob?.appOpenAdUnitId?.ios || ''
    : extra.admob?.appOpenAdUnitId?.android || '';

/** Delay before reloading after ad close to prevent rapid native SDK resource churn */
const RELOAD_DELAY_MS = 10000;
/**
 * Minimum time the app must spend in the background before a foreground return
 * is treated as a fresh "app open" (rather than a quick ad/transition bounce).
 * Lowered from 30s → 15s to surface app-open ads more often. The 60s global
 * cooldown in adFrequency still prevents stacking with a just-closed ad.
 */
const MIN_BACKGROUND_MS = 15000;
/**
 * On foreground return, if the ad hasn't finished loading yet, poll briefly for
 * it instead of silently skipping (mirrors the interstitial's waitForLoad).
 * Trades a tiny delay for a higher show rate when the return beats the load.
 */
const SHOW_WAIT_TIMEOUT_MS = 2000;
const SHOW_WAIT_POLL_MS = 100;

export function useAppOpenAd() {
  // Hook must be called unconditionally (Rules of Hooks)
  const { isPremium } = usePremium();
  // V186 (Invariant 36 강화): logout 진행 중 광고 표시 차단. logout 직후
  // 이전 사용자에게 적용되던 ad-free 상태가 잠깐 비활성화되며 광고가
  // 깜빡이는 race window 차단.
  const { isLoggingOut } = useAuth();
  const { canShowPersonalizedAds, isReady } = useGDPRConsent();
  const isLoggingOutRef = useRef(isLoggingOut);
  isLoggingOutRef.current = isLoggingOut;

  const adRef = useRef<AppOpenAd | null>(null);
  const isLoadedRef = useRef(false);
  const backgroundTimestamp = useRef(0);
  const mountedRef = useRef(true);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to access latest isPremium in async handlers without stale closure
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const loadAd = useCallback(() => {
    if (!isReady) return;

    if (!APP_OPEN_UNIT_ID || isPremium) {
      // Clear any existing ad instance when user becomes premium
      if (adRef.current) {
        isLoadedRef.current = false;
        adRef.current = null;
      }
      return;
    }

    console.log('[AdMob] 📋 Creating AppOpenAd request. requestNonPersonalizedAdsOnly:', !canShowPersonalizedAds);
    // Create ONE instance per mount — reuse via load() for subsequent requests
    const appOpen = AppOpenAd.createForAdRequest(APP_OPEN_UNIT_ID, {
      requestNonPersonalizedAdsOnly: !canShowPersonalizedAds,
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
  }, [isPremium, isReady, canShowPersonalizedAds]);

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
        if (bgDuration < MIN_BACKGROUND_MS) return; // Skip quick bounce (ad transition)
        // V186 (Invariant 36 강화): logout 진행 중 ad show 차단
        if (isLoggingOutRef.current) return;
        const canShow = await canShowAd('appOpen');
        if (!canShow || isPremiumRef.current || isLoggingOutRef.current || !adRef.current) return;

        // Wait briefly for an in-flight load instead of skipping on a cold return.
        if (!isLoadedRef.current) {
          const deadline = Date.now() + SHOW_WAIT_TIMEOUT_MS;
          while (Date.now() < deadline && !isLoadedRef.current) {
            if (!mountedRef.current) return;
            await new Promise((r) => setTimeout(r, SHOW_WAIT_POLL_MS));
          }
        }

        // Re-check guards after the wait (premium/logout state may have changed).
        if (
          isLoadedRef.current &&
          adRef.current &&
          !isPremiumRef.current &&
          !isLoggingOutRef.current
        ) {
          await adRef.current.show();
          await recordAdShown('appOpen');
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
