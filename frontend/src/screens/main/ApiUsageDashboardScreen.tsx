import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { ProfileStackParamList } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ApiUsageDashboard'>;

interface ProviderData {
  cost: number;
  calls: number;
}

interface Summary {
  today: { totalCost: number; totalCalls: number; byProvider: Record<string, ProviderData> };
  mtd: { totalCost: number; totalCalls: number; byProvider: Record<string, ProviderData> };
  prevMonth: { totalCost: number; totalCalls: number };
  forecast: number;
  errorRate: number;
}

interface DailyUsage {
  date: string;
  totalCost: number;
  totalCalls: number;
  byProvider: Record<string, ProviderData>;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10A37F',
  openai_embedding: '#059669',
  locationiq: '#3B82F6',
  google_maps: '#4285F4',
  openweather: '#F59E0B',
  google_timezone: '#EF4444',
  email: '#8B5CF6',
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  openai_embedding: 'Embedding',
  locationiq: 'LocationIQ',
  google_maps: 'Google Maps',
  openweather: 'OpenWeather',
  google_timezone: 'Google TZ',
  email: 'Email',
};

const PROVIDERS = ['openai', 'openai_embedding', 'locationiq', 'google_maps', 'openweather', 'google_timezone', 'email'];

type PeriodKey = '7d' | '30d' | 'mtd';

