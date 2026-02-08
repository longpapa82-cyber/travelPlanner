/**
 * TripDetailScreen v2.0 - 2025 Design
 *
 * Complete redesign with:
 * - Hero section with destination image
 * - Timeline-style itinerary display
 * - Enhanced activity cards
 * - Weather information highlights
 * - Smooth animations
 * - Dark mode support
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ImageBackground,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { TripsStackParamList, Trip, Itinerary, Activity } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import Button from '../../components/core/Button';
import { ActivityModal } from '../../components/ActivityModal';
import { ShareModal } from '../../components/ShareModal';
import { WeatherWidget } from '../../components/WeatherWidget';
import { ProgressIndicator } from '../../components/ProgressIndicator';
import { AdSense } from '../../components/ads';
import AffiliateLink from '../../components/ads/AffiliateLink';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type TripDetailScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'TripDetail'>;
type TripDetailScreenRouteProp = RouteProp<TripsStackParamList, 'TripDetail'>;

interface Props {
  navigation: TripDetailScreenNavigationProp;
  route: TripDetailScreenRouteProp;
}

// Destination image mapping (reuse from TripListScreen)
const DESTINATION_IMAGES: Record<string, string> = {
  '도쿄': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  '파리': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
  '뉴욕': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
  '런던': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
  '로마': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
  '바르셀로나': 'https://images.unsplash.com/photo-1562883676-8c7feb83f09b?w=800&q=80',
  '서울': 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&q=80',
  '방콕': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80',
  '싱가포르': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80',
  '홍콩': 'https://images.unsplash.com/photo-1536599424071-5408d47d1ceb?w=800&q=80',
  'default': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
};

const getDestinationImage = (destination: string): string => {
  if (DESTINATION_IMAGES[destination]) {
    return DESTINATION_IMAGES[destination];
  }
  const matchingKey = Object.keys(DESTINATION_IMAGES).find(key =>
    destination.includes(key) || key.includes(destination)
  );
  return matchingKey ? DESTINATION_IMAGES[matchingKey] : DESTINATION_IMAGES['default'];
};

const TripDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { theme, isDark } = useTheme();

  // Activity modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedItineraryId, setSelectedItineraryId] = useState<string>('');
  const [selectedActivityIndex, setSelectedActivityIndex] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | undefined>(undefined);

  // Share modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const fetchTripDetails = async () => {
    try {
      const data = await apiService.getTripById(tripId);
      setTrip(data);
    } catch (error) {
      console.error('Failed to fetch trip details:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('여행 정보를 불러올 수 없습니다.');
      } else {
        Alert.alert('오류', '여행 정보를 불러올 수 없습니다.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTripDetails();
  }, [tripId]);

  useEffect(() => {
    if (!isLoading && trip) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading, trip]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTripDetails();
  };

  // Activity management handlers
  const handleAddActivity = (itineraryId: string) => {
    setSelectedItineraryId(itineraryId);
    setSelectedActivity(undefined);
    setSelectedActivityIndex(null);
    setModalMode('add');
    setModalVisible(true);
  };

  const handleEditActivity = (itineraryId: string, activityIndex: number, activity: Activity) => {
    setSelectedItineraryId(itineraryId);
    setSelectedActivityIndex(activityIndex);
    setSelectedActivity(activity);
    setModalMode('edit');
    setModalVisible(true);
  };

  const handleDeleteActivity = (itineraryId: string, activityIndex: number) => {
    Alert.alert(
      '활동 삭제',
      '이 활동을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteActivity(tripId, itineraryId, activityIndex);
              await fetchTripDetails(); // Refresh trip data
              Alert.alert('성공', '활동이 삭제되었습니다.');
            } catch (error: any) {
              Alert.alert(
                '오류',
                error.response?.data?.message || '활동 삭제 중 오류가 발생했습니다.'
              );
            }
          },
        },
      ]
    );
  };

  const handleToggleActivityCompletion = async (
    itineraryId: string,
    activityIndex: number,
    currentActivity: Activity
  ) => {
    try {
      // Toggle completed status
      const newCompletedStatus = !(currentActivity.completed ?? false);

      await apiService.updateActivity(tripId, itineraryId, activityIndex, {
        ...currentActivity,
        completed: newCompletedStatus,
      });

      await fetchTripDetails(); // Refresh trip data
    } catch (error: any) {
      Alert.alert(
        '오류',
        error.response?.data?.message || '활동 상태 변경 중 오류가 발생했습니다.'
      );
    }
  };

  const handleSaveActivity = async (activityData: Partial<Activity>) => {
    try {
      if (modalMode === 'add') {
        await apiService.addActivity(tripId, selectedItineraryId, activityData);
      } else {
        if (selectedActivityIndex !== null) {
          await apiService.updateActivity(
            tripId,
            selectedItineraryId,
            selectedActivityIndex,
            activityData
          );
        }
      }
      await fetchTripDetails(); // Refresh trip data
      setModalVisible(false);
    } catch (error: any) {
      throw error; // Let ActivityModal handle the error display
    }
  };

  const handleReorderActivities = async (itineraryId: string, newOrder: number[]) => {
    try {
      await apiService.reorderActivities(tripId, itineraryId, newOrder);
      await fetchTripDetails(); // Refresh trip data
    } catch (error: any) {
      Alert.alert(
        '오류',
        error.response?.data?.message || '활동 순서 변경 중 오류가 발생했습니다.'
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getWeatherIcon = (main: string) => {
    const iconMap: { [key: string]: string } = {
      Clear: 'weather-sunny',
      Clouds: 'weather-cloudy',
      Rain: 'weather-rainy',
      Snow: 'weather-snowy',
      Thunderstorm: 'weather-lightning',
      Drizzle: 'weather-rainy',
      Mist: 'weather-fog',
      Fog: 'weather-fog',
    };
    return iconMap[main] || 'weather-partly-cloudy';
  };

  const getWeatherColor = (main: string) => {
    const colorMap: { [key: string]: string } = {
      Clear: '#F59E0B',
      Clouds: '#6B7280',
      Rain: '#3B82F6',
      Snow: '#60A5FA',
      Thunderstorm: '#8B5CF6',
    };
    return colorMap[main] || colors.neutral[500];
  };

  const getActivityIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      식사: 'silverware-fork-knife',
      관광: 'camera',
      쇼핑: 'shopping',
      체험: 'ticket',
      휴식: 'coffee',
      이동: 'car',
      숙소: 'bed',
    };
    return iconMap[type] || 'map-marker';
  };

  const getActivityColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      식사: colors.warning.main,
      관광: colors.travel.ocean,
      쇼핑: colors.error.main,
      체험: colors.success.main,
      휴식: colors.travel.relax,
      이동: colors.neutral[500],
      숙소: colors.travel.night,
    };
    return colorMap[type] || theme.colors.primary;
  };

  const getDuration = (): number => {
    if (!trip) return 0;
    return Math.ceil(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  };

  // Activity status helpers
  const getActivityStatus = (activity: Activity, itineraryDate: string): 'completed' | 'ongoing' | 'upcoming' => {
    if (!trip) return 'upcoming';

    // Priority 1: Backend completion status (auto-updated by trip-progress helper)
    // This takes precedence as backend uses timezone-aware logic
    if (activity.completed === true) {
      return 'completed';
    }

    // Priority 2: Check if currently ongoing
    const now = new Date();
    const activityDateTime = new Date(`${itineraryDate.split('T')[0]}T${activity.time}`);

    // If activity has started but not marked as completed
    if (activityDateTime <= now) {
      // Check if within estimated duration (ongoing)
      const estimatedDuration = activity.estimatedDuration || 120; // default 2 hours
      const activityEndTime = new Date(activityDateTime.getTime() + (estimatedDuration * 60 * 1000));

      if (now <= activityEndTime) {
        return 'ongoing';
      }

      // Past end time but not marked complete - still show as ongoing
      // Backend will eventually mark it completed on next fetch
      return 'ongoing';
    }

    return 'upcoming';
  };

  const getTripProgress = (): { completed: number; total: number; percentage: number } => {
    if (!trip || !trip.itineraries) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    let completedCount = 0;
    let totalCount = 0;

    trip.itineraries.forEach((itinerary) => {
      itinerary.activities.forEach((activity) => {
        totalCount++;
        const status = getActivityStatus(activity, itinerary.date);
        if (status === 'completed') {
          completedCount++;
        }
      });
    });

    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return { completed: completedCount, total: totalCount, percentage };
  };

  const getItineraryProgress = (itinerary: Itinerary): { completed: number; total: number; percentage: number } => {
    let completedCount = 0;
    const totalCount = itinerary.activities.length;

    itinerary.activities.forEach((activity) => {
      const status = getActivityStatus(activity, itinerary.date);
      if (status === 'completed') {
        completedCount++;
      }
    });

    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return { completed: completedCount, total: totalCount, percentage };
  };

  const renderDraggableActivity = (
    params: RenderItemParams<Activity>,
    itineraryId: string,
    itineraryDate: string,
    isLast: boolean
  ) => {
    const { item: activity, drag, isActive } = params;
    const activityColor = getActivityColor(activity.type);
    const index = trip?.itineraries
      .find((it) => it.id === itineraryId)
      ?.activities.indexOf(activity) ?? 0;

    const activityStatus = getActivityStatus(activity, itineraryDate);

    // Check if activity is in the past for ongoing trips
    const now = new Date();
    const activityDateTime = new Date(`${itineraryDate.split('T')[0]}T${activity.time}`);
    const isActivityInPast = activityDateTime < now;
    const isOngoingTrip = trip?.status === 'ongoing';
    const isCompletedTrip = trip?.status === 'completed';

    // Disable edit/delete for past activities in ongoing trips and all activities in completed trips
    const canModify = !isCompletedTrip && !(isOngoingTrip && isActivityInPast);

    return (
      <ScaleDecorator>
        <View style={styles.activityWrapper}>
          {/* Timeline Dot and Line - Clickable Checkbox */}
          <View style={styles.timelineContainer}>
            <TouchableOpacity
              onPress={() => handleToggleActivityCompletion(itineraryId, index, activity)}
              activeOpacity={0.7}
              disabled={isCompletedTrip}
              style={[
                styles.timelineDot,
                {
                  backgroundColor: activityStatus === 'completed'
                    ? colors.success.main
                    : activityStatus === 'ongoing'
                    ? colors.warning.main
                    : activityColor
                }
              ]}
            >
              <Icon
                name={
                  activityStatus === 'completed'
                    ? 'check'
                    : activityStatus === 'ongoing'
                    ? 'clock-fast'
                    : getActivityIcon(activity.type)
                }
                size={16}
                color={colors.neutral[0]}
              />
            </TouchableOpacity>
            {!isLast && <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />}
          </View>

          {/* Activity Card */}
          <View
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
                  <Text style={[styles.activityTypeText, { color: activityColor }]}>{activity.type}</Text>
                </View>
                {canModify && (
                  <View style={styles.activityActions}>
                    <TouchableOpacity
                      style={styles.activityActionButton}
                      onPress={() => handleEditActivity(itineraryId, index, activity)}
                    >
                      <Icon name="pencil" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.activityActionButton}
                      onPress={() => handleDeleteActivity(itineraryId, index)}
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
                  }
                ]}
              >
                {activity.title}
              </Text>
              {activityStatus === 'ongoing' && (
                <View style={[styles.statusBadge, { backgroundColor: colors.success.light }]}>
                  <Icon name="clock-fast" size={12} color={colors.success.main} />
                  <Text style={[styles.statusBadgeText, { color: colors.success.main }]}>진행중</Text>
                </View>
              )}
              {activityStatus === 'completed' && (
                <View style={[styles.statusBadge, { backgroundColor: colors.neutral[200] }]}>
                  <Icon name="check" size={12} color={colors.neutral[600]} />
                  <Text style={[styles.statusBadgeText, { color: colors.neutral[600] }]}>완료</Text>
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
                  }
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
                  }
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
                  완료된 활동은 수정할 수 없습니다
                </Text>
              </View>
            )}

            <View style={styles.activityFooter}>
              <View style={styles.activityMeta}>
                <Icon name="timer-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.activityMetaText, { color: theme.colors.textSecondary }]}>
                  {activity.estimatedDuration}분
                </Text>
              </View>
              {activity.estimatedCost > 0 && (
                <View style={styles.activityMeta}>
                  <Icon name="currency-usd" size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.activityMetaText, { color: theme.colors.textSecondary }]}>
                    약 {activity.estimatedCost.toLocaleString()}원
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  const renderItinerary = (itinerary: Itinerary, dayIndex: number) => (
    <Animated.View
      key={itinerary.id}
      style={[
        styles.daySection,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Day Header */}
      <View style={styles.dayHeader}>
        <View
          style={[
            styles.dayBadge,
            {
              backgroundColor: isDark ? colors.primary[700] : colors.primary[50],
            },
          ]}
        >
          <Text style={[styles.dayNumber, { color: theme.colors.primary }]}>Day {itinerary.dayNumber}</Text>
        </View>
        <Text style={[styles.dayDate, { color: theme.colors.textSecondary }]}>{formatDate(itinerary.date)}</Text>
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
            completed={getItineraryProgress(itinerary).completed}
            total={getItineraryProgress(itinerary).total}
            variant="full"
          />
        </View>
      )}

      {/* Activities with Timeline - Draggable */}
      <View style={styles.activitiesContainer}>
        <DraggableFlatList
          data={itinerary.activities}
          renderItem={(params) =>
            renderDraggableActivity(
              params,
              itinerary.id,
              itinerary.date,
              params.getIndex() === itinerary.activities.length - 1
            )
          }
          keyExtractor={(item, index) => `activity-${itinerary.id}-${index}`}
          onDragEnd={({ data }) => {
            // Calculate new order indices
            const newOrder = data.map((activity) => itinerary.activities.indexOf(activity));
            handleReorderActivities(itinerary.id, newOrder);
          }}
          scrollEnabled={false}
        />
      </View>

      {/* Add Activity Button - Only show for upcoming and ongoing trips */}
      {trip.status !== 'completed' && (
        <TouchableOpacity
          style={[
            styles.addActivityButton,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
              borderColor: theme.colors.primary,
            },
          ]}
          onPress={() => handleAddActivity(itinerary.id)}
        >
          <Icon name="plus-circle" size={20} color={theme.colors.primary} />
          <Text style={[styles.addActivityText, { color: theme.colors.primary }]}>
            활동 추가
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

  const styles = createStyles(theme, isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>여행 정보를 불러오는 중...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.errorContainer}>
        <View
          style={[
            styles.errorIconContainer,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.error.light,
            },
          ]}
        >
          <Icon name="alert-circle-outline" size={60} color={colors.error.main} />
        </View>
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
          여행 정보를 찾을 수 없습니다
        </Text>
        <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
          존재하지 않거나 삭제된 여행입니다
        </Text>
        <View style={styles.errorButtonWrapper}>
          <Button variant="primary" size="md" icon="arrow-left" onPress={() => navigation.goBack()}>
            돌아가기
          </Button>
        </View>
      </View>
    );
  }

  const imageUrl = getDestinationImage(trip.destination);
  const duration = getDuration();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Completed Trip Banner */}
        {trip.status === 'completed' && (
          <View style={[styles.completedBanner, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] }]}>
            <Icon name="check-circle" size={20} color={colors.success.main} />
            <View style={styles.completedBannerTextContainer}>
              <Text style={[styles.completedBannerTitle, { color: theme.colors.text }]}>
                여행 완료
              </Text>
              <Text style={[styles.completedBannerMessage, { color: theme.colors.textSecondary }]}>
                이 여행은 완료되어 수정할 수 없습니다. 조회와 삭제만 가능합니다.
              </Text>
            </View>
          </View>
        )}

        {/* Hero Section */}
        <ImageBackground source={{ uri: imageUrl }} style={styles.hero}>
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
          style={styles.heroGradient}
        >
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <View style={styles.iconButtonInner}>
                <Icon name="arrow-left" size={24} color={colors.neutral[0]} />
              </View>
            </TouchableOpacity>

            <View style={styles.rightButtons}>
              {trip.status !== 'completed' && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EditTrip', { tripId: trip.id })}
                >
                  <View style={styles.iconButtonInner}>
                    <Icon name="pencil" size={24} color={colors.neutral[0]} />
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => setShareModalVisible(true)}
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
                <Text style={styles.heroMetaText}>{duration}일</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Icon name="account-group" size={16} color={colors.neutral[200]} />
                <Text style={styles.heroMetaText}>{trip.numberOfTravelers || 1}명</Text>
              </View>
            </View>

            {/* Trip Overall Progress */}
            {trip.status === 'ongoing' && getTripProgress().total > 0 && (
              <View style={styles.heroProgressContainer}>
                <View style={styles.heroProgressHeader}>
                  <Icon name="chart-arc" size={14} color={colors.neutral[200]} />
                  <Text style={styles.heroProgressText}>
                    전체 진행률 {getTripProgress().percentage}%
                  </Text>
                </View>
                <View style={styles.heroProgressBarBackground}>
                  <View
                    style={[
                      styles.heroProgressBarFill,
                      { width: `${getTripProgress().percentage}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </Animated.View>
        </LinearGradient>
      </ImageBackground>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Trip Description */}
        {trip.description && (
          <Animated.View
            style={[
              styles.descriptionCard,
              {
                backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
                opacity: fadeAnim,
              },
            ]}
          >
            <Icon name="text" size={24} color={theme.colors.primary} />
            <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
              {trip.description}
            </Text>
          </Animated.View>
        )}

        {/* Affiliate Links Section */}
        <Animated.View
          style={[
            styles.affiliateSection,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.affiliateSectionHeader}>
            <Icon name="bookmark-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.affiliateSectionTitle, { color: theme.colors.text }]}>
              숙소 & 액티비티 예약
            </Text>
          </View>
          <Text style={[styles.affiliateSectionSubtitle, { color: theme.colors.textSecondary }]}>
            {trip.destination}에서의 완벽한 여행을 위해
          </Text>

          <View style={styles.affiliateButtons}>
            <AffiliateLink
              provider="booking"
              destination={trip.destination}
              checkIn={trip.startDate}
              checkOut={trip.endDate}
              travelers={trip.numberOfTravelers}
              tripId={trip.id}
              variant="outline"
              size="medium"
              style={styles.affiliateButton}
            />
            <AffiliateLink
              provider="expedia"
              destination={trip.destination}
              checkIn={trip.startDate}
              checkOut={trip.endDate}
              travelers={trip.numberOfTravelers}
              tripId={trip.id}
              variant="outline"
              size="medium"
              style={styles.affiliateButton}
            />
            <AffiliateLink
              provider="viator"
              destination={trip.destination}
              tripId={trip.id}
              variant="outline"
              size="medium"
              style={styles.affiliateButton}
            />
            <AffiliateLink
              provider="klook"
              destination={trip.destination}
              tripId={trip.id}
              variant="outline"
              size="medium"
              style={styles.affiliateButton}
            />
          </View>
        </Animated.View>

        {/* AdSense Banner */}
        <AdSense
          adSlot="1234567890"
          format="auto"
          fullWidthResponsive
          testMode={__DEV__}
        />

        {/* Itineraries */}
        {trip.itineraries.length > 0 ? (
          trip.itineraries
            .sort((a, b) => a.dayNumber - b.dayNumber)
            .map((itinerary, index) => renderItinerary(itinerary, index))
        ) : (
          <Animated.View
            style={[
              styles.emptyState,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconContainer,
                {
                  backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ]}
            >
              <Icon name="calendar-blank" size={60} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              아직 일정이 생성되지 않았습니다
            </Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              AI가 여행 일정을 생성하는 중입니다
            </Text>
          </Animated.View>
        )}

        {/* Bottom AdSense Banner (after itineraries) */}
        {trip.itineraries.length > 0 && (
          <AdSense
            adSlot="0987654321"
            format="auto"
            fullWidthResponsive
            testMode={__DEV__}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Activity Modal */}
      <ActivityModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveActivity}
        activity={selectedActivity}
        mode={modalMode}
      />

      {/* Share Modal */}
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        tripId={tripId}
        tripDestination={trip.destination}
        currentShareToken={trip.shareToken}
      />
      </View>
    </GestureHandlerRootView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      padding: 40,
    },
    errorIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    errorTitle: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 32,
    },
    errorButtonWrapper: {
      width: '100%',
    },
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
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: 20,
    },
    descriptionCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginHorizontal: 20,
      marginBottom: 24,
      padding: 16,
      borderRadius: 16,
      ...theme.shadows.md,
    },
    descriptionText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 24,
    },
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
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: '500',
    },
    progressPercentage: {
      fontSize: 14,
      fontWeight: '700',
    },
    progressBarBackground: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    activitiesContainer: {
      marginBottom: 16,
    },
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
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      marginTop: 40,
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
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 16,
      textAlign: 'center',
    },
    completedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    completedBannerTextContainer: {
      flex: 1,
    },
    completedBannerTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    completedBannerMessage: {
      fontSize: 13,
      lineHeight: 18,
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
    affiliateSection: {
      marginHorizontal: 20,
      marginBottom: 24,
      padding: 20,
      borderRadius: 16,
      ...theme.shadows.sm,
    },
    affiliateSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    affiliateSectionTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    affiliateSectionSubtitle: {
      fontSize: 14,
      marginBottom: 16,
    },
    affiliateButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    affiliateButton: {
      flex: Platform.OS === 'web' ? 0 : 1,
      minWidth: Platform.OS === 'web' ? 160 : undefined,
    },
  });

export default TripDetailScreen;
