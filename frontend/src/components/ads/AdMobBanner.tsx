/**
 * AdMob Banner stub for Web platform.
 * Native ads are not supported on web — returns null.
 * The actual implementation is in AdMobBanner.native.tsx.
 */

import React from 'react';

export type AdMobBannerSize = 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard' | 'adaptive';

interface AdMobBannerProps {
  adUnitId?: string;
  size?: AdMobBannerSize;
  style?: any;
  requestNonPersonalizedAdsOnly?: boolean;
}

const AdMobBannerComponent: React.FC<AdMobBannerProps> = () => null;

export default AdMobBannerComponent;
