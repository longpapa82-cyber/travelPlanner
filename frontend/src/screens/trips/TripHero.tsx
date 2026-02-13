/**
 * TripHero - Hero section with destination image, trip info, and action buttons
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Trip } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { formatDateShort, getTripProgress } from './tripDetailUtils';

interface TripHeroProps {
  trip: Trip;
  imageUrl: string;
  duration: number;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  isDuplicating: boolean;
  onGoBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExportIcal: () => void;
  onChangeCoverPhoto: () => void;
  onShare: () => void;
}

const TripHero: React.FC<TripHeroProps> = ({
  trip,
  imageUrl,
  duration,
  fadeAnim,
  slideAnim,
  isDuplicating,
  onGoBack,
  onEdit,
  onDuplicate,
  onExportIcal,
  onChangeCoverPhoto,
  onShare,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const styles = createStyles(theme, isDark);

  const progress = getTripProgress(trip.itineraries, trip.status);

  const getTripDayInfo = (): { currentDay: number; totalDays: number } | null => {
    if (trip.status !== 'ongoing') return null;
    const start = new Date(trip.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(trip.endDate);
    end.setHours(0, 0, 0, 0);
    const currentDay = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { currentDay: Math.max(1, Math.min(currentDay, totalDays)), totalDays };
  };

  const dayInfo = getTripDayInfo();

  return (
    <ImageBackground source={{ uri: imageUrl }} style={styles.hero} testID="detail-hero">
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
        style={styles.heroGradient}
      >
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onGoBack}
            accessibilityLabel={t('detail.accessibility.goBack')}
            accessibilityRole="button"
          >
            <View style={styles.iconButtonInner}>
              <Icon name="arrow-left" size={24} color={colors.neutral[0]} />
            </View>
          </TouchableOpacity>

          <View style={styles.rightButtons}>
            {trip.status !== 'completed' && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={onEdit}
                accessibilityLabel={t('detail.accessibility.editTrip')}
                accessibilityRole="button"
              >
                <View style={styles.iconButtonInner}>
                  <Icon name="pencil" size={24} color={colors.neutral[0]} />
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onDuplicate}
              disabled={isDuplicating}
              style={{ opacity: isDuplicating ? 0.5 : 1 }}
              accessibilityLabel={isDuplicating ? t('detail.accessibility.duplicating') : t('detail.accessibility.duplicate')}
              accessibilityRole="button"
            >
              <View style={styles.iconButtonInner}>
                {isDuplicating ? (
                  <ActivityIndicator size={24} color={colors.neutral[0]} />
                ) : (
                  <Icon name="content-copy" size={24} color={colors.neutral[0]} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onExportIcal}
              accessibilityLabel={t('detail.accessibility.exportIcal')}
              accessibilityRole="button"
            >
              <View style={styles.iconButtonInner}>
                <Icon name="calendar-export" size={24} color={colors.neutral[0]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onChangeCoverPhoto}
              accessibilityLabel={trip.coverImage ? t('detail.photos.changeCover') : t('detail.photos.addCover')}
              accessibilityRole="button"
            >
              <View style={styles.iconButtonInner}>
                <Icon name="camera" size={24} color={colors.neutral[0]} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareButton}
              onPress={onShare}
              accessibilityLabel={t('detail.accessibility.share')}
              accessibilityRole="button"
            >
              <View style={styles.iconButtonInner}>
                <Icon name="share-variant" size={24} color={colors.neutral[0]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View
          style={[
            styles.heroContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.heroTitle}>{trip.destination}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Icon name="calendar-range" size={16} color={colors.neutral[200]} />
              <Text style={styles.heroMetaText}>
                {formatDateShort(trip.startDate)} - {formatDateShort(trip.endDate)}
              </Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Icon name="calendar" size={16} color={colors.neutral[200]} />
              <Text style={styles.heroMetaText}>{t('detail.durationDays', { count: duration })}</Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Icon name="account-group" size={16} color={colors.neutral[200]} />
              <Text style={styles.heroMetaText}>{t('detail.travelers', { count: trip.numberOfTravelers || 1 })}</Text>
            </View>
          </View>

          {/* Trip Overall Progress */}
          {trip.status === 'ongoing' && progress.total > 0 && (
            <View style={styles.heroProgressContainer}>
              <View style={styles.heroProgressHeader}>
                {dayInfo && (
                  <View style={styles.heroDayBadge}>
                    <Text style={styles.heroDayBadgeText}>
                      Day {dayInfo.currentDay}/{dayInfo.totalDays}
                    </Text>
                  </View>
                )}
                <Icon name="chart-arc" size={14} color={colors.neutral[200]} />
                <Text style={styles.heroProgressText}>
                  {t('detail.progress', { percentage: progress.percentage })}
                </Text>
              </View>
              <View style={styles.heroProgressBarBackground}>
                <View
                  style={[
                    styles.heroProgressBarFill,
                    { width: `${progress.percentage}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </ImageBackground>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    hero: {
      width: '100%',
      height: 280,
    },
    heroGradient: {
      flex: 1,
      padding: 20,
      justifyContent: 'space-between',
    },
    headerButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    backButton: {
      alignSelf: 'flex-start',
    },
    rightButtons: {
      flexDirection: 'row',
      gap: 12,
      alignSelf: 'flex-end',
    },
    editButton: {
      alignSelf: 'flex-end',
    },
    shareButton: {
      alignSelf: 'flex-end',
    },
    iconButtonInner: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroContent: {
      paddingBottom: 20,
    },
    heroTitle: {
      fontSize: 36,
      fontWeight: '700',
      color: colors.neutral[0],
      marginBottom: 12,
    },
    heroMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    heroMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    heroMetaText: {
      fontSize: 14,
      color: colors.neutral[200],
      fontWeight: '500',
    },
    heroProgressContainer: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    heroProgressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    heroDayBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginRight: 4,
    },
    heroDayBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.neutral[0],
    },
    heroProgressText: {
      fontSize: 13,
      color: colors.neutral[200],
      fontWeight: '600',
    },
    heroProgressBarBackground: {
      height: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    heroProgressBarFill: {
      height: '100%',
      backgroundColor: colors.neutral[0],
      borderRadius: 2,
    },
  });

export default memo(TripHero);
