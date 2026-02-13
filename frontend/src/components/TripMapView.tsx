import React, { memo, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import { Activity, Itinerary } from '../types';

interface GeoActivity extends Activity {
  dayNumber: number;
  itineraryDate: string;
}

interface Props {
  itineraries: Itinerary[];
  destination: string;
}

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  // English keys
  sightseeing: colors.primary[500],
  food: colors.secondary[500],
  shopping: '#8B5CF6',
  transportation: colors.neutral[500],
  accommodation: '#059669',
  culture: '#DC2626',
  entertainment: '#D97706',
  nature: '#16A34A',
  meal: colors.secondary[500],
  experience: '#7C3AED',
  rest: '#06B6D4',
  transport: colors.neutral[500],
  other: colors.neutral[400],
  // Korean keys (backend data values)
  관광: colors.primary[500],
  식사: colors.secondary[500],
  쇼핑: '#8B5CF6',
  이동: colors.neutral[500],
  숙소: '#059669',
  체험: '#7C3AED',
  휴식: '#06B6D4',
};

// Google Static Maps API only accepts single-character labels (0-9, A-Z)
const getMarkerLabel = (index: number): string => {
  if (index < 10) return String(index);
  // 10 → A, 11 → B, ...
  return String.fromCharCode(65 + (index - 10));
};

// Calculate zoom level from bounding box to fit all markers
const calculateZoom = (
  activities: { latitude?: number; longitude?: number }[],
): number => {
  if (activities.length <= 1) return 15;

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const a of activities) {
    if (!a.latitude || !a.longitude) continue;
    minLat = Math.min(minLat, a.latitude);
    maxLat = Math.max(maxLat, a.latitude);
    minLng = Math.min(minLng, a.longitude);
    maxLng = Math.max(maxLng, a.longitude);
  }

  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  const maxDiff = Math.max(latDiff, lngDiff);

  // Approximate zoom from coordinate span (with padding)
  if (maxDiff < 0.005) return 16;
  if (maxDiff < 0.01) return 15;
  if (maxDiff < 0.03) return 14;
  if (maxDiff < 0.06) return 13;
  if (maxDiff < 0.12) return 12;
  if (maxDiff < 0.25) return 11;
  if (maxDiff < 0.5) return 10;
  return 9;
};

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  // English keys
  sightseeing: 'camera',
  food: 'silverware-fork-knife',
  shopping: 'shopping',
  transportation: 'car',
  accommodation: 'bed',
  culture: 'theater',
  entertainment: 'party-popper',
  nature: 'tree',
  meal: 'silverware-fork-knife',
  experience: 'star',
  rest: 'coffee',
  transport: 'car',
  other: 'map-marker',
  // Korean keys (backend data values)
  관광: 'camera',
  식사: 'silverware-fork-knife',
  쇼핑: 'shopping',
  이동: 'car',
  숙소: 'bed',
  체험: 'ticket',
  휴식: 'coffee',
};

