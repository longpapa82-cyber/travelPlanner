import React, { memo, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import { Trip } from '../types';

interface Props {
  trip: Trip;
}

type TabKey = 'overview' | 'category' | 'daily';

const CATEGORY_ICONS: Record<string, string> = {
  // English keys (i18n / manual)
  meal: 'silverware-fork-knife',
  sightseeing: 'binoculars',
  shopping: 'shopping',
  experience: 'star',
  rest: 'coffee',
  transport: 'bus',
  accommodation: 'bed',
  other: 'dots-horizontal',
  // English keys (AI-generated data)
  food: 'silverware-fork-knife',
  culture: 'star',
  entertainment: 'star',
  nature: 'tree',
  transportation: 'bus',
  // Korean keys (backend data values)
  식사: 'silverware-fork-knife',
  관광: 'binoculars',
  쇼핑: 'shopping',
  체험: 'star',
  휴식: 'coffee',
  이동: 'bus',
  숙소: 'bed',
};

const CATEGORY_COLORS: Record<string, string> = {
  // English keys (i18n / manual)
  meal: '#F59E0B',
  sightseeing: '#3B82F6',
  shopping: '#EC4899',
  experience: '#8B5CF6',
  rest: '#10B981',
  transport: '#6366F1',
  accommodation: '#EF4444',
  other: '#6B7280',
  // English keys (AI-generated data)
  food: '#F59E0B',
  culture: '#8B5CF6',
  entertainment: '#8B5CF6',
  nature: '#10B981',
  transportation: '#6366F1',
  // Korean keys (backend data values)
  식사: '#F59E0B',
  관광: '#3B82F6',
  쇼핑: '#EC4899',
  체험: '#8B5CF6',
  휴식: '#10B981',
  이동: '#6366F1',
  숙소: '#EF4444',
};

const BudgetSummaryInner: React.FC<Props> = ({ trip }) => {
  const { t } = useTranslation('trips');
  const { t: tComp } = useTranslation('components');
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const summary = useMemo(() => {
    let totalEstimated = 0;
    let totalActual = 0;
    let activitiesWithActual = 0;
    const byCategory: Record<string, { estimated: number; actual: number; count: number }> = {};
    const byDay: { day: number; estimated: number; actual: number }[] = [];

    for (const itinerary of trip.itineraries) {
      let dayEstimated = 0;
      let dayActual = 0;

      for (const activity of itinerary.activities) {
        const est = activity.estimatedCost || 0;
        const act = (activity.actualCost !== undefined && activity.actualCost !== null) ? activity.actualCost : 0;
        const type = activity.type || 'other';

        totalEstimated += est;
        if (activity.actualCost !== undefined && activity.actualCost !== null) {
          totalActual += act;
          activitiesWithActual++;
        }

        dayEstimated += est;
        dayActual += act;

        if (!byCategory[type]) {
          byCategory[type] = { estimated: 0, actual: 0, count: 0 };
        }
        byCategory[type].estimated += est;
        byCategory[type].actual += act;
        byCategory[type].count++;
      }

      byDay.push({ day: itinerary.dayNumber, estimated: dayEstimated, actual: dayActual });
    }

    const budget = trip.totalBudget || 0;
    const remaining = budget > 0 ? budget - totalActual : 0;
    const spentPercentage = budget > 0 ? (totalActual / budget) * 100 : 0;
    const days = trip.itineraries.length || 1;
    const perDay = totalActual > 0 ? totalActual / days : totalEstimated / days;

    return { totalEstimated, totalActual, activitiesWithActual, budget, remaining, spentPercentage, byCategory, byDay, perDay };
  }, [trip]);

  const currency = trip.budgetCurrency || 'USD';
  const fmt = (n: number) => `${currency === 'KRW' ? '₩' : currency === 'JPY' ? '¥' : '$'}${Math.round(n).toLocaleString()}`;

  const barColor = summary.spentPercentage > 90
    ? '#EF4444'
    : summary.spentPercentage > 70
      ? colors.secondary[500]
      : colors.primary[500];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t('detail.budget.title') },
    { key: 'category', label: t('detail.budget.byCategory') },
    { key: 'daily', label: t('detail.budget.byDay') },
  ];

  const sortedCategories = Object.entries(summary.byCategory)
    .sort(([, a], [, b]) => (b.estimated + b.actual) - (a.estimated + a.actual));

  const maxCategoryAmount = Math.max(
    ...sortedCategories.map(([, v]) => Math.max(v.estimated, v.actual)),
    1,
  );

  const maxDayAmount = Math.max(
    ...summary.byDay.map(d => Math.max(d.estimated, d.actual)),
    1,
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && { borderBottomColor: colors.primary[500], borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab.key ? colors.primary[500] : isDark ? colors.neutral[400] : colors.neutral[500] },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Budget bar */}
          {summary.budget > 0 && (
            <View style={styles.barSection}>
              <View style={styles.barBackground}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(summary.spentPercentage, 100)}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isDark && styles.textMuted]}>
                {Math.round(summary.spentPercentage)}%
              </Text>
            </View>
          )}

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            {summary.budget > 0 && (
              <View style={styles.stat}>
                <Text style={[styles.statLabel, isDark && styles.textMuted]}>{t('detail.budget.total')}</Text>
                <Text style={[styles.statValue, isDark && styles.textDark]}>{fmt(summary.budget)}</Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text style={[styles.statLabel, isDark && styles.textMuted]}>{t('detail.budget.estimated')}</Text>
              <Text style={[styles.statValue, isDark && styles.textDark]}>{fmt(summary.totalEstimated)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, isDark && styles.textMuted]}>{t('detail.budget.spent')}</Text>
              <Text style={[styles.statValue, { color: barColor }]}>{fmt(summary.totalActual)}</Text>
            </View>
            {summary.budget > 0 && (
              <View style={styles.stat}>
                <Text style={[styles.statLabel, isDark && styles.textMuted]}>{t('detail.budget.remaining')}</Text>
                <Text style={[styles.statValue, { color: summary.remaining >= 0 ? '#16A34A' : '#EF4444' }]}>
                  {fmt(summary.remaining)}
                </Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text style={[styles.statLabel, isDark && styles.textMuted]}>{t('detail.budget.perDay')}</Text>
              <Text style={[styles.statValue, isDark && styles.textDark]}>{fmt(summary.perDay)}</Text>
            </View>
          </View>
        </>
      )}

      {/* Category Tab */}
      {activeTab === 'category' && (
        <View style={styles.categoryList}>
          {sortedCategories.map(([type, data]) => {
            const pct = maxCategoryAmount > 0 ? (Math.max(data.estimated, data.actual) / maxCategoryAmount) * 100 : 0;
            return (
              <View key={type} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <View style={[styles.categoryIcon, { backgroundColor: (CATEGORY_COLORS[type] || '#6B7280') + '20' }]}>
                    <Icon
                      name={(CATEGORY_ICONS[type] || 'dots-horizontal') as any}
                      size={14}
                      color={CATEGORY_COLORS[type] || '#6B7280'}
                    />
                  </View>
                  <Text style={[styles.categoryName, isDark && styles.textDark]}>
                    {tComp(`activityModal.types.${type}`, type)}
                  </Text>
                  <Text style={[styles.categoryAmount, isDark && styles.textDark]}>
                    {fmt(data.actual > 0 ? data.actual : data.estimated)}
                  </Text>
                </View>
                <View style={styles.categoryBarBg}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: CATEGORY_COLORS[type] || '#6B7280',
                      },
                    ]}
                  />
                </View>
                {data.actual > 0 && data.estimated > 0 && (
                  <Text style={[styles.categoryMeta, isDark && styles.textMuted]}>
                    {fmt(data.estimated)} → {fmt(data.actual)}
                  </Text>
                )}
              </View>
            );
          })}
          {sortedCategories.length === 0 && (
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>-</Text>
          )}
        </View>
      )}

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <View style={styles.categoryList}>
          {summary.byDay.map((day) => {
            const amount = day.actual > 0 ? day.actual : day.estimated;
            const pct = maxDayAmount > 0 ? (amount / maxDayAmount) * 100 : 0;
            return (
              <View key={day.day} style={styles.categoryRow}>
                <View style={styles.categoryHeader}>
                  <Text style={[styles.categoryName, isDark && styles.textDark]}>
                    {t('detail.budget.dayLabel', { day: day.day })}
                  </Text>
                  <Text style={[styles.categoryAmount, isDark && styles.textDark]}>
                    {fmt(amount)}
                  </Text>
                </View>
                <View style={styles.categoryBarBg}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: colors.primary[500],
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export const BudgetSummary = memo(BudgetSummaryInner);
BudgetSummary.displayName = 'BudgetSummary';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: colors.neutral[800],
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tab: {
    flex: 1,
    paddingBottom: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  barSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  barBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[200],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    width: 35,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stat: {
    flex: 1,
    minWidth: 80,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  categoryList: {
    gap: 10,
  },
  categoryRow: {
    gap: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  categoryBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral[200],
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryMeta: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.neutral[500],
  },
  textDark: {
    color: colors.neutral[100],
  },
  textMuted: {
    color: colors.neutral[400],
  },
});
