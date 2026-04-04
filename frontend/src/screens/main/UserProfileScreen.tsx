import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { FeedTrip, PublicUserProfile, ProfileStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { trackEvent } from '../../services/eventTracker';
import { APP_URL } from '../../constants/config';
import { ensureAbsoluteUrl } from '../../utils/images';

type Props = NativeStackScreenProps<ProfileStackParamList, 'UserProfile'>;

const UserProfileScreen = ({ route }: Props) => {
  const { userId } = route.params;
  const { t } = useTranslation('social');
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await apiService.getUserPublicProfile(userId);
      setProfile(data);
    } catch {
      showToast({ type: 'error', message: t('errors.profileFailed'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  }, [userId, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchProfile();
      trackEvent('profile_viewed', { userId });
    }, [fetchProfile, userId]),
  );

  const handleFollowToggle = async () => {
    if (!profile || isFollowLoading) return;
    setIsFollowLoading(true);

    const wasFollowing = profile.isFollowing;
    // Optimistic
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: !wasFollowing,
            followersCount: wasFollowing
              ? prev.followersCount - 1
              : prev.followersCount + 1,
          }
        : prev,
    );

    try {
      if (wasFollowing) {
        await apiService.unfollowUser(userId);
        trackEvent('user_unfollowed', { userId });
      } else {
        await apiService.followUser(userId);
        trackEvent('user_followed', { userId });
      }
    } catch {
      // Revert
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: wasFollowing,
              followersCount: wasFollowing
                ? prev.followersCount + 1
                : prev.followersCount - 1,
            }
          : prev,
      );
      showToast({
        type: 'error',
        message: wasFollowing ? t('errors.unfollowFailed') : t('errors.followFailed'),
        position: 'top',
      });
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleLikeToggle = async (trip: FeedTrip) => {
    if (!profile) return;
    const wasLiked = trip.isLiked;

    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        publicTrips: prev.publicTrips.map((item) =>
          item.id === trip.id
            ? {
                ...item,
                isLiked: !wasLiked,
                likesCount: wasLiked ? item.likesCount - 1 : item.likesCount + 1,
              }
            : item,
        ),
      };
    });

    try {
      if (wasLiked) {
        await apiService.unlikeTrip(trip.id);
      } else {
        await apiService.likeTrip(trip.id);
      }
    } catch {
      // Revert
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          publicTrips: prev.publicTrips.map((item) =>
            item.id === trip.id
              ? {
                  ...item,
                  isLiked: wasLiked,
                  likesCount: wasLiked ? item.likesCount + 1 : item.likesCount - 1,
                }
              : item,
          ),
        };
      });
    }
  };

  const handleShareTrip = async (trip: FeedTrip) => {
    try {
      await Share.share({
        message: `${trip.destination}${trip.country ? `, ${trip.country}` : ''}\n${t('tripBy', { name: profile?.name || '' })}\n\n${APP_URL}`,
      });
      trackEvent('trip_shared', { tripId: trip.id, source: 'user_profile' });
    } catch {
      // User cancelled share
    }
  };

  const formatDateRange = (start: string, end: string): string => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
  };

  const styles = createStyles(theme, isDark);
  const isSelf = currentUser?.id === userId;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Icon name="account-off-outline" size={60} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          {t('errors.profileFailed')}
        </Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      {profile.profileImage ? (
        <Image source={{ uri: ensureAbsoluteUrl(profile.profileImage) }} style={styles.profileImage} />
      ) : (
        <View style={[styles.profileImage, styles.profilePlaceholder]}>
          <Icon name="account" size={48} color={colors.neutral[400]} />
        </View>
      )}

      <Text style={[styles.profileName, { color: theme.colors.text }]}>{profile.name}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.colors.text }]}>
            {profile.followersCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            {t('profile.followers')}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.colors.text }]}>
            {profile.followingCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            {t('profile.following')}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.colors.text }]}>
            {profile.publicTripsTotal}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            {t('profile.publicTrips')}
          </Text>
        </View>
      </View>

      {!isSelf && (
        <TouchableOpacity
          style={[
            styles.followButton,
            profile.isFollowing
              ? styles.followingButton
              : { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleFollowToggle}
          disabled={isFollowLoading}
        >
          {isFollowLoading ? (
            <ActivityIndicator size="small" color={profile.isFollowing ? theme.colors.text : colors.neutral[0]} />
          ) : (
            <Text
              style={[
                styles.followButtonText,
                { color: profile.isFollowing ? theme.colors.text : colors.neutral[0] },
              ]}
            >
              {profile.isFollowing ? t('profile.unfollow') : t('profile.follow')}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {profile.publicTrips.length > 0 && (
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {t('profile.publicTrips')}
        </Text>
      )}
    </View>
  );

  const renderTripCard = ({ item }: { item: FeedTrip }) => (
    <View style={styles.tripCard}>
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.tripCover} />
      ) : (
        <View style={[styles.tripCover, styles.tripCoverPlaceholder]}>
          <Icon name="image-off-outline" size={30} color={theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.tripInfo}>
        <Text style={[styles.tripDestination, { color: theme.colors.text }]} numberOfLines={1}>
          {item.destination}
          {item.country ? `, ${item.country}` : ''}
        </Text>
        <Text style={[styles.tripDate, { color: theme.colors.textSecondary }]}>
          {formatDateRange(item.startDate, item.endDate)}
        </Text>
        <View style={styles.tripActions}>
          <TouchableOpacity
            style={styles.likeRow}
            onPress={() => handleLikeToggle(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common:like')}
            accessibilityRole="button"
          >
            <Icon
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.isLiked ? colors.error.main : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.likeCount,
                { color: item.isLiked ? colors.error.main : theme.colors.textSecondary },
              ]}
            >
              {item.likesCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleShareTrip(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common:share')}
            accessibilityRole="button"
          >
            <Icon
              name="share-variant"
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={profile.publicTrips}
      renderItem={renderTripCard}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyTrips}>
          <Icon name="bag-suitcase-off-outline" size={40} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {t('profile.noPublicTrips')}
          </Text>
        </View>
      }
    />
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      paddingTop: 24,
      paddingHorizontal: 16,
      gap: 12,
    },
    profileImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
    },
    profilePlaceholder: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.neutral[200],
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileName: {
      fontSize: 22,
      fontWeight: '700',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingVertical: 8,
    },
    stat: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 18,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 13,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.neutral[200],
    },
    followButton: {
      paddingHorizontal: 32,
      paddingVertical: 10,
      borderRadius: 20,
      minWidth: 120,
      alignItems: 'center',
    },
    followingButton: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : colors.neutral[200],
    },
    followButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      alignSelf: 'flex-start',
      marginTop: 20,
      marginBottom: 4,
    },
    tripCard: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[0],
      ...(!isDark && {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }),
      ...(isDark && {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }),
    },
    tripCover: {
      width: 100,
      height: 90,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.neutral[100],
    },
    tripCoverPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripInfo: {
      flex: 1,
      padding: 10,
      justifyContent: 'center',
      gap: 4,
    },
    tripDestination: {
      fontSize: 15,
      fontWeight: '600',
    },
    tripDate: {
      fontSize: 13,
    },
    tripActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    likeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    likeCount: {
      fontSize: 13,
      fontWeight: '500',
    },
    emptyTrips: {
      alignItems: 'center',
      paddingVertical: 40,
      gap: 12,
    },
    emptyText: {
      fontSize: 15,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 12,
    },
  });

export default UserProfileScreen;
