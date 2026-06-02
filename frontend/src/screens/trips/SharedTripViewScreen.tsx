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
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
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
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation('trips');
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
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
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Cold-start: stack has only SharedTrip. Reset to the correct root screen
      // depending on auth state — 'Main' only exists when authenticated.
      const rootScreen = isAuthenticated ? 'Main' : 'Auth';
      navigation.reset({ index: 0, routes: [{ name: rootScreen }] });
    }
  };

  const CustomHeader = () => (
    <View style={[styles.headerSafeArea, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={[styles.customHeader, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.fullContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CustomHeader />
        <View style={styles.centerContainer}>
          <Icon name="link-variant-off" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
            {error || t('sharedTrip.notFound', 'Trip not found')}
          </Text>
        </View>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <CustomHeader />
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <LinearGradient
        colors={['#1a3a5c', '#2d6aaf']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.sharedBadge}>
          <Icon name="share-variant" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.sharedBadgeText}>
            {t('sharedTrip.badge', '공유된 여행')}
          </Text>
        </View>
        <Text style={styles.destination}>
          {trip.destination}
        </Text>
        {trip.country && (
          <Text style={styles.country}>
            {trip.country}
          </Text>
        )}
        <View style={styles.dateRow}>
          <Icon name="calendar-range" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.dateText}>
            {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalDays}</Text>
            <Text style={styles.statLabel}>
              {t('sharedTrip.days', '일')}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalActivities}</Text>
            <Text style={styles.statLabel}>
              {t('sharedTrip.activities', '활동')}
            </Text>
          </View>
          {trip.numberOfTravelers && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{trip.numberOfTravelers}</Text>
              <Text style={styles.statLabel}>
                {t('sharedTrip.travelers', '여행자')}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSafeArea: {
    zIndex: 10,
    // paddingTop is set dynamically via insets.top
  },
  customHeader: {
    height: 48,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
  },
  fullContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 24,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  sharedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  destination: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
  },
  country: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
    color: 'rgba(255,255,255,0.75)',
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
