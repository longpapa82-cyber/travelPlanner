/**
 * Google AdMob Banner Component for Native (iOS/Android)
 *
 * Uses react-native-google-mobile-ads for native ad display.
 */

import React, { useState } from 'react';
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

const AdMobBannerComponent: React.FC<AdMobBannerProps> = ({
  adUnitId,
  size = 'adaptive',
  style,
  requestNonPersonalizedAdsOnly = false,
}) => {
  const { isDark } = useTheme();
  const [adError, setAdError] = useState(false);

  const unitId = __DEV__
    ? TestIds.BANNER
    : adUnitId || '';

  if (!unitId || adError) return null;

  const adSize = BannerAdSize[BANNER_SIZE_MAP[size]] || BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  return (
    <View style={[styles.container, isDark && styles.containerDark, style]}>
      <BannerAd
        unitId={unitId}
        size={adSize}
        requestOptions={{ requestNonPersonalizedAdsOnly }}
        onAdLoaded={() => setAdError(false)}
        onAdFailedToLoad={() => setAdError(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
});

export default AdMobBannerComponent;
