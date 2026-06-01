/**
 * Google AdMob Banner Component for Native (iOS/Android)
 *
 * Uses react-native-google-mobile-ads for native ad display.
 *
 * IMPORTANT: AdMob policy requires that ad containers maintain stable dimensions.
 * Never return null or change container size after an ad has been requested.
 * On error, keep the container with the same height but hide the ad content.
 *
 * Retry limit prevents infinite ad request loops when SDK is in a bad state.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useTheme } from '../../contexts/ThemeContext';

export type AdMobBannerSize = 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard' | 'adaptive';

interface AdMobBannerProps {
  adUnitId?: string;
  size?: AdMobBannerSize;
  style?: any;
  requestNonPersonalizedAdsOnly?: boolean;
}

const BANNER_SIZE_MAP: Record<AdMobBannerSize, keyof typeof BannerAdSize> = {
  banner: 'BANNER',
  largeBanner: 'LARGE_BANNER',
  mediumRectangle: 'MEDIUM_RECTANGLE',
  fullBanner: 'FULL_BANNER',
  leaderboard: 'LEADERBOARD',
  adaptive: 'ANCHORED_ADAPTIVE_BANNER',
};

// Minimum heights for each banner size to maintain stable frame dimensions
const BANNER_MIN_HEIGHT: Record<AdMobBannerSize, number> = {
  banner: 50,
  largeBanner: 100,
  mediumRectangle: 250,
  fullBanner: 60,
  leaderboard: 90,
  adaptive: 60,
};

/** Max consecutive failures before giving up ad requests for this mount */
const MAX_FAIL_COUNT = 3;

const AdMobBannerComponent: React.FC<AdMobBannerProps> = ({
  adUnitId,
  size = 'adaptive',
  style,
  requestNonPersonalizedAdsOnly = Platform.OS === 'ios',
}) => {
  const { isDark } = useTheme();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const mountedRef = useRef(true);
  const failCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleAdLoaded = useCallback(() => {
    if (mountedRef.current) {
      setAdLoaded(true);
      setAdFailed(false);
      failCountRef.current = 0;
    }
  }, []);

  const handleAdFailed = useCallback(() => {
    if (mountedRef.current) {
      failCountRef.current += 1;
      setAdFailed(true);
    }
  }, []);

  const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';
  const unitId = useTestAds
    ? TestIds.BANNER
    : adUnitId || '';

  if (!unitId) return null;
  if (adFailed || failCountRef.current >= MAX_FAIL_COUNT) return null;

  const adSize = BannerAdSize[BANNER_SIZE_MAP[size]] || BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  const minHeight = BANNER_MIN_HEIGHT[size] || 60;

  // BannerAd is a native view — overflow:hidden on a JS wrapper doesn't reliably
  // clip it on iOS. The only guaranteed way to show zero space before load is to
  // render the wrapper with height:0 + overflow:hidden AND position the BannerAd
  // absolutely so its native frame stays within the clipped region.
  return (
    <View
      style={[
        styles.wrapper,
        adLoaded
          ? [styles.container, isDark && styles.containerDark, { minHeight }]
          : styles.hidden,
        style,
      ]}
    >
      <BannerAd
        unitId={unitId}
        size={adSize}
        requestOptions={{ requestNonPersonalizedAdsOnly }}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleAdFailed}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  hidden: {
    height: 0,
    marginVertical: 0,
    overflow: 'hidden',
  },
});

export default AdMobBannerComponent;
