import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { ProfileStackParamList } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AdminDashboard'>;

interface AiMetrics {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  manual: number;
  successRate: number;
}

const MENU_ITEMS = [
  { key: 'users', icon: 'account-group', screen: 'UserManagement' as const, color: '#3B82F6' },
  { key: 'errorLogs', icon: 'bug-outline', screen: 'ErrorLog' as const, color: '#EF4444' },
  { key: 'revenue', icon: 'chart-line', screen: 'RevenueDashboard' as const, color: '#10B981' },
  { key: 'announcements', icon: 'bullhorn-outline', screen: 'AnnouncementManagement' as const, color: '#F59E0B' },
] as const;

const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation('admin');
  const { isDark, theme } = useTheme();
  const styles = createStyles(theme, isDark);
  const [aiMetrics, setAiMetrics] = useState<AiMetrics | null>(null);

  const fetchAiMetrics = useCallback(async () => {
    try {
      const data = await apiService.getAdminAiMetrics();
      setAiMetrics(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAiMetrics();
  }, [fetchAiMetrics]);

  const getRateColor = (rate: number) => {
    if (rate >= 90) return colors.success.main;
    if (rate >= 70) return '#F59E0B';
    return colors.error.main;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="shield-crown-outline" size={36} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('title')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {t('dashboard.subtitle')}
        </Text>
      </View>

      {/* AI Metrics Card */}
      {aiMetrics && (
        <View style={[styles.aiCard, { backgroundColor: theme.colors.white }]}>
          <View style={styles.aiCardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#8B5CF615' }]}>
              <Icon name="robot-outline" size={28} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiCardTitle, { color: theme.colors.text }]}>
                {t('aiMetrics.title')}
              </Text>
              <Text style={[styles.aiCardSubtitle, { color: theme.colors.textSecondary }]}>
                {t('aiMetrics.totalTrips', { count: aiMetrics.total })}
              </Text>
            </View>
            <View style={[styles.rateBadge, { backgroundColor: getRateColor(aiMetrics.successRate) + '20' }]}>
              <Text style={[styles.rateText, { color: getRateColor(aiMetrics.successRate) }]}>
                {aiMetrics.successRate}%
              </Text>
            </View>
          </View>
          <View style={styles.aiStatsRow}>
            <View style={styles.aiStat}>
              <Text style={[styles.aiStatValue, { color: colors.success.main }]}>{aiMetrics.success}</Text>
              <Text style={[styles.aiStatLabel, { color: theme.colors.textSecondary }]}>{t('aiMetrics.success')}</Text>
            </View>
            <View style={styles.aiStat}>
              <Text style={[styles.aiStatValue, { color: colors.error.main }]}>{aiMetrics.failed}</Text>
              <Text style={[styles.aiStatLabel, { color: theme.colors.textSecondary }]}>{t('aiMetrics.failed')}</Text>
            </View>
            <View style={styles.aiStat}>
              <Text style={[styles.aiStatValue, { color: '#F59E0B' }]}>{aiMetrics.skipped}</Text>
              <Text style={[styles.aiStatLabel, { color: theme.colors.textSecondary }]}>{t('aiMetrics.skipped')}</Text>
            </View>
            <View style={styles.aiStat}>
              <Text style={[styles.aiStatValue, { color: colors.neutral[500] }]}>{aiMetrics.manual}</Text>
              <Text style={[styles.aiStatLabel, { color: theme.colors.textSecondary }]}>{t('aiMetrics.manual')}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.menuGrid}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuCard, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t(`menu.${item.key}`)}
          >
            <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
              <Icon name={item.icon as any} size={28} color={item.color} />
            </View>
            <Text style={[styles.menuLabel, { color: theme.colors.text }]}>
              {t(`menu.${item.key}`)}
            </Text>
            <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (theme: any, _isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      backgroundColor: theme.colors.white,
      alignItems: 'center',
      paddingVertical: 28,
      gap: 6,
      ...theme.shadows.sm,
    },
    title: { fontSize: 22, fontWeight: '700', marginTop: 4 },
    subtitle: { fontSize: 14 },
    aiCard: {
      margin: 16,
      marginBottom: 0,
      padding: 18,
      borderRadius: 14,
      ...theme.shadows.sm,
    },
    aiCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    aiCardTitle: { fontSize: 16, fontWeight: '700' },
    aiCardSubtitle: { fontSize: 13, marginTop: 2 },
    rateBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    rateText: { fontSize: 16, fontWeight: '700' },
    aiStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    aiStat: { alignItems: 'center', gap: 2 },
    aiStatValue: { fontSize: 20, fontWeight: '700' },
    aiStatLabel: { fontSize: 11, fontWeight: '500' },
    menuGrid: { padding: 16, gap: 12 },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      borderRadius: 14,
      gap: 14,
      ...theme.shadows.sm,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  });

export default AdminDashboardScreen;
