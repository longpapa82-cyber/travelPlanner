/**
 * SharedTripViewScreen
 *
 * Public read-only view for shared trips accessed via /share/:token.
 * No authentication required — fetches trip data from the public ShareController.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { RootStackParamList, Trip } from '../../types';
import apiService from '../../services/api';
import { getDestinationImageUrl } from '../../utils/images';
import { API_URL } from '../../constants/config';

type SharedTripViewRouteProp = RouteProp<RootStackParamList, 'SharedTrip'>;

interface Props {
  route: SharedTripViewRouteProp;
}

const SharedTripViewScreen: React.FC<Props> = ({ route }) => {
  const { shareToken } = route.params;
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSharedTrip = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getSharedTrip(shareToken);
      setTrip(data);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setError(t('sharedTrip.notFound', 'This shared trip is no longer available.'));
      } else if (status === 403) {
        setError(t('sharedTrip.expired', 'This share link has expired.'));
      } else {
        setError(t('sharedTrip.error', 'Failed to load shared trip.'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shareToken, t]);

  useEffect(() => {
    fetchSharedTrip();
  }, [fetchSharedTrip]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSharedTrip();
  }, [fetchSharedTrip]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Icon name="link-variant-off" size={64} color={theme.colors.textSecondary} />
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
          {error || t('sharedTrip.notFound', 'Trip not found')}
        </Text>
      </View>
    );
  }

  const coverUri = trip.coverImage
    ? (trip.coverImage.startsWith('http') ? trip.coverImage : `${API_URL.replace('/api', '')}${trip.coverImage}`)
    : getDestinationImageUrl(trip.destination);
  const totalDays = trip.itineraries?.length || 0;
  const totalActivities = trip.itineraries?.reduce(
    (sum, day) => sum + (day.activities?.length || 0),
    0,
  ) || 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={[styles.heroSection, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}>
        <View style={styles.sharedBadge}>
          <Icon name="share-variant" size={16} color={theme.colors.primary} />
          <Text style={[styles.sharedBadgeText, { color: theme.colors.primary }]}>
            {t('sharedTrip.badge', 'Shared Trip')}
          </Text>
        </View>
        <Text style={[styles.destination, { color: theme.colors.text }]}>
          {trip.destination}
        </Text>
        {trip.country && (
          <Text style={[styles.country, { color: theme.colors.textSecondary }]}>
            {trip.country}
          </Text>
        )}
        <View style={styles.dateRow}>
          <Icon name="calendar-range" size={18} color={theme.colors.textSecondary} />
          <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
            {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{totalDays}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {t('sharedTrip.days', 'Days')}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{totalActivities}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {t('sharedTrip.activities', 'Activities')}
            </Text>
          </View>
          {trip.numberOfTravelers && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{trip.numberOfTravelers}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                {t('sharedTrip.travelers', 'Travelers')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      {trip.description && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('sharedTrip.about', 'About this trip')}
          </Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {trip.description}
          </Text>
        </View>
      )}

      {/* Itinerary */}
      {trip.itineraries && trip.itineraries.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t('sharedTrip.itinerary', 'Itinerary')}
          </Text>
          {trip.itineraries
            .sort((a, b) => a.dayNumber - b.dayNumber)
            .map((day) => (
              <View
                key={day.id}
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayTitle, { color: theme.colors.text }]}>
                    {t('sharedTrip.day', 'Day')} {day.dayNumber}
                  </Text>
                  <Text style={[styles.dayDate, { color: theme.colors.textSecondary }]}>
                    {formatDate(day.date)}
                  </Text>
                </View>
                {day.activities && day.activities.length > 0 ? (
                  day.activities.map((activity, idx) => (
                    <View key={idx} style={styles.activityItem}>
                      <View style={[styles.activityDot, { backgroundColor: theme.colors.primary }]} />
                      <View style={styles.activityContent}>
                        <Text style={[styles.activityTime, { color: theme.colors.primary }]}>
                          {activity.time}
                        </Text>
                        <Text style={[styles.activityTitle, { color: theme.colors.text }]}>
                          {activity.title}
                        </Text>
                        {activity.location && (
                          <View style={styles.locationRow}>
                            <Icon name="map-marker-outline" size={14} color={theme.colors.textSecondary} />
                            <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                              {activity.location}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.noActivities, { color: theme.colors.textSecondary }]}>
                    {t('sharedTrip.noActivities', 'No activities planned')}
                  </Text>
                )}
              </View>
            ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
          {t('sharedTrip.footer', 'Shared via MyTravel')}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  heroSection: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 48 : 60,
    gap: 8,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sharedBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  destination: {
    fontSize: 28,
    fontWeight: '800',
  },
  country: {
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dateText: {
    fontSize: 15,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  dayCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  dayDate: {
    fontSize: 14,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 12,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activityTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 13,
  },
  noActivities: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
});

export default SharedTripViewScreen;
