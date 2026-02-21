/**
 * Unified Ad Banner Component
 *
 * Automatically selects the right ad provider:
 * - Native (iOS/Android): Google AdMob via react-native-google-mobile-ads
 * - Web: Google AdSense via DOM injection
 *
 * Reads default ad unit IDs from app.config.js extra when not explicitly provided.
 */

import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { usePremium } from '../../contexts/PremiumContext';
import AdSense from './AdSense';
import AdMobBanner from './AdMobBanner';
import type { AdMobBannerSize } from './AdMobBanner';

const extra = Constants.expoConfig?.extra || {};

const DEFAULT_ADSENSE_SLOT = extra.adsenseDefaultSlot || '';
const DEFAULT_ADMOB_UNIT_ID =
  Platform.OS === 'ios'
    ? extra.admob?.bannerAdUnitId?.ios || ''
    : extra.admob?.bannerAdUnitId?.android || '';

interface AdBannerProps {
  /** AdMob ad unit ID (for native) */
  adMobUnitId?: string;
  /** AdSense ad slot (for web) */
  adSenseSlot?: string;
  /** Banner size for native (default: adaptive) */
  size?: AdMobBannerSize;
  /** AdSense format for web (default: auto) */
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';
  /** Custom style */
  style?: any;
}

const AdBanner: React.FC<AdBannerProps> = ({
  adMobUnitId,
  adSenseSlot,
  size = 'adaptive',
  format = 'auto',
  style,
}) => {
  // Premium users don't see banner ads
  try {
    const { isPremium } = usePremium();
    if (isPremium) return null;
  } catch {
    // PremiumContext may not be available (e.g. outside provider)
  }

  if (Platform.OS === 'web') {
    const slot = adSenseSlot || DEFAULT_ADSENSE_SLOT;
    if (!slot) return null;
    return (
      <AdSense
        adSlot={slot}
        format={format}
        fullWidthResponsive
        style={style}
        testMode={__DEV__}
      />
    );
  }

  const unitId = adMobUnitId || DEFAULT_ADMOB_UNIT_ID;
  return (
    <AdMobBanner
      adUnitId={unitId}
      size={size}
      style={style}
    />
  );
};

export default AdBanner;
