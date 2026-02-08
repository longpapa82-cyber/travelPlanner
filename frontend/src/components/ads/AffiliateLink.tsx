/**
 * Affiliate Link Component
 *
 * Handles travel affiliate links (Booking.com, Expedia, etc.)
 * with click tracking and analytics
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Linking, Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const affiliateIds = Constants.expoConfig?.extra?.affiliateIds || {};

export type AffiliateProvider = 'booking' | 'expedia' | 'hotels' | 'airbnb' | 'viator' | 'klook';

interface AffiliateLinkProps {
  /**
   * Affiliate provider
   */
  provider: AffiliateProvider;

  /**
   * Destination name (for search pre-fill)
   */
  destination?: string;

  /**
   * Check-in date (ISO format)
   */
  checkIn?: string;

  /**
   * Check-out date (ISO format)
   */
  checkOut?: string;

  /**
   * Number of travelers
   */
  travelers?: number;

  /**
   * Custom label (overrides default)
   */
  label?: string;

  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'outline';

  /**
   * Button size
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Show provider logo
   */
  showLogo?: boolean;

  /**
   * Custom tracking ID for analytics
   */
  trackingId?: string;

  /**
   * Trip ID (for tracking)
   */
  tripId?: string;

  /**
   * Custom style
   */
  style?: any;
}

const AFFILIATE_CONFIG: Record<AffiliateProvider, {
  name: string;
  baseUrl: string;
  icon: string;
  color: string;
  affiliateId: string;
}> = {
  booking: {
    name: 'Booking.com',
    baseUrl: 'https://www.booking.com/searchresults.html',
    icon: 'bed',
    color: '#003580',
    affiliateId: affiliateIds.booking || '',
  },
  expedia: {
    name: 'Expedia',
    baseUrl: 'https://www.expedia.com/Hotel-Search',
    icon: 'airplane',
    color: '#FFCB03',
    affiliateId: affiliateIds.expedia || '',
  },
  hotels: {
    name: 'Hotels.com',
    baseUrl: 'https://www.hotels.com/search.do',
    icon: 'home',
    color: '#D32F2F',
    affiliateId: affiliateIds.hotels || '',
  },
  airbnb: {
    name: 'Airbnb',
    baseUrl: 'https://www.airbnb.com/s',
    icon: 'home-heart',
    color: '#FF5A5F',
    affiliateId: affiliateIds.airbnb || '',
  },
  viator: {
    name: 'Viator',
    baseUrl: 'https://www.viator.com/searchResults/all',
    icon: 'ticket',
    color: '#00B8D4',
    affiliateId: affiliateIds.viator || '',
  },
  klook: {
    name: 'Klook',
    baseUrl: 'https://www.klook.com/search',
    icon: 'map-marker',
    color: '#FF5722',
    affiliateId: affiliateIds.klook || '',
  },
};

const AffiliateLink: React.FC<AffiliateLinkProps> = ({
  provider,
  destination,
  checkIn,
  checkOut,
  travelers = 2,
  label,
  variant = 'outline',
  size = 'medium',
  showLogo = true,
  trackingId,
  tripId,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('common');
  const config = AFFILIATE_CONFIG[provider];

  /**
   * Build affiliate URL with parameters
   */
  const buildAffiliateUrl = (): string => {
    const params = new URLSearchParams();

    // Add affiliate ID
    params.append('aid', config.affiliateId);

    // Add tracking ID if provided
    if (trackingId) {
      params.append('label', trackingId);
    }

    // Provider-specific parameters
    if (provider === 'booking') {
      if (destination) params.append('ss', destination);
      if (checkIn) params.append('checkin', checkIn);
      if (checkOut) params.append('checkout', checkOut);
      params.append('group_adults', travelers.toString());
    } else if (provider === 'expedia') {
      if (destination) params.append('destination', destination);
      if (checkIn) params.append('startDate', checkIn);
      if (checkOut) params.append('endDate', checkOut);
      params.append('adults', travelers.toString());
    } else if (provider === 'airbnb') {
      // Airbnb uses different URL structure
      const baseUrl = destination
        ? `${config.baseUrl}/${encodeURIComponent(destination)}`
        : config.baseUrl;

      if (checkIn) params.append('checkin', checkIn);
      if (checkOut) params.append('checkout', checkOut);
      params.append('adults', travelers.toString());

      return `${baseUrl}?${params.toString()}`;
    }

    return `${config.baseUrl}?${params.toString()}`;
  };

  /**
   * Track click and open affiliate link
   */
  const handlePress = async () => {
    const url = buildAffiliateUrl();

    // Track click in backend (fire and forget, don't block user)
    apiService.trackAffiliateClick({
      provider,
      destination,
      checkIn,
      checkOut,
      travelers,
      trackingId,
      affiliateUrl: url,
      referrer: Platform.OS,
      tripId,
      metadata: {
        platform: Platform.OS,
        variant,
        size,
      },
    }).catch(error => {
      // Silent fail - don't interrupt user experience
      console.warn('Analytics tracking failed:', error);
    });

    // Open URL
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.error('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Failed to open affiliate link:', error);
    }
  };

  const buttonLabel = label || t('findOnProvider', { name: config.name });

  const buttonStyles = [
    styles.button,
    size === 'small' && styles.buttonSmall,
    size === 'medium' && styles.buttonMedium,
    size === 'large' && styles.buttonLarge,
    variant === 'primary' && { backgroundColor: config.color },
    variant === 'secondary' && { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] },
    variant === 'outline' && {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: config.color,
    },
    style,
  ];

  const textColor = variant === 'primary'
    ? colors.neutral[0]
    : variant === 'outline'
    ? config.color
    : theme.colors.text;

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {showLogo && (
        <Icon
          name={config.icon}
          size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
          color={textColor}
        />
      )}
      <Text style={[styles.buttonText, { color: textColor }]}>
        {buttonLabel}
      </Text>
      <Icon
        name="open-in-new"
        size={size === 'small' ? 14 : size === 'large' ? 20 : 16}
        color={textColor}
        style={styles.externalIcon}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonMedium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonLarge: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  externalIcon: {
    opacity: 0.7,
  },
});

export default AffiliateLink;
