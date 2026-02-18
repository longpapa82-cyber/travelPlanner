/**
 * ActivityItem - Individual activity card within an itinerary day
 *
 * Renders a draggable activity with timeline dot, status indicators,
 * edit/delete actions, and completion toggle.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { useTranslation } from 'react-i18next';
import { Activity } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import {
  getActivityIcon,
  getActivityColor,
  getActivityStatus,
  ActivityStatus,
} from './tripDetailUtils';

interface ActivityItemProps {
  params: RenderItemParams<Activity>;
  itineraryId: string;
  itineraryDate: string;
  isLast: boolean;
  tripStatus: string;
  timezone?: string | null;
  activityIndex: number;
  onToggleCompletion: (itineraryId: string, activityIndex: number, activity: Activity) => void;
  onEdit: (itineraryId: string, activityIndex: number, activity: Activity) => void;
  onDelete: (itineraryId: string, activityIndex: number) => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  params,
  itineraryId,
  itineraryDate,
  isLast,
  tripStatus,
  timezone,
  activityIndex,
  onToggleCompletion,
  onEdit,
  onDelete,
}) => {
  const { item: activity, drag, isActive } = params;
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');

  const activityColor = getActivityColor(activity.type, theme.colors.primary);
  const activityStatus: ActivityStatus = getActivityStatus(activity, itineraryDate, tripStatus);

  const now = new Date();
  const activityDateTime = new Date(`${itineraryDate.split('T')[0]}T${activity.time}`);
  const isActivityInPast = activityDateTime < now;
  const isOngoingTrip = tripStatus === 'ongoing';
  const isCompletedTrip = tripStatus === 'completed';
  const canModify = !isCompletedTrip && !(isOngoingTrip && isActivityInPast);

  const styles = createStyles(theme, isDark);

  const cardContent = (
      <View style={styles.activityWrapper}>
        {/* Timeline Dot - Clickable Checkbox */}
        <View style={styles.timelineContainer}>
          <TouchableOpacity
            onPress={() => onToggleCompletion(itineraryId, activityIndex, activity)}
            activeOpacity={0.7}
            disabled={isCompletedTrip}
            accessibilityLabel={`${activity.title} ${activityStatus === 'completed' ? t('detail.accessibility.completed') : t('detail.accessibility.incomplete')}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: activityStatus === 'completed' }}
            style={[
              styles.timelineDot,
              {
                backgroundColor:
                  activityStatus === 'completed'
                    ? colors.success.main
                    : activityStatus === 'ongoing'
                    ? colors.warning.main
                    : activityColor,
              },
            ]}
          >
            <Icon
              name={
                activityStatus === 'completed'
                  ? 'check'
                  : activityStatus === 'ongoing'
                  ? 'clock-fast'
                  : (getActivityIcon(activity.type) as any)
              }
              size={16}
              color={colors.neutral[0]}
            />
          </TouchableOpacity>
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />}
        </View>

        {/* Activity Card */}
        <View
          testID="activity-card"
          style={[
            styles.activityCard,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
              opacity: isActive ? 0.8 : activityStatus === 'completed' ? 0.6 : 1,
              borderLeftWidth: activityStatus === 'ongoing' ? 4 : 0,
              borderLeftColor: activityStatus === 'ongoing' ? colors.success.main : 'transparent',
            },
          ]}
        >
          <View style={styles.activityHeader}>
            {/* Drag Handle */}
            <TouchableOpacity
              onLongPress={drag}
              style={styles.dragHandle}
              disabled={isActive || !canModify}
              accessibilityLabel={t('detail.accessibility.reorder')}
              accessibilityHint={t('detail.accessibility.reorderHint')}
            >
              <Icon
                name="drag"
                size={20}
                color={canModify ? theme.colors.textSecondary : theme.colors.border}
              />
            </TouchableOpacity>

            <View style={styles.activityTimeSection}>
              <Icon name="clock-outline" size={18} color={activityColor} />
              <Text style={[styles.activityTime, { color: activityColor }]}>{activity.time}</Text>
            </View>

            <View style={styles.activityHeaderRight}>
              <View style={[styles.activityTypeBadge, { backgroundColor: `${activityColor}20` }]}>
                <Text numberOfLines={1} style={[styles.activityTypeText, { color: activityColor }]}>{activity.type}</Text>
              </View>
              {canModify && (
                <View style={styles.activityActions}>
                  <TouchableOpacity
                    style={styles.activityActionButton}
                    onPress={() => onEdit(itineraryId, activityIndex, activity)}
                    accessibilityLabel={`${activity.title} ${t('detail.accessibility.edit')}`}
                    accessibilityRole="button"
                  >
                    <Icon name="pencil" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.activityActionButton}
                    onPress={() => onDelete(itineraryId, activityIndex)}
                    accessibilityLabel={`${activity.title} ${t('detail.accessibility.delete')}`}
                    accessibilityRole="button"
                  >
                    <Icon name="delete" size={16} color={colors.error.main} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.activityTitleRow}>
            <Text
              style={[
                styles.activityTitle,
                {
                  color: activityStatus === 'completed' ? theme.colors.textSecondary : theme.colors.text,
                  textDecorationLine: activityStatus === 'completed' ? 'line-through' : 'none',
                  textDecorationStyle: 'solid',
                },
              ]}
            >
              {activity.title}
            </Text>
            {activityStatus === 'ongoing' && (
              <View style={[styles.statusBadge, { backgroundColor: colors.success.light }]}>
                <Icon name="clock-fast" size={12} color={colors.success.main} />
                <Text style={[styles.statusBadgeText, { color: colors.success.main }]}>{t('detail.status.ongoing')}</Text>
              </View>
            )}
            {activityStatus === 'completed' && (
              <View style={[styles.statusBadge, { backgroundColor: colors.neutral[200] }]}>
                <Icon name="check" size={12} color={colors.neutral[600]} />
                <Text style={[styles.statusBadgeText, { color: colors.neutral[600] }]}>{t('detail.status.completed')}</Text>
              </View>
            )}
          </View>

          <View style={styles.activityLocation}>
            <Icon name="map-marker" size={16} color={theme.colors.textSecondary} />
            <Text
              style={[
                styles.activityLocationText,
                {
                  color: theme.colors.textSecondary,
                  textDecorationLine: activityStatus === 'completed' ? 'line-through' : 'none',
                },
              ]}
            >
              {activity.location}
            </Text>
          </View>

          {activity.description && (
            <Text
              style={[
                styles.activityDescription,
                {
                  color: activityStatus === 'completed' ? theme.colors.textSecondary : theme.colors.text,
                  textDecorationLine: activityStatus === 'completed' ? 'line-through' : 'none',
                },
              ]}
            >
              {activity.description}
            </Text>
          )}

          {/* Read-only message for completed activities */}
          {!canModify && activityStatus === 'completed' && (
            <View style={[styles.readOnlyMessage, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
              <Icon name="lock" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.readOnlyMessageText, { color: theme.colors.textSecondary }]}>
                {t('detail.readOnlyMessage')}
              </Text>
            </View>
          )}

          <View style={styles.activityFooter}>
            <View style={styles.activityMeta}>
              <Icon name="timer-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.activityMetaText, { color: theme.colors.textSecondary }]}>
                {t('detail.durationMinutes', { minutes: activity.estimatedDuration })}
              </Text>
            </View>
            {activity.estimatedCost > 0 && (
              <View style={styles.activityMeta}>
                <Icon name="currency-usd" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.activityMetaText, { color: theme.colors.textSecondary }]}>
                  {t('detail.estimatedCost', { cost: activity.estimatedCost.toLocaleString() })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
  );

  // On web, ScaleDecorator requires DraggableFlatList context which is absent
  if (Platform.OS === 'web') {
    return cardContent;
  }

  return <ScaleDecorator>{cardContent}</ScaleDecorator>;
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    activityWrapper: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    timelineContainer: {
      alignItems: 'center',
      marginRight: 16,
      width: 32,
    },
    timelineDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    timelineLine: {
      position: 'absolute',
      top: 32,
      width: 2,
      height: '100%',
    },
    activityCard: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      ...theme.shadows.sm,
    },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    dragHandle: {
      padding: 4,
    },
    activityTimeSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    activityTime: {
      fontSize: 16,
      fontWeight: '700',
    },
    activityHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    activityTypeBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    activityTypeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    activityActions: {
      flexDirection: 'row',
      gap: 4,
    },
    activityActionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100],
    },
    activityTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    activityTitle: {
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    activityLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    activityLocationText: {
      fontSize: 14,
    },
    activityDescription: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    readOnlyMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 8,
    },
    readOnlyMessageText: {
      fontSize: 12,
      fontWeight: '500',
    },
    activityFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    activityMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    activityMetaText: {
      fontSize: 12,
      fontWeight: '500',
    },
  });

export default memo(ActivityItem);
