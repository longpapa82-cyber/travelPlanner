import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../contexts/PremiumContext';
import { useTheme } from '../contexts/ThemeContext';
import { PREMIUM_ENABLED } from '../constants/config';

const DISMISS_KEY = '@travelplanner:promo_dismiss_ts';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const PremiumPromoBanner: React.FC = () => {
  const { t } = useTranslation('premium');
  const { isPremium, showPaywall } = usePremium();
  const { theme, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      fadeAnim.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (isPremium || !PREMIUM_ENABLED) return;

    AsyncStorage.getItem(DISMISS_KEY).then((val) => {
      if (val) {
        const dismissedAt = parseInt(val, 10);
        if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
      }
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }).catch(() => {
      setVisible(true);
    });
  }, [isPremium, fadeAnim]);

  const handleDismiss = () => {
    AsyncStorage.setItem(DISMISS_KEY, String(Date.now())).catch(() => {});
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => setVisible(false));
  };

  const handleCta = () => {
    showPaywall('general');
  };

  if (!visible || isPremium || !PREMIUM_ENABLED) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.card, { backgroundColor: isDark ? '#78350F' : '#FFFBEB' }]}>
        {/* Gold accent bar */}
        <View style={styles.accentBar} />

        {/* Dismiss button */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('promo.dismiss', { defaultValue: 'Dismiss' })}
        >
          <Icon name="close" size={18} color={isDark ? '#FBBF24' : '#92400E'} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Crown icon */}
          <View style={styles.iconCircle}>
            <Icon name="crown" size={28} color="#F59E0B" />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: isDark ? '#FDE68A' : '#92400E' }]}>
              {t('promo.title')}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#FCD34D' : '#B45309' }]}>
              {t('promo.subtitle')}
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleCta}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('promo.cta')}
        >
          <Icon name="star-four-points" size={16} color="#FFF" />
          <Text style={styles.ctaText}>{t('promo.cta')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 8px rgba(245,158,11,0.15)' },
    }),
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F59E0B',
  },
  dismissBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingRight: 24,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default PremiumPromoBanner;
