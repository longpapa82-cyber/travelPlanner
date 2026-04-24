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

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
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
const MAX_FAIL_COUNT = 2;

const AdMobBannerComponent: React.FC<AdMobBannerProps> = ({
  adUnitId,
  size = 'adaptive',
  style,
  requestNonPersonalizedAdsOnly = false,
}) => {
  const { isDark } = useTheme();
  const [adError, setAdError] = useState(false);
  const mountedRef = useRef(true);
  const failCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';
  const unitId = useTestAds
    ? TestIds.BANNER
    : adUnitId || '';

  // No ad unit configured — render nothing (this is before any ad request)
  if (!unitId) return null;

  const adSize = BannerAdSize[BANNER_SIZE_MAP[size]] || BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  const minHeight = BANNER_MIN_HEIGHT[size] || 60;

  // Always render the container to maintain stable frame dimensions (AdMob policy).
  // On error or after exceeding retry limit, keep the container but hide the ad content.
  return (
    <View style={[styles.container, isDark && styles.containerDark, { minHeight }, style]}>
      {!adError && failCountRef.current < MAX_FAIL_COUNT && (
        <BannerAd
          unitId={unitId}
          size={adSize}
          requestOptions={{ requestNonPersonalizedAdsOnly }}
          onAdLoaded={() => {
            if (mountedRef.current) {
              setAdError(false);
              failCountRef.current = 0;
            }
          }}
          onAdFailedToLoad={() => {
            if (mountedRef.current) {
              failCountRef.current += 1;
              setAdError(true);
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
});

export default AdMobBannerComponent;
