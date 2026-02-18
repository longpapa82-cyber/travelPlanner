/**
 * Google AdSense Component for Web
 *
 * IMPORTANT:
 * - Only works on WEB platform (not React Native)
 * - Requires Google AdSense account and approval
 * - Use TEST ads during development
 * - NEVER click your own ads (account suspension risk)
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

const ADSENSE_CLIENT_ID = Constants.expoConfig?.extra?.adsenseClientId || 'ca-pub-7330738950092177';

interface AdSenseProps {
  /**
   * Ad slot ID from Google AdSense
   * Example: '1234567890'
   */
  adSlot: string;

  /**
   * Ad format type
   */
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';

  /**
   * Ad layout (for responsive ads)
   */
  layout?: string;

  /**
   * Layout key (for responsive ads)
   */
  layoutKey?: string;

  /**
   * Enable full width responsive
   */
  fullWidthResponsive?: boolean;

  /**
   * Custom style for container
   */
  style?: any;

  /**
   * Test mode - shows placeholder instead of real ads
   */
  testMode?: boolean;
}

/**
 * AdSense Component
 *
 * Usage:
 * <AdSense
 *   adSlot="1234567890"
 *   format="auto"
 *   fullWidthResponsive
 *   testMode={__DEV__}
 * />
 */
const AdSense: React.FC<AdSenseProps> = ({
  adSlot,
  format = 'auto',
  layout,
  layoutKey,
  fullWidthResponsive = true,
  style,
  testMode = __DEV__, // Always use test mode in development
}) => {
  const adRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web') {
      return;
    }

    // Skip in test mode
    if (testMode) {
      if (__DEV__) console.debug('AdSense: Test mode enabled — showing placeholder');
      return;
    }

    // Initialize AdSense script
    const initializeAdSense = () => {
      try {
        // Check if adsbygoogle is available
        if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
          if (!isInitialized.current) {
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            isInitialized.current = true;
          }
        } else {
          if (__DEV__) console.warn('AdSense: adsbygoogle script not loaded yet');
        }
      } catch (error) {
        if (__DEV__) console.error('AdSense initialization error:', error);
      }
    };

    // Load AdSense script if not already loaded
    if (typeof window !== 'undefined' && !(window as any).adsbygoogle) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.setAttribute('data-ad-client', ADSENSE_CLIENT_ID);
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        if (__DEV__) console.debug('AdSense script loaded');
        initializeAdSense();
      };

      script.onerror = () => {
        if (__DEV__) console.error('Failed to load AdSense script');
      };

      document.head.appendChild(script);
    } else {
      initializeAdSense();
    }

    // Cleanup
    return () => {
      isInitialized.current = false;
    };
  }, [testMode]);

  // Don't render on non-web platforms
  if (Platform.OS !== 'web') {
    return null;
  }

  // Test mode placeholder
  if (testMode) {
    return (
      <View style={[styles.container, styles.testContainer, style]}>
        <View style={styles.testContent}>
          <span style={styles.testText}>📢 AdSense Test Mode</span>
          <span style={styles.testSubtext}>Ad Slot: {adSlot}</span>
          <span style={styles.testSubtext}>Format: {format}</span>
        </View>
      </View>
    );
  }

  // Real AdSense ad
  return (
    <View style={[styles.container, style]}>
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          textAlign: 'center',
        }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  testContainer: {
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    minHeight: 100,
  },
  testContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  testText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  testSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default AdSense;
