/**
 * ItineraryDayCard - Per-day itinerary card with weather, progress, and activities
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useTranslation } from 'react-i18next';
import { Activity, Itinerary } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { WeatherWidget } from '../../components/WeatherWidget';
import { ProgressIndicator } from '../../components/ProgressIndicator';
import { formatDate, getItineraryProgress } from './tripDetailUtils';
import ActivityItem from './ActivityItem';

interface ItineraryDayCardProps {
  itinerary: Itinerary;
  dayIndex: number;
  tripStatus: string;
  fadeAnim: Animated.Value;
  canAddActivity: boolean;
  onAddActivity: (itineraryId: string) => void;
  onEditActivity: (itineraryId: string, activityIndex: number, activity: Activity) => void;
  onDeleteActivity: (itineraryId: string, activityIndex: number) => void;
  onToggleCompletion: (itineraryId: string, activityIndex: number, activity: Activity) => void;
  onReorderActivities: (itineraryId: string, newOrder: number[]) => void;
}

const ItineraryDayCard: React.FC<ItineraryDayCardProps> = ({
  itinerary,
  dayIndex,
  tripStatus,
  fadeAnim,
  canAddActivity,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onToggleCompletion,
  onReorderActivities,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const styles = createStyles(theme, isDark);

  const progress = getItineraryProgress(itinerary.activities, itinerary.date, tripStatus);

  return (
    <Animated.View
      style={[
        styles.daySection,
        { opacity: fadeAnim },
      ]}
    >
      {/* Day Header */}
      <View style={styles.dayHeader}>
        <View
          style={[
            styles.dayBadge,
            { backgroundColor: isDark ? colors.primary[700] : colors.primary[50] },
          ]}
        >
          <Text style={[styles.dayNumber, { color: theme.colors.primary }]}>
            {t('detail.dayLabel', { day: itinerary.dayNumber })}
          </Text>
        </View>
        <Text style={[styles.dayDate, { color: theme.colors.textSecondary }]}>
          {formatDate(itinerary.date)}
        </Text>
      </View>

      {/* Weather & Timezone Info */}
      {(itinerary.weather || itinerary.timezone || itinerary.timezoneOffset !== null) && (
        <View style={styles.weatherCardContainer}>
          <WeatherWidget
            weather={itinerary.weather}
            timezone={itinerary.timezone}
            timezoneOffset={itinerary.timezoneOffset}
            date={itinerary.date}
          />
        </View>
      )}

      {/* Day Progress */}
      {itinerary.activities.length > 0 && (
        <View style={styles.dayProgressContainer}>
          <ProgressIndicator
            completed={progress.completed}
            total={progress.total}
            variant="full"
          />
        </View>
      )}

      {/* Activities with Timeline - Draggable */}
      <View style={styles.activitiesContainer}>
        <DraggableFlatList
          data={itinerary.activities}
          renderItem={(params) => (
            <ActivityItem
              params={params}
              itineraryId={itinerary.id}
              itineraryDate={itinerary.date}
              isLast={params.getIndex() === itinerary.activities.length - 1}
              tripStatus={tripStatus}
              timezone={itinerary.timezone}
              activityIndex={itinerary.activities.indexOf(params.item)}
              onToggleCompletion={onToggleCompletion}
              onEdit={onEditActivity}
              onDelete={onDeleteActivity}
            />
          )}
          keyExtractor={(item, index) => `activity-${itinerary.id}-${index}`}
          onDragEnd={({ data }) => {
            const newOrder = data.map((activity) => itinerary.activities.indexOf(activity));
            onReorderActivities(itinerary.id, newOrder);
          }}
          scrollEnabled={false}
          maxToRenderPerBatch={5}
          initialNumToRender={5}
        />
      </View>

      {/* Add Activity Button */}
      {canAddActivity && (
        <TouchableOpacity
          style={[
            styles.addActivityButton,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
              borderColor: theme.colors.primary,
            },
          ]}
          onPress={() => onAddActivity(itinerary.id)}
          accessibilityLabel={t('detail.accessibility.addActivityToDay', { day: itinerary.dayNumber })}
          accessibilityRole="button"
        >
          <Icon name="plus-circle" size={20} color={theme.colors.primary} />
          <Text style={[styles.addActivityText, { color: theme.colors.primary }]}>
            {t('detail.addActivity')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Notes */}
      {itinerary.notes && (
        <View
          style={[
            styles.notesCard,
            {
              backgroundColor: isDark
                ? `${theme.colors.primary}20`
                : `${theme.colors.primary}10`,
            },
          ]}
        >
          <Icon name="note-text-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.notesText, { color: theme.colors.text }]}>{itinerary.notes}</Text>
        </View>
      )}
    </Animated.View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    daySection: {
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    dayBadge: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    dayNumber: {
      fontSize: 18,
      fontWeight: '700',
    },
    dayDate: {
      fontSize: 14,
      fontWeight: '500',
    },
    weatherCardContainer: {
      marginBottom: 20,
    },
    dayProgressContainer: {
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    activitiesContainer: {
      marginBottom: 16,
    },
    addActivityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderStyle: 'dashed',
      marginTop: 8,
      marginBottom: 16,
      ...theme.shadows.sm,
    },
    addActivityText: {
      fontSize: 16,
      fontWeight: '600',
    },
    notesCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 16,
      marginTop: 8,
    },
    notesText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
  });

export default memo(ItineraryDayCard);
