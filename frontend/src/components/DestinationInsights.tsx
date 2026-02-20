import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import analyticsService, {
  DestinationRecommendations,
} from '../services/analytics.service';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';

interface DestinationInsightsProps {
  destination: string;
  onRecommendationsLoaded?: (recommendations: DestinationRecommendations) => void;
}

export const DestinationInsights: React.FC<DestinationInsightsProps> = ({
  destination,
  onRecommendationsLoaded,
}) => {
  const { t } = useTranslation('components');
  const { theme, isDark } = useTheme();
  const [recommendations, setRecommendations] =
    useState<DestinationRecommendations | null>(null);
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  useEffect(() => {
    if (destination && destination.trim().length >= 2) {
      loadRecommendations();
    } else {
      setRecommendations(null);
    }
  }, [destination]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const data = await analyticsService.getDestinationRecommendations(
        destination.trim()
      );

      if (data && data.topActivities && data.topActivities.length > 0) {
        setRecommendations(data);
        if (onRecommendationsLoaded) {
          onRecommendationsLoaded(data);
        }
      } else {
        setRecommendations(null);
      }
    } catch (error) {
      setRecommendations(null);
    } finally {
      setLoading(false);
    }
  };

  if (!destination || destination.trim().length < 2) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>{t('destinationInsights.loading')}</Text>
        </View>
      </View>
    );
  }

  if (!recommendations) {
    return null;
  }

  const currentMonth = new Date().getMonth() + 1;
  const isBestMonth = recommendations.bestMonths?.includes(currentMonth);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={20} color={theme.colors.primary} />
        <Text style={styles.headerTitle}>{t('destinationInsights.header')}</Text>
      </View>

      <View style={styles.insightsGrid}>
        {/* Recommended Duration */}
        {recommendations.recommendedDuration && (
          <View style={styles.insightCard}>
            <Ionicons
              name="calendar-outline"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.insightValue}>
              {t('destinationInsights.days', { days: recommendations.recommendedDuration })}
            </Text>
            <Text style={styles.insightLabel}>{t('destinationInsights.avgDuration')}</Text>
          </View>
        )}

        {/* Recommended Travelers */}
        {recommendations.recommendedTravelers && (
          <View style={styles.insightCard}>
            <Ionicons
              name="people-outline"
              size={24}
              color={theme.colors.secondary}
            />
            <Text style={styles.insightValue}>
              {t('destinationInsights.people', { count: recommendations.recommendedTravelers })}
            </Text>
            <Text style={styles.insightLabel}>{t('destinationInsights.avgTravelers')}</Text>
          </View>
        )}

        {/* Budget */}
        {recommendations.budget && (
          <View style={styles.insightCard}>
            <Ionicons
              name="wallet-outline"
              size={24}
              color={theme.colors.accent}
            />
            <Text style={styles.insightValue}>{recommendations.budget}</Text>
            <Text style={styles.insightLabel}>{t('destinationInsights.popularBudget')}</Text>
          </View>
        )}

        {/* Travel Style */}
        {recommendations.travelStyle && (
          <View style={styles.insightCard}>
            <Ionicons
              name="star-outline"
              size={24}
              color={theme.colors.warning}
            />
            <Text style={styles.insightValue}>{recommendations.travelStyle}</Text>
            <Text style={styles.insightLabel}>{t('destinationInsights.popularStyle')}</Text>
          </View>
        )}
      </View>

      {/* Best Months */}
      {recommendations.bestMonths && recommendations.bestMonths.length > 0 && (
        <View style={styles.monthsSection}>
          <View style={styles.monthsHeader}>
            <Ionicons
              name="sunny-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.monthsTitle}>{t('destinationInsights.popularSeason')}</Text>
          </View>
          <View style={styles.monthsContainer}>
            {recommendations.bestMonths.map((month) => (
              <View
                key={month}
                style={[
                  styles.monthBadge,
                  month === currentMonth && styles.currentMonthBadge,
                ]}
              >
                <Text
                  style={[
                    styles.monthText,
                    month === currentMonth && styles.currentMonthText,
                  ]}
                >
                  {analyticsService.getMonthAbbr(month)}
                </Text>
              </View>
            ))}
            {isBestMonth && (
              <View style={styles.seasonBadge}>
                <Text style={styles.seasonBadgeText}>{t('destinationInsights.bestNow')}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Top Activities */}
      {recommendations.topActivities && recommendations.topActivities.length > 0 && (
        <View style={styles.activitiesSection}>
          <View style={styles.activitiesHeader}>
            <Ionicons
              name="list-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.activitiesTitle}>
              {t('destinationInsights.topActivities', { count: Math.min(5, recommendations.topActivities.length) })}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activitiesScroll}
          >
            {recommendations.topActivities.slice(0, 5).map((activity, index) => (
              <View key={index} style={styles.activityChip}>
                <Text style={styles.activityText}>
                  {index + 1}. {activity}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color={theme.colors.textTertiary} />
        <Text style={styles.footerText}>
          {t('destinationInsights.footer')}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  insightCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  insightLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  monthsSection: {
    marginBottom: 16,
  },
  monthsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  monthsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  monthsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    borderWidth: 1,
    borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  currentMonthBadge: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  monthText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  currentMonthText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  seasonBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.success,
  },
  seasonBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  activitiesSection: {
    marginBottom: 12,
  },
  activitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  activitiesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    flex: 1,
  },
  activitiesScroll: {
    gap: 8,
  },
  activityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
    borderWidth: 1,
    borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  activityText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    flex: 1,
  },
});

export default DestinationInsights;
