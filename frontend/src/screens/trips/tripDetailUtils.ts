/**
 * Shared utility functions for TripDetailScreen sub-components
 */

import { colors } from '../../constants/theme';
import { Activity } from '../../types';

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

export const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export const getActivityIcon = (type: string) => {
  const iconMap: { [key: string]: string } = {
    // Korean keys (legacy data)
    식사: 'silverware-fork-knife',
    관광: 'camera',
    쇼핑: 'shopping',
    체험: 'ticket',
    휴식: 'coffee',
    이동: 'car',
    숙소: 'bed',
    // English keys (AI-generated data)
    food: 'silverware-fork-knife',
    sightseeing: 'camera',
    shopping: 'shopping',
    culture: 'ticket',
    entertainment: 'ticket',
    nature: 'tree',
    transportation: 'car',
    accommodation: 'bed',
  };
  return iconMap[type] || 'map-marker';
};

export const getActivityColor = (type: string, themePrimary: string) => {
  const colorMap: { [key: string]: string } = {
    // Korean keys (legacy data)
    식사: colors.warning.main,
    관광: colors.travel.ocean,
    쇼핑: colors.error.main,
    체험: colors.success.main,
    휴식: colors.travel.relax,
    이동: colors.neutral[500],
    숙소: colors.travel.night,
    // English keys (AI-generated data)
    food: colors.warning.main,
    sightseeing: colors.travel.ocean,
    shopping: colors.error.main,
    culture: colors.success.main,
    entertainment: colors.success.main,
    nature: colors.success.main,
    transportation: colors.neutral[500],
    accommodation: colors.travel.night,
  };
  return colorMap[type] || themePrimary;
};

/**
 * Map raw activity type keys (from AI or legacy data) to i18n keys
 * under trips:detail.activityTypes.*
 */
export const getActivityTypeI18nKey = (type: string): string => {
  const keyMap: { [key: string]: string } = {
    // English keys from AI
    food: 'meal',
    sightseeing: 'sightseeing',
    shopping: 'shopping',
    culture: 'experience',
    entertainment: 'experience',
    nature: 'sightseeing',
    transportation: 'transport',
    accommodation: 'accommodation',
    // Korean keys (legacy) → map to same i18n keys
    '식사': 'meal',
    '관광': 'sightseeing',
    '쇼핑': 'shopping',
    '체험': 'experience',
    '휴식': 'rest',
    '이동': 'transport',
    '숙소': 'accommodation',
  };
  return keyMap[type] || 'other';
};

export type ActivityStatus = 'completed' | 'ongoing' | 'upcoming';

export const getActivityStatus = (
  activity: Activity,
  itineraryDate: string,
  tripStatus?: string,
): ActivityStatus => {
  if (!tripStatus) return 'upcoming';

  if (activity.completed === true) {
    return 'completed';
  }

  const now = new Date();
  const activityDateTime = new Date(`${itineraryDate.split('T')[0]}T${activity.time}`);

  if (activityDateTime <= now) {
    const estimatedDuration = activity.estimatedDuration || 120;
    const activityEndTime = new Date(activityDateTime.getTime() + estimatedDuration * 60 * 1000);

    if (now <= activityEndTime) {
      return 'ongoing';
    }

    return 'completed';
  }

  return 'upcoming';
};

export const getItineraryProgress = (
  activities: Activity[],
  itineraryDate: string,
  tripStatus?: string,
): { completed: number; total: number; percentage: number } => {
  let completedCount = 0;
  const totalCount = activities.length;

  activities.forEach((activity) => {
    const status = getActivityStatus(activity, itineraryDate, tripStatus);
    if (status === 'completed') {
      completedCount++;
    }
  });

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completed: completedCount, total: totalCount, percentage };
};

export const getTripProgress = (
  itineraries: { activities: Activity[]; date: string }[],
  tripStatus?: string,
): { completed: number; total: number; percentage: number } => {
  let completedCount = 0;
  let totalCount = 0;

  itineraries.forEach((itinerary) => {
    itinerary.activities.forEach((activity) => {
      totalCount++;
      const status = getActivityStatus(activity, itinerary.date, tripStatus);
      if (status === 'completed') {
        completedCount++;
      }
    });
  });

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completed: completedCount, total: totalCount, percentage };
};
