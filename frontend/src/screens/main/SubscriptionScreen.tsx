import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { usePremium } from '../../contexts/PremiumContext';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import PremiumBadge from '../../components/PremiumBadge';
import Button from '../../components/core/Button';

const SubscriptionScreen = () => {
  const { t } = useTranslation('premium');
  const { isPremium, subscriptionTier, expiresAt, aiTripsUsed, aiTripsRemaining, showPaywall } = usePremium();
  const { theme, isDark } = useTheme();

  const openManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Current Plan Card */}
      <View style={[styles.planCard, {
        backgroundColor: isPremium ? '#F59E0B' : (isDark ? colors.neutral[800] : '#FFF'),
        borderColor: isPremium ? '#F59E0B' : theme.colors.border,
      }]}>
        <View style={styles.planHeader}>
          {isPremium ? (
            <Icon name="crown" size={32} color="#FFF" />
          ) : (
            <Icon name="account-circle" size={32} color={theme.colors.primary} />
          )}
          <View style={styles.planInfo}>
            <Text style={[styles.planName, { color: isPremium ? '#FFF' : theme.colors.text }]}>
              {isPremium ? t('premium.name') : t('free.name')}
            </Text>
            <Text style={[styles.planDesc, { color: isPremium ? '#FFFFFFCC' : theme.colors.textSecondary }]}>
              {isPremium ? t('premium.description') : t('free.description')}
            </Text>
          </View>
          {isPremium && <PremiumBadge size="medium" />}
        </View>

        {isPremium && expiresAt && (
          <Text style={[styles.expiresText, { color: '#FFFFFFAA' }]}>
            {t('status.expiresOn', { date: formatDate(expiresAt) })}
          </Text>
        )}
      </View>

      {/* AI Trip Usage */}
      {!isPremium && (
        <View style={[styles.section, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('paywall.aiLimitTitle')}
          </Text>
          <View style={styles.usageBar}>
            <View style={[styles.usageBarBg, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${Math.min(100, (aiTripsUsed / 3) * 100)}%`,
                    backgroundColor: aiTripsRemaining > 0 ? theme.colors.primary : colors.error?.main || '#EF4444',
                  },
                ]}
              />
            </View>
            <Text style={[styles.usageText, { color: theme.colors.textSecondary }]}>
              {aiTripsUsed} / 3 {t('paywall.aiUsed')}
            </Text>
          </View>
        </View>
      )}

      {/* Feature Comparison */}
      <View style={[styles.section, { backgroundColor: isDark ? colors.neutral[800] : '#FFF' }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('paywall.compareTitle')}
        </Text>

        {[
          { feature: t('benefits.tripCreation'), free: true, premium: true },
          { feature: t('benefits.social'), free: true, premium: true },
          { feature: t('benefits.expenses'), free: true, premium: true },
          { feature: t('benefits.unlimitedAi'), free: false, premium: true },
          { feature: t('benefits.noAds'), free: false, premium: true },
          { feature: t('benefits.premiumBadge'), free: false, premium: true },
        ].map((row, idx) => (
          <View
            key={idx}
            style={[styles.compareRow, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.compareFeature, { color: theme.colors.text }]}>{row.feature}</Text>
            <Icon
              name={row.free ? 'check-circle' : 'close-circle'}
              size={20}
              color={row.free ? (colors.success?.main || '#22C55E') : (colors.neutral[400])}
              style={styles.compareIcon}
            />
            <Icon
              name={row.premium ? 'check-circle' : 'close-circle'}
              size={20}
              color={row.premium ? '#F59E0B' : (colors.neutral[400])}
              style={styles.compareIcon}
            />
          </View>
        ))}

        {/* Column headers */}
        <View style={[styles.compareRow, { borderBottomWidth: 0, paddingTop: 0 }]}>
          <Text style={[styles.compareFeature, { color: 'transparent' }]}>-</Text>
          <Text style={[styles.compareHeader, { color: theme.colors.textSecondary }]}>Free</Text>
          <Text style={[styles.compareHeader, { color: '#F59E0B' }]}>Pro</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!isPremium && (
          <Button variant="primary" fullWidth onPress={showPaywall} style={{ backgroundColor: '#F59E0B' }}>
            {t('actions.subscribe')}
          </Button>
        )}

        {isPremium && Platform.OS !== 'web' && (
          <Button variant="outline" fullWidth onPress={openManageSubscription}>
            {t('actions.manage')}
          </Button>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  planCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
  },
  planDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  expiresText: {
    fontSize: 12,
    marginTop: 12,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  usageBar: {
    gap: 8,
  },
  usageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: 8,
    borderRadius: 4,
  },
  usageText: {
    fontSize: 13,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareFeature: {
    flex: 1,
    fontSize: 14,
  },
  compareIcon: {
    width: 50,
    textAlign: 'center',
  },
  compareHeader: {
    width: 50,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
});

export default SubscriptionScreen;
