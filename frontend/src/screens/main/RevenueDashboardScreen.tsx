/**
 * RevenueDashboardScreen
 *
 * Admin-only dashboard showing subscription revenue by platform.
 * Ad revenue is tracked in the AdMob dashboard separately.
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

interface SubscriptionStats {
  total: { active: number; revenue: number; mrr: number };
  byPlatform: Record<string, { active: number; revenue: number; mrr: number }>;
  commissions: Record<string, number>;
}

const SUBSCRIPTION_PLATFORMS: Record<string, { icon: string; color: string; label: string }> = {
  web: { icon: 'web', color: '#3B82F6', label: 'Paddle (Web)' },
  ios: { icon: 'apple', color: '#1D1D1F', label: 'Apple (iOS)' },
  android: { icon: 'google-play', color: '#34A853', label: 'Google (Android)' },
};

const RevenueDashboardScreen = () => {
  const { t } = useTranslation(['profile', 'admin']);
  const { theme, isDark } = useTheme();

  const [subStats, setSubStats] = useState<SubscriptionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const subStatsRes = await apiService.getAdminSubscriptionStats().catch(() => null);
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

      {/* AdMob Info */}
      <View style={[styles.admobInfoCard, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
        <Icon name="information-outline" size={18} color={theme.colors.primary} />
        <Text style={[styles.admobInfoText, { color: theme.colors.textSecondary }]}>
          {t('admin:admobDashboardNote', { defaultValue: 'AdMob 광고 수익은 AdMob 대시보드에서 확인하세요' })}
        </Text>
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
    section: {
      paddingHorizontal: 16,
      marginTop: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    admobInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 14,
      borderRadius: 12,
      ...theme.shadows.sm,
    },
    admobInfoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
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
