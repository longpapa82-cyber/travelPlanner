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
  const {
    isPremium,
    isAdmin,
    subscriptionTier,
    expiresAt,
    startedAt,
    planType,
    platform,
    aiTripsUsed,
    aiTripsRemaining,
    aiTripsLimit,
    showPaywall,
  } = usePremium();
  const { theme, isDark } = useTheme();

  const openManageSubscription = async () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      Linking.openURL('https://play.google.com/store/account/subscriptions?package=com.longpapa82.travelplanner');
    } else {
      // Web subscriptions are managed via Paddle customer portal.
      // Paddle sends management links via email; open the main site as fallback.
      Linking.openURL('https://mytravel-planner.com/subscription');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  /*
   * V115 (V114-6a fix): Admin-only detailed datetime formatter.
   *
   * Admin grants (hoonjae723@gmail.com, longpapa82@gmail.com) are flagged by
   * the backend with isAdmin=true. For them we surface the time-of-day too
   * so QA can verify auto-renewal instants in production — regular users
   * keep the simpler date-only format to avoid visual noise.
   */
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatBillingDate = (dateStr?: string) =>
    isAdmin ? formatDateTime(dateStr) : formatDate(dateStr);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Current Plan Card */}
      {isPremium ? (
        <View style={[styles.planCard, {
          backgroundColor: '#F59E0B',
          borderColor: '#F59E0B',
        }]}>
          <View style={styles.planHeader}>
            <Icon name="crown" size={32} color="#FFF" />
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: '#FFF' }]}>
                {t('premium.name')}
              </Text>
              <Text style={[styles.planDesc, { color: '#FFFFFFCC' }]}>
                {t('premium.description')}
              </Text>
            </View>
            <PremiumBadge size="medium" />
          </View>
          {/* Plan type badge */}
          {planType && (
            <View style={styles.planMetaRow}>
              <Icon name="calendar-check" size={16} color="#FFFFFFCC" />
              <Text style={[styles.planMetaText, { color: '#FFFFFFEE' }]}>
                {planType === 'yearly'
                  ? t('status.planYearly', { defaultValue: '연간 플랜' })
                  : t('status.planMonthly', { defaultValue: '월간 플랜' })}
              </Text>
            </View>
          )}
          {startedAt && (
            <View style={styles.planMetaRow}>
              <Icon name="calendar-start" size={16} color="#FFFFFFCC" />
              <Text style={[styles.planMetaText, { color: '#FFFFFFCC' }]}>
                {t('status.startedOn', {
                  defaultValue: '시작일: {{date}}',
                  date: formatDate(startedAt),
                })}
              </Text>
            </View>
          )}
          {expiresAt && (
            <View style={styles.planMetaRow}>
              <Icon
                name={planType ? 'autorenew' : 'calendar-end'}
                size={16}
                color="#FFFFFFCC"
              />
              <Text style={[styles.planMetaText, { color: '#FFFFFFCC' }]}>
                {planType
                  ? t('status.renewsOn', {
                      defaultValue: '다음 결제일: {{date}}',
                      date: formatBillingDate(expiresAt),
                    })
                  : t('status.expiresOn', { date: formatBillingDate(expiresAt) })}
              </Text>
            </View>
          )}
          {platform && (
            <View style={styles.planMetaRow}>
              <Icon name="cellphone-link" size={16} color="#FFFFFFCC" />
              <Text style={[styles.planMetaText, { color: '#FFFFFFCC' }]}>
                {t('status.platform', {
                  defaultValue: '결제 수단: {{platform}}',
                  platform,
                })}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.planCard, styles.upgradeCard, { backgroundColor: isDark ? '#78350F' : '#FFFBEB' }]}
          onPress={() => showPaywall()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('promo.title')}
        >
          <View style={styles.planHeader}>
            <View style={styles.upgradeCrownCircle}>
              <Icon name="crown" size={28} color="#F59E0B" />
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                {t('promo.title')}
              </Text>
              <Text style={[styles.planDesc, { color: isDark ? '#FCD34D' : '#B45309' }]}>
                {t('promo.subtitle')}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={isDark ? '#FBBF24' : '#D97706'} />
          </View>
          <Text style={[styles.cancelAnytimeText, { color: isDark ? '#FCD34D' : '#B45309' }]}>{t('promo.cancelAnytime')}</Text>
        </TouchableOpacity>
      )}

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

        {/* Column headers */}
        <View style={[styles.compareRow, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.compareFeature, { color: 'transparent' }]}>-</Text>
          <Text style={[styles.compareHeader, { color: theme.colors.textSecondary }]}>Free</Text>
          <Text style={[styles.compareHeader, { color: '#F59E0B' }]}>Pro</Text>
        </View>

        {[
          { feature: t('benefits.tripCreation'), freeLabel: '\u2713', premiumLabel: '\u2713', freeOk: true },
          { feature: t('benefits.social'), freeLabel: '\u2713', premiumLabel: '\u2713', freeOk: true },
          { feature: t('benefits.expenses'), freeLabel: '\u2713', premiumLabel: '\u2713', freeOk: true },
          { feature: t('benefits.unlimitedAi'), freeLabel: '3/mo', premiumLabel: '30/mo', freeOk: false },
          { feature: t('benefits.noAds'), freeLabel: '\u2717', premiumLabel: '\u2713', freeOk: false },
          { feature: t('benefits.premiumBadge'), freeLabel: '\u2717', premiumLabel: '\u2713', freeOk: false },
        ].map((row, idx) => (
          <View
            key={idx}
            style={[styles.compareRow, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.compareFeature, { color: theme.colors.text }]}>{row.feature}</Text>
            <Text style={[styles.compareValue, { color: row.freeOk ? (colors.success?.main || '#22C55E') : colors.neutral[400] }]}>
              {row.freeLabel}
            </Text>
            <Text style={[styles.compareValue, { color: '#F59E0B', fontWeight: '700' }]}>
              {row.premiumLabel}
            </Text>
          </View>
        ))}

        {/* Yearly savings note */}
        {!isPremium && (
          <View style={[styles.savingsRow, { backgroundColor: isDark ? '#78350F' : '#FFFBEB' }]}>
            <Icon name="tag-outline" size={16} color="#F59E0B" />
            <Text style={[styles.savingsText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
              $29.99/yr = ~$2.50/mo
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!isPremium && (
          <Button variant="primary" fullWidth onPress={() => showPaywall()} style={{ backgroundColor: '#F59E0B' }}>
            {t('promo.cta')}
          </Button>
        )}

        {isPremium && (
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
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  planMetaText: {
    fontSize: 13,
    fontWeight: '500',
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
  compareValue: {
    width: 50,
    textAlign: 'center',
    fontSize: 14,
  },
  compareHeader: {
    width: 50,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  upgradeCard: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  upgradeCrownCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelAnytimeText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
});

export default SubscriptionScreen;