export const TripMapView: React.FC<Props> = memo(({ itineraries, destination }) => {
  const { t } = useTranslation('trips');
  const { theme, isDark } = useTheme();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [mapLoadError, setMapLoadError] = useState(false);

  const geoActivities = useMemo(() => {
    const activities: GeoActivity[] = [];
    for (const itinerary of itineraries) {
      for (const activity of itinerary.activities) {
        if (activity.latitude && activity.longitude && activity.latitude !== 0) {
          activities.push({
            ...activity,
            dayNumber: itinerary.dayNumber,
            itineraryDate: itinerary.date,
          });
        }
      }
    }
    return activities;
  }, [itineraries]);

  const filteredActivities = useMemo(() => {
    if (selectedDay === null) return geoActivities;
    return geoActivities.filter((a) => a.dayNumber === selectedDay);
  }, [geoActivities, selectedDay]);

  const center = useMemo(() => {
    if (filteredActivities.length === 0) return null;
    const sumLat = filteredActivities.reduce((s, a) => s + (a.latitude || 0), 0);
    const sumLng = filteredActivities.reduce((s, a) => s + (a.longitude || 0), 0);
    return {
      lat: sumLat / filteredActivities.length,
      lng: sumLng / filteredActivities.length,
    };
  }, [filteredActivities]);

  const mapUrl = useMemo(() => {
    if (!center || filteredActivities.length === 0) return null;

    const markers = filteredActivities
      .map((a, i) => {
        const color = ACTIVITY_TYPE_COLORS[a.type || 'other'] || '0x3B82F6';
        const hexColor = color.replace('#', '0x');
        const label = getMarkerLabel(i + 1);
        return `markers=color:${hexColor}%7Clabel:${label}%7Csize:mid%7C${a.latitude},${a.longitude}`;
      })
      .join('&');

    const zoom = calculateZoom(filteredActivities);
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';
    if (!apiKey) return null;
    const size = Platform.OS === 'web' ? '640x400' : '640x300';

    // Hide Google POI markers to make custom markers more visible
    const hidePoiStyle = 'style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off';

    return `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&${hidePoiStyle}&${markers}&key=${apiKey}`;
  }, [center, filteredActivities]);

  const openInGoogleMaps = () => {
    if (!center) return;
    const url = `https://www.google.com/maps/@${center.lat},${center.lng},14z`;
    Linking.openURL(url);
  };

  const dayNumbers = useMemo(() => {
    const days = new Set<number>();
    for (const a of geoActivities) {
      days.add(a.dayNumber);
    }
    return Array.from(days).sort((a, b) => a - b);
  }, [geoActivities]);

  if (geoActivities.length === 0) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
        <Icon name="map-marker-off" size={48} color={colors.neutral[400]} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
          {t('detail.map.noLocations')}
        </Text>
        <Text style={[styles.emptyMessage, isDark && styles.textMuted]}>
          {t('detail.map.noLocationsMessage')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Day filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayFilterContainer}
      >
        <TouchableOpacity
          style={[
            styles.dayPill,
            selectedDay === null && styles.dayPillActive,
            isDark && styles.dayPillDark,
          ]}
          onPress={() => setSelectedDay(null)}
        >
          <Text
            style={[
              styles.dayPillText,
              selectedDay === null && styles.dayPillTextActive,
              isDark && selectedDay !== null && styles.textMuted,
            ]}
          >
            {t('detail.map.allDays')}
          </Text>
        </TouchableOpacity>
        {dayNumbers.map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayPill,
              selectedDay === day && styles.dayPillActive,
              isDark && styles.dayPillDark,
            ]}
            onPress={() => setSelectedDay(selectedDay === day ? null : day)}
          >
            <Text
              style={[
                styles.dayPillText,
                selectedDay === day && styles.dayPillTextActive,
                isDark && selectedDay !== day && styles.textMuted,
              ]}
            >
              {t('detail.map.dayLabel', { day })}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map */}
      <TouchableOpacity
        style={[styles.mapContainer, isDark && styles.mapContainerDark]}
        onPress={openInGoogleMaps}
        activeOpacity={0.9}
      >
        {mapUrl && !mapLoadError ? (
          Platform.OS === 'web' ? (
            <Image
              source={{ uri: mapUrl }}
              style={{ width: '100%' as any, height: 300, borderRadius: 16 }}
              resizeMode="cover"
              onError={() => setMapLoadError(true)}
            />
          ) : (
            <Image
              source={{ uri: mapUrl }}
              style={{ width: '100%', height: 200, borderRadius: 16 }}
              resizeMode="cover"
              onError={() => setMapLoadError(true)}
            />
          )
        ) : (
          <View style={styles.mapPlaceholder}>
            <Icon name="google-maps" size={40} color={colors.primary[500]} />
            <Text style={[styles.mapPlaceholderText, isDark && styles.textDark]}>
              {t('detail.map.openInMaps')}
            </Text>
            <Text style={[styles.mapPlaceholderSub, isDark && styles.textMuted]}>
              {t('detail.map.tapToOpen')}
            </Text>
          </View>
        )}
        <View style={styles.mapOverlay}>
          <View style={styles.mapBadge}>
            <Icon name="open-in-new" size={14} color="#fff" />
            <Text style={styles.mapBadgeText}>Google Maps</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Activity list with location info */}
      <View style={styles.activityListHeader}>
        <Icon name="map-marker-multiple" size={18} color={colors.primary[500]} />
        <Text style={[styles.activityListTitle, isDark && styles.textDark]}>
          {t('detail.map.activitiesCount', { count: filteredActivities.length })}
        </Text>
      </View>

      {filteredActivities.map((activity, index) => {
        const typeColor = ACTIVITY_TYPE_COLORS[activity.type || 'other'] || colors.primary[500];
        const typeIcon = ACTIVITY_TYPE_ICONS[activity.type || 'other'] || 'map-marker';

        return (
          <TouchableOpacity
            key={`${activity.dayNumber}-${index}`}
            style={[styles.activityCard, isDark && styles.activityCardDark]}
            onPress={() => {
              if (activity.latitude && activity.longitude) {
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`
                );
              }
            }}
          >
            <View style={[styles.activityIndex, { backgroundColor: typeColor }]}>
              <Text style={styles.activityIndexText}>{getMarkerLabel(index + 1)}</Text>
            </View>
            <View style={styles.activityInfo}>
              <View style={styles.activityRow}>
                <Text style={[styles.activityTitle, isDark && styles.textDark]} numberOfLines={1}>
                  {activity.title}
                </Text>
                <View style={[styles.dayBadge, { backgroundColor: `${typeColor}20` }]}>
                  <Text style={[styles.dayBadgeText, { color: typeColor }]}>
                    {t('detail.map.dayLabel', { day: activity.dayNumber })}
                  </Text>
                </View>
              </View>
              <View style={styles.activityMeta}>
                <Icon name={typeIcon as any} size={14} color={typeColor} />
                <Text style={[styles.activityLocation, isDark && styles.textMuted]} numberOfLines={1}>
                  {activity.location}
                </Text>
              </View>
              <Text style={[styles.activityTime, isDark && styles.textMuted]}>
                {activity.time} · {t('detail.map.durationMin', { min: activity.estimatedDuration })}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.neutral[400]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 12,
  },
  emptyContainerDark: {
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[700],
    marginTop: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  dayFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  dayPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.neutral[100],
  },
  dayPillDark: {
    backgroundColor: colors.neutral[800],
  },
  dayPillActive: {
    backgroundColor: colors.primary[500],
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  dayPillTextActive: {
    color: '#fff',
  },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: colors.neutral[100],
    position: 'relative' as const,
  },
  mapContainerDark: {
    backgroundColor: colors.neutral[800],
  },
  mapPlaceholder: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapPlaceholderText: {
    fontSize: 15,
    color: colors.primary[500],
    fontWeight: '600',
  },
  mapPlaceholderSub: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  mapOverlay: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  mapBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  activityListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  activityListTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  activityCardDark: {
    backgroundColor: colors.neutral[800],
  },
  activityIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityIndexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    flex: 1,
    marginRight: 8,
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityLocation: {
    fontSize: 12,
    color: colors.neutral[500],
    flex: 1,
  },
  activityTime: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  textDark: {
    color: colors.neutral[100],
  },
  textMuted: {
    color: colors.neutral[400],
  },
});
