import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { FeedTrip, ProfileStackParamList } from '../../types';
import apiService from '../../services/api';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { trackEvent } from '../../services/eventTracker';
import { APP_URL } from '../../constants/config';
import { ensureAbsoluteUrl, getDestinationImageUrl } from '../../utils/images';

const DiscoverScreen = () => {
  const { t } = useTranslation('social');
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

  const [items, setItems] = useState<FeedTrip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchFeed = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        const data = await apiService.getDiscoverFeed('trending', pageNum, 20);
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setTotal(data.total);
        setPage(pageNum);
      } catch {
        if (!append) {
          showToast({ type: 'error', message: t('errors.feedFailed'), position: 'top' });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [showToast, t],
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchFeed(1);
      trackEvent('feed_viewed', { tab: 'trending' });
    }, [fetchFeed]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchFeed(1);
  };

  const loadMore = () => {
    if (isLoadingMore || items.length >= total) return;
    setIsLoadingMore(true);
    fetchFeed(page + 1, true);
  };

  const handleLikeToggle = async (trip: FeedTrip) => {
    const wasLiked = trip.isLiked;
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === trip.id
          ? {
              ...item,
              isLiked: !wasLiked,
              likesCount: wasLiked ? item.likesCount - 1 : item.likesCount + 1,
            }
          : item,
      ),
    );

    try {
      if (wasLiked) {
        await apiService.unlikeTrip(trip.id);
        trackEvent('trip_unliked', { tripId: trip.id });
      } else {
        await apiService.likeTrip(trip.id);
        trackEvent('trip_liked', { tripId: trip.id });
      }
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((item) =>
          item.id === trip.id
            ? {
                ...item,
                isLiked: wasLiked,
                likesCount: wasLiked ? item.likesCount + 1 : item.likesCount - 1,
              }
            : item,
        ),
      );
      showToast({
        type: 'error',
        message: wasLiked ? t('errors.unlikeFailed') : t('errors.likeFailed'),
        position: 'top',
      });
    }
  };

  const handleTripPress = (tripId: string) => {
    trackEvent('trip_viewed', { tripId, source: 'discover' });
    (navigation as any).navigate('Trips', { screen: 'TripDetail', params: { tripId } });
  };

  const handleShareTrip = async (trip: FeedTrip) => {
    try {
      await Share.share({
        message: `${trip.destination}${trip.country ? `, ${trip.country}` : ''}\n\n${APP_URL}`,
      });
      trackEvent('trip_shared', { tripId: trip.id, source: 'discover' });
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

  const renderTripCard = ({ item }: { item: FeedTrip }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleTripPress(item.id)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={item.destination}
    >
      <Image
        source={{
          uri: item.coverImage
            ? ensureAbsoluteUrl(item.coverImage)
            : getDestinationImageUrl(item.destination, { width: 400 }),
        }}
        style={styles.coverImage}
      />
      <View style={styles.cardBody}>
        <Text style={[styles.destination, { color: theme.colors.text }]} numberOfLines={1}>
          {item.destination}
          {item.country ? `, ${item.country}` : ''}
        </Text>

        <Text style={[styles.dateRange, { color: theme.colors.textSecondary }]}>
          {formatDateRange(item.startDate, item.endDate)}
        </Text>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => handleLikeToggle(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common:like')}
            accessibilityRole="button"
          >
            <Icon
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={22}
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
            style={styles.shareButton}
            onPress={() => handleShareTrip(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t('common:share')}
            accessibilityRole="button"
          >
            <Icon
              name="share-variant"
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderTripCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator style={{ padding: 16 }} color={theme.colors.primary} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIconContainer,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.primary[50] },
                ]}
              >
                <Icon
                  name="compass-outline"
                  size={60}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {t('emptyTrending')}
              </Text>
              <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
                {t('emptyTrendingMessage')}
              </Text>
            </View>
          }
        />
      )}
    </View>
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
      paddingBottom: 20,
    },
    card: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.neutral[0],
      overflow: 'hidden',
      ...(!isDark && {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }),
      ...(isDark && {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }),
    },
    coverImage: {
      width: '100%',
      height: 180,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.neutral[100],
    },
    coverPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#334155' : '#6366f1',
      gap: 8,
    },
    coverPlaceholderText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: 'rgba(255,255,255,0.85)',
    },
    cardBody: {
      padding: 14,
      gap: 6,
    },
    destination: {
      fontSize: 17,
      fontWeight: '700',
    },
    dateRange: {
      fontSize: 13,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    likeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    shareButton: {
      padding: 4,
    },
    likeCount: {
      fontSize: 14,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingVertical: 80,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default DiscoverScreen;