const ApiUsageDashboardScreen: React.FC<Props> = () => {
  const { isDark, theme } = useTheme();
  const styles = createStyles(theme, isDark);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [dailyData, setDailyData] = useState<DailyUsage[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getDateRange = useCallback((p: PeriodKey): { from: string; to: string } => {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from: string;
    if (p === 'mtd') {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      const days = p === '7d' ? 7 : 30;
      const d = new Date();
      d.setDate(d.getDate() - days);
      from = d.toISOString().split('T')[0];
    }
    return { from, to };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { from, to } = getDateRange(period);
      const [summaryData, daily] = await Promise.all([
        apiService.getAdminApiUsageSummary(),
        apiService.getAdminApiUsageDaily(from, to),
      ]);
      setSummary(summaryData);
      setDailyData(daily);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setSummary(null);
        setDailyData([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatCost = (cost: number): string => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatDate = (dateStr: string): string => {
    const parts = dateStr.split('-');
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  };

  const getChangePercent = (): string => {
    if (!summary) return 'N/A';
    if (!summary.prevMonth.totalCost && !summary.mtd.totalCost) return '-';
    if (!summary.prevMonth.totalCost) return summary.mtd.totalCost > 0 ? '+100%' : '-';
    const change = ((summary.mtd.totalCost - summary.prevMonth.totalCost) / summary.prevMonth.totalCost) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  if (loading && !summary) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const renderSummaryCards = () => {
    if (!summary) return null;
    const changePercent = getChangePercent();
    const cards = [
      {
        label: 'Today',
        value: formatCost(summary.today.totalCost),
        sub: `${summary.today.totalCalls} calls`,
        color: '#3B82F6',
      },
      {
        label: 'MTD',
        value: formatCost(summary.mtd.totalCost),
        sub: `${summary.mtd.totalCalls} calls`,
        color: '#10B981',
      },
      {
        label: 'vs Prev Month',
        value: changePercent,
        sub: `prev: ${formatCost(summary.prevMonth.totalCost)}`,
        color: changePercent.startsWith('+') ? '#EF4444' : changePercent.startsWith('-') ? '#10B981' : '#6B7280',
      },
      {
        label: 'Forecast',
        value: formatCost(summary.forecast),
        sub: `err: ${summary.errorRate}%`,
        color: '#8B5CF6',
      },
    ];

    return (
      <View style={styles.cardsRow}>
        {cards.map((card) => (
          <View key={card.label} style={[styles.card, { backgroundColor: theme.colors.white }]}>
            <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
            <Text style={[styles.cardLabel, { color: theme.colors.textSecondary }]}>{card.label}</Text>
            <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>{card.sub}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderProviderBreakdown = () => {
    if (!summary) return null;
    const data = summary.mtd.byProvider;
    const total = summary.mtd.totalCost;
    if (total === 0 && summary.mtd.totalCalls === 0) return null;

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
          Provider Breakdown (MTD)
        </Text>
        {/* Distribution bar */}
        <View style={styles.distributionBar}>
          {PROVIDERS.map((p) => {
            const pCost = data[p]?.cost || 0;
            const pct = total > 0 ? (pCost / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <View
                key={p}
                style={[styles.distributionSegment, { width: `${Math.max(pct, 2)}%`, backgroundColor: PROVIDER_COLORS[p] }]}
              />
            );
          })}
        </View>
        {/* Provider details */}
        {PROVIDERS.map((p) => {
          const pData = data[p];
          if (!pData || (pData.cost === 0 && pData.calls === 0)) return null;
          const pct = total > 0 ? ((pData.cost / total) * 100).toFixed(1) : '0';
          return (
            <View key={p} style={[styles.providerRow, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.providerInfo}>
                <View style={[styles.providerDot, { backgroundColor: PROVIDER_COLORS[p] }]} />
                <Text style={[styles.providerName, { color: theme.colors.text }]}>
                  {PROVIDER_LABELS[p]}
                </Text>
              </View>
              <View style={styles.providerStats}>
                <Text style={[styles.providerCost, { color: theme.colors.text }]}>
                  {formatCost(pData.cost)}
                </Text>
                <Text style={[styles.providerCalls, { color: theme.colors.textSecondary }]}>
                  {pData.calls} calls ({pct}%)
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPeriodToggle = () => {
    const periods: { key: PeriodKey; label: string }[] = [
      { key: '7d', label: '7 Days' },
      { key: '30d', label: '30 Days' },
      { key: 'mtd', label: 'MTD' },
    ];
    return (
      <View style={[styles.section, { backgroundColor: theme.colors.white, paddingBottom: 4 }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
          Daily Usage
        </Text>
        <View style={styles.toggleRow}>
          {periods.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.toggleChip,
                period === p.key && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setPeriod(p.key)}
            >
              <Text
                style={[
                  styles.toggleText,
                  period === p.key && { color: '#fff' },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDailyChart = () => {
    if (dailyData.length === 0) {
      return (
        <View style={[styles.section, { backgroundColor: theme.colors.white, alignItems: 'center', paddingVertical: 30 }]}>
          <Icon name="chart-bar" size={36} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No usage data for this period
          </Text>
        </View>
      );
    }

    const maxCost = Math.max(...dailyData.map((d) => d.totalCost), 0.001);

    return (
      <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
        {dailyData.map((day) => {
          const barWidth = Math.max((day.totalCost / maxCost) * 100, 2);
          return (
            <View key={day.date} style={[styles.dailyRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.dailyDate, { color: theme.colors.textSecondary }]}>
                {formatDate(day.date)}
              </Text>
              <View style={styles.dailyBarContainer}>
                {/* Stacked bar by provider */}
                <View style={styles.dailyBarTrack}>
                  {PROVIDERS.map((p) => {
                    const pCost = day.byProvider[p]?.cost || 0;
                    const pWidth = day.totalCost > 0 ? (pCost / maxCost) * 100 : 0;
                    if (pWidth === 0) return null;
                    return (
                      <View
                        key={p}
                        style={[
                          styles.dailyBarSegment,
                          { width: `${pWidth}%`, backgroundColor: PROVIDER_COLORS[p] },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
              <View style={styles.dailyMeta}>
                <Text style={[styles.dailyCost, { color: theme.colors.text }]}>
                  {formatCost(day.totalCost)}
                </Text>
                <Text style={[styles.dailyCalls, { color: theme.colors.textSecondary }]}>
                  {day.totalCalls}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderLegend = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
      <View style={styles.legendRow}>
        {PROVIDERS.map((p) => (
          <View key={p} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PROVIDER_COLORS[p] }]} />
            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>
              {PROVIDER_LABELS[p]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {renderSummaryCards()}
      {renderProviderBreakdown()}
      {renderPeriodToggle()}
      {renderLegend()}
      {renderDailyChart()}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    cardsRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
    card: {
      flex: 1, minWidth: '45%', padding: 14, borderRadius: 12, alignItems: 'center',
      ...theme.shadows.sm,
    },
    cardValue: { fontSize: 20, fontWeight: '700' },
    cardLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
    cardSub: { fontSize: 10, marginTop: 2 },
    section: {
      marginTop: 8, paddingVertical: 12, paddingHorizontal: 16,
      ...theme.shadows.sm,
    },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    distributionBar: {
      flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12,
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    distributionSegment: { height: '100%' },
    providerRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    providerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    providerDot: { width: 10, height: 10, borderRadius: 5 },
    providerName: { fontSize: 14, fontWeight: '500' },
    providerStats: { alignItems: 'flex-end' },
    providerCost: { fontSize: 14, fontWeight: '600' },
    providerCalls: { fontSize: 11 },
    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    toggleChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
    },
    toggleText: {
      fontSize: 12, fontWeight: '600',
      color: isDark ? colors.neutral[300] : colors.neutral[600],
    },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '500' },
    dailyRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth, gap: 8,
    },
    dailyDate: { fontSize: 11, fontWeight: '500', width: 36 },
    dailyBarContainer: { flex: 1 },
    dailyBarTrack: {
      flexDirection: 'row', height: 14, borderRadius: 3, overflow: 'hidden',
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
    },
    dailyBarSegment: { height: '100%' },
    dailyMeta: { alignItems: 'flex-end', width: 60 },
    dailyCost: { fontSize: 11, fontWeight: '600' },
    dailyCalls: { fontSize: 10 },
    emptyText: { fontSize: 13, marginTop: 8 },
  });

export default ApiUsageDashboardScreen;
