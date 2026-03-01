/**
 * RevenueDashboardScreen
 *
 * Admin-only dashboard showing affiliate click statistics,
 * provider breakdown, and revenue summary.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import apiService from '../../services/api';

interface Summary {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommission: number;
  topProvider: string;
  topDestination: string;
}

interface ProviderStat {
  provider: string;
  totalClicks: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommission: number;
}

const PROVIDER_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  booking: { icon: 'bed', color: '#003580', label: 'Booking.com' },
  expedia: { icon: 'airplane', color: '#FFCB03', label: 'Expedia' },
  hotels: { icon: 'home', color: '#D32F2F', label: 'Hotels.com' },
  airbnb: { icon: 'home-heart', color: '#FF5A5F', label: 'Airbnb' },
  viator: { icon: 'ticket', color: '#00B8D4', label: 'Viator' },
  klook: { icon: 'map-marker', color: '#FF5722', label: 'Klook' },
};

interface SubscriptionStats {
  total: { active: number; revenue: number; mrr: number };
  byPlatform: Record<string, { active: number; revenue: number; mrr: number }>;
  commissions: Record<string, number>;
}

const SUBSCRIPTION_PLATFORMS: Record<string, { icon: string; color: string; label: string }> = {
  web: { icon: 'web', color: '#635BFF', label: 'Stripe (Web)' },
  ios: { icon: 'apple', color: '#1D1D1F', label: 'Apple (iOS)' },
  android: { icon: 'google-play', color: '#34A853', label: 'Google (Android)' },
};

const RevenueDashboardScreen = () => {
  const { t } = useTranslation(['profile', 'admin']);
  const { theme, isDark } = useTheme();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([]);
  const [subStats, setSubStats] = useState<SubscriptionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [summaryRes, statsRes, subStatsRes] = await Promise.all([
        apiService.getAffiliateSummary(30),
        apiService.getAffiliateProviderStats(),
        apiService.getAdminSubscriptionStats().catch(() => null),
      ]);
      setSummary(summaryRes.summary || summaryRes);
      setProviderStats(statsRes.stats || []);
      setSubStats(subStatsRes);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(t('revenue.adminOnly'));
      } else {
        setError(t('revenue.loadError'));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const styles = createStyles(theme, isDark);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Icon name="lock-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* Period Label */}
      <View style={styles.periodBadge}>
        <Icon name="calendar-range" size={14} color={theme.colors.primary} />
        <Text style={[styles.periodText, { color: theme.colors.primary }]}>
          {t('revenue.last30Days')}
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
          <Icon name="cursor-default-click" size={24} color={colors.primary[500]} />
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            {summary?.totalClicks ?? 0}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            {t('revenue.totalClicks')}
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
          <Icon name="swap-horizontal" size={24} color={colors.success.main} />
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            {summary?.totalConversions ?? 0}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            {t('revenue.conversions')}
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
          <Icon name="percent-outline" size={24} color={colors.warning.main} />
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            {(summary?.conversionRate ?? 0).toFixed(1)}%
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            {t('revenue.conversionRate')}
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
          <Icon name="cash-multiple" size={24} color={colors.primary[500]} />
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
            {formatCurrency(summary?.totalCommission ?? 0)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            {t('revenue.commission')}
          </Text>
        </View>
      </View>

      {/* Top Highlights */}
      {summary && (
        <View style={[styles.highlightsCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('revenue.highlights')}
          </Text>
          <View style={styles.highlightRow}>
            <Icon name="trophy" size={18} color={colors.warning.main} />
            <Text style={[styles.highlightLabel, { color: theme.colors.textSecondary }]}>
              {t('revenue.topProvider')}
            </Text>
            <Text style={[styles.highlightValue, { color: theme.colors.text }]}>
              {PROVIDER_CONFIG[summary.topProvider]?.label || summary.topProvider}
            </Text>
          </View>
          <View style={styles.highlightRow}>
            <Icon name="map-marker-star" size={18} color={colors.travel.ocean} />
            <Text style={[styles.highlightLabel, { color: theme.colors.textSecondary }]}>
              {t('revenue.topDestination')}
            </Text>
            <Text style={[styles.highlightValue, { color: theme.colors.text }]}>
              {summary.topDestination}
            </Text>
          </View>
          <View style={styles.highlightRow}>
            <Icon name="cash" size={18} color={colors.success.main} />
            <Text style={[styles.highlightLabel, { color: theme.colors.textSecondary }]}>
              {t('revenue.totalRevenue')}
            </Text>
            <Text style={[styles.highlightValue, { color: theme.colors.text }]}>
              {formatCurrency(summary.totalRevenue)}
            </Text>
          </View>
        </View>
      )}

      {/* Subscription Revenue */}
      {subStats && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('admin:subscription.title')}
          </Text>

          {/* Total MRR card */}
          <View style={[styles.mrrCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
            <Text style={[styles.mrrLabel, { color: theme.colors.textSecondary }]}>
              {t('admin:subscription.mrr')}
            </Text>
            <Text style={[styles.mrrValue, { color: colors.success.main }]}>
              {formatCurrency(subStats.total.mrr)}
            </Text>
            <Text style={[styles.mrrSubs, { color: theme.colors.textSecondary }]}>
              {subStats.total.active} {t('admin:subscription.activeSubscribers')}
            </Text>
          </View>

          {/* Platform cards */}
          {Object.entries(SUBSCRIPTION_PLATFORMS).map(([platform, config]) => {
            const data = subStats.byPlatform[platform] || { active: 0, revenue: 0, mrr: 0 };
            const commRate = subStats.commissions[platform] || 0;
            return (
              <View key={platform} style={[styles.subPlatformCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
                <View style={styles.subPlatformHeader}>
                  <View style={[styles.subPlatformIcon, { backgroundColor: `${config.color}15` }]}>
                    <Icon name={config.icon as any} size={20} color={config.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subPlatformName, { color: theme.colors.text }]}>{config.label}</Text>
                    <Text style={[styles.subPlatformSubs, { color: theme.colors.textSecondary }]}>
                      {data.active} {t('admin:subscription.activeSubscribers')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.subPlatformRevenue, { color: colors.success.main }]}>
                      {formatCurrency(data.revenue)}
                    </Text>
                    <Text style={[styles.subPlatformComm, { color: theme.colors.textSecondary }]}>
                      {t('admin:subscription.commissionRate')}: {(commRate * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Provider Breakdown */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('revenue.byProvider')}
        </Text>

        {providerStats.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
            <Icon name="chart-bar" size={40} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {t('revenue.noData')}
            </Text>
          </View>
        ) : (
          providerStats.map((stat) => {
            const config = PROVIDER_CONFIG[stat.provider] || {
              icon: 'link',
              color: theme.colors.primary,
              label: stat.provider,
            };

            return (
              <View
                key={stat.provider}
                style={[styles.providerCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}
              >
                <View style={styles.providerHeader}>
                  <View style={[styles.providerIcon, { backgroundColor: `${config.color}15` }]}>
                    <Icon name={config.icon as any} size={22} color={config.color} />
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={[styles.providerName, { color: theme.colors.text }]}>{config.label}</Text>
                    <Text style={[styles.providerSubtext, { color: theme.colors.textSecondary }]}>
                      {stat.totalClicks} {t('revenue.clicks')} · {stat.conversions} {t('revenue.conv')}
                    </Text>
                  </View>
                  <Text style={[styles.providerCommission, { color: colors.success.main }]}>
                    {formatCurrency(stat.totalCommission)}
                  </Text>
                </View>

                {/* Progress bar for conversion rate */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarBg, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: config.color,
                          width: `${Math.min(stat.conversionRate, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]}>
                    {stat.conversionRate.toFixed(1)}%
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      marginTop: 12,
      textAlign: 'center',
    },
    periodBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? `${theme.colors.primary}20` : `${theme.colors.primary}10`,
    },
    periodText: {
      fontSize: 13,
      fontWeight: '600',
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    summaryCard: {
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      ...theme.shadows.sm,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      marginTop: 8,
    },
    summaryLabel: {
      fontSize: 12,
      marginTop: 4,
    },
    highlightsCard: {
      marginHorizontal: 16,
      marginBottom: 20,
      padding: 16,
      borderRadius: 12,
      ...theme.shadows.sm,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    highlightLabel: {
      flex: 1,
      fontSize: 14,
    },
    highlightValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    emptyCard: {
      alignItems: 'center',
      padding: 32,
      borderRadius: 12,
      ...theme.shadows.sm,
    },
    emptyText: {
      fontSize: 14,
      marginTop: 8,
    },
    providerCard: {
      padding: 16,
      borderRadius: 12,
      marginBottom: 10,
      ...theme.shadows.sm,
    },
    providerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    providerIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    providerInfo: {
      flex: 1,
    },
    providerName: {
      fontSize: 15,
      fontWeight: '600',
    },
    providerSubtext: {
      fontSize: 12,
      marginTop: 2,
    },
    providerCommission: {
      fontSize: 16,
      fontWeight: '700',
    },
    progressBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressLabel: {
      fontSize: 12,
      fontWeight: '600',
      width: 45,
      textAlign: 'right',
    },
    mrrCard: {
      alignItems: 'center',
      padding: 20,
      borderRadius: 12,
      marginBottom: 12,
      ...theme.shadows.sm,
    },
    mrrLabel: { fontSize: 13 },
    mrrValue: { fontSize: 32, fontWeight: '700', marginVertical: 4 },
    mrrSubs: { fontSize: 12 },
    subPlatformCard: {
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      ...theme.shadows.sm,
    },
    subPlatformHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    subPlatformIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subPlatformName: { fontSize: 14, fontWeight: '600' },
    subPlatformSubs: { fontSize: 11, marginTop: 2 },
    subPlatformRevenue: { fontSize: 16, fontWeight: '700' },
    subPlatformComm: { fontSize: 10, marginTop: 2 },
  });

export default RevenueDashboardScreen;
