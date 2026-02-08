/**
 * TripListScreen v2.0 - 2025 Design
 *
 * Complete redesign with:
 * - Trip cards with destination images
 * - Gradient overlays for visual hierarchy
 * - Smooth animations and transitions
 * - Status-based grouping (upcoming, ongoing, completed)
 * - Dark mode support
 * - Empty state with engaging visuals
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ImageBackground,
  Animated,
  Dimensions,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { TripsStackParamList, Trip } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import Button from '../../components/core/Button';
import { WeatherWidget } from '../../components/WeatherWidget';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TripListScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'TripList'>;

interface Props {
  navigation: TripListScreenNavigationProp;
}

// Destination image mapping for common locations
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
  // Default fallback
  'default': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
};

// Get image URL for destination
const getDestinationImage = (destination: string): string => {
  // Try to find exact match
  if (DESTINATION_IMAGES[destination]) {
    return DESTINATION_IMAGES[destination];
  }

  // Try to find partial match (e.g., "도쿄, 일본" matches "도쿄")
  const matchingKey = Object.keys(DESTINATION_IMAGES).find(key =>
    destination.includes(key) || key.includes(destination)
  );

  return matchingKey ? DESTINATION_IMAGES[matchingKey] : DESTINATION_IMAGES['default'];
};

const TripListScreen: React.FC<Props> = ({ navigation }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'upcoming' | 'ongoing' | 'completed' | null>(null);
  const { theme, isDark } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTrips = async (params?: {
    search?: string;
    status?: 'upcoming' | 'ongoing' | 'completed';
  }) => {
    try {
      const data = await apiService.getTrips({
        ...params,
        sortBy: 'startDate',
        order: 'DESC',
      });
      setTrips(data);
    } catch (error) {
      console.error('Failed to fetch trips:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Debounced search handler
  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      fetchTrips({
        search: text || undefined,
        status: selectedStatus || undefined,
      });
    }, 500);
  }, [selectedStatus]);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((status: 'upcoming' | 'ongoing' | 'completed' | null) => {
    setSelectedStatus(status);
    fetchTrips({
      search: searchText || undefined,
      status: status || undefined,
    });
  }, [searchText]);

  useFocusEffect(
    useCallback(() => {
      fetchTrips({
        search: searchText || undefined,
        status: selectedStatus || undefined,
      });
    }, [])
  );

  useEffect(() => {
    if (!isLoading) {
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
  }, [isLoading]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchTrips({
      search: searchText || undefined,
      status: selectedStatus || undefined,
    });
  };

  const handleDeleteTrip = (trip: Trip) => {
    const doDelete = async () => {
      try {
        await apiService.deleteTrip(trip.id);
        // Remove from local state immediately
        setTrips(prev => prev.filter(t => t.id !== trip.id));
      } catch (error: any) {
        const msg = error.response?.data?.message || '여행 삭제 중 오류가 발생했습니다.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(msg);
        } else {
          Alert.alert('오류', msg);
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`"${trip.destination}" 여행을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        '여행 삭제',
        `"${trip.destination}" 여행을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysDuration = (startDate: string, endDate: string): number => {
    return Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'upcoming':
        return {
          color: colors.travel.ocean,
          icon: 'calendar-clock',
          text: '예정',
          bgColor: colors.travel.ocean,
        };
      case 'ongoing':
        return {
          color: colors.success.main,
          icon: 'airplane',
          text: '진행중',
          bgColor: colors.success.main,
        };
      case 'completed':
        return {
          color: colors.neutral[500],
          icon: 'check-circle',
          text: '완료',
          bgColor: colors.neutral[500],
        };
      default:
        return {
          color: colors.neutral[500],
          icon: 'help-circle',
          text: status,
          bgColor: colors.neutral[500],
        };
    }
  };

  const groupTripsByStatus = () => {
    const grouped = {
      ongoing: trips.filter(t => t.status === 'ongoing'),
      upcoming: trips.filter(t => t.status === 'upcoming'),
      completed: trips.filter(t => t.status === 'completed'),
    };
    return grouped;
  };

  const renderTripCard = (trip: Trip, index: number) => {
    const statusConfig = getStatusConfig(trip.status);
    const imageUrl = getDestinationImage(trip.destination);
    const duration = getDaysDuration(trip.startDate, trip.endDate);

    return (
      <Animated.View
        key={trip.id}
        style={[
          styles.cardWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.tripCard}
          onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
          activeOpacity={0.9}
        >
          <ImageBackground
            source={{ uri: imageUrl }}
            style={styles.tripImage}
            imageStyle={styles.tripImageInner}
          >
            <LinearGradient
              colors={[
                'transparent',
                'rgba(0,0,0,0.3)',
                'rgba(0,0,0,0.7)',
                'rgba(0,0,0,0.9)',
              ]}
              style={styles.tripOverlay}
            >
              {/* Status Badge + Delete */}
              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.statusBadgeInner,
                    {
                      backgroundColor: isDark
                        ? `${statusConfig.bgColor}40`
                        : `${statusConfig.bgColor}20`,
                    },
                  ]}
                >
                  <Icon name={statusConfig.icon} size={14} color={statusConfig.color} />
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.text}
                  </Text>
                </View>
                {trip.status === 'completed' && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteTrip(trip)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="delete-outline" size={20} color={colors.neutral[0]} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Trip Content */}
              <View style={styles.tripContent}>
                {/* Destination */}
                <View style={styles.destinationHeader}>
                  <Icon name="map-marker" size={20} color={colors.neutral[0]} />
                  <Text style={styles.destinationName} numberOfLines={1}>
                    {trip.destination}
                  </Text>
                </View>

                {/* Dates */}
                <View style={styles.datesRow}>
                  <Icon name="calendar-range" size={16} color={colors.neutral[200]} />
                  <Text style={styles.datesText}>
                    {formatDateShort(trip.startDate)} - {formatDateShort(trip.endDate)}
                  </Text>
                </View>

                {/* Info Row */}
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Icon name="calendar" size={14} color={colors.neutral[300]} />
                    <Text style={styles.infoText}>{duration}일</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Icon name="format-list-checks" size={14} color={colors.neutral[300]} />
                    <Text style={styles.infoText}>{trip.itineraries.length}개 일정</Text>
                  </View>
                  {trip.numberOfTravelers && (
                    <View style={styles.infoItem}>
                      <Icon name="account-group" size={14} color={colors.neutral[300]} />
                      <Text style={styles.infoText}>{trip.numberOfTravelers}명</Text>
                    </View>
                  )}
                </View>

                {/* Weather Info (Compact) */}
                {trip.itineraries && trip.itineraries.length > 0 && trip.itineraries[0].weather && (
                  <View style={styles.weatherCompact}>
                    <WeatherWidget
                      weather={trip.itineraries[0].weather}
                      timezoneOffset={trip.itineraries[0].timezoneOffset}
                      compact={true}
                    />
                  </View>
                )}

                {/* Description */}
                {trip.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {trip.description}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSection = (title: string, trips: Trip[], icon: string) => {
    if (trips.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name={icon} size={24} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <View style={styles.sectionBadge}>
            <Text style={[styles.sectionBadgeText, { color: theme.colors.primary }]}>
              {trips.length}
            </Text>
          </View>
        </View>
        {trips.map((trip, index) => renderTripCard(trip, index))}
      </View>
    );
  };

  const styles = createStyles(theme, isDark);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.skeletonCard,
                {
                  backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
                  opacity: fadeAnim,
                },
              ]}
            >
              <View style={[styles.skeletonLine, { width: '60%', height: 18, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }]} />
              <View style={[styles.skeletonLine, { width: '40%', height: 14, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200], marginTop: 8 }]} />
              <View style={[styles.skeletonLine, { width: '30%', height: 14, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200], marginTop: 8 }]} />
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    );
  }

  const groupedTrips = groupTripsByStatus();
  const isFiltered = searchText.length > 0 || selectedStatus !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Create Button */}
        <Animated.View
          style={[
            styles.createButtonWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Button
            variant="primary"
            size="lg"
            icon="plus-circle"
            fullWidth
            onPress={() => navigation.navigate('CreateTrip')}
          >
            새 여행 계획 만들기
          </Button>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View
          style={[
            styles.searchWrapper,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}>
            <Icon name="magnify" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="여행지 또는 설명 검색..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchText}
              onChangeText={handleSearchChange}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')}>
                <Icon name="close-circle" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Filter Chips */}
        <Animated.View
          style={[
            styles.filterWrapper,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContainer}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedStatus === null
                    ? theme.colors.primary
                    : isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ]}
              onPress={() => handleStatusFilterChange(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedStatus === null
                      ? colors.neutral[0]
                      : theme.colors.text,
                  },
                ]}
              >
                전체
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedStatus === 'upcoming'
                    ? colors.travel.ocean
                    : isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ]}
              onPress={() => handleStatusFilterChange('upcoming')}
            >
              <Icon
                name="calendar-clock"
                size={16}
                color={selectedStatus === 'upcoming' ? colors.neutral[0] : theme.colors.text}
              />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedStatus === 'upcoming'
                      ? colors.neutral[0]
                      : theme.colors.text,
                  },
                ]}
              >
                예정
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedStatus === 'ongoing'
                    ? colors.success.main
                    : isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ]}
              onPress={() => handleStatusFilterChange('ongoing')}
            >
              <Icon
                name="airplane"
                size={16}
                color={selectedStatus === 'ongoing' ? colors.neutral[0] : theme.colors.text}
              />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedStatus === 'ongoing'
                      ? colors.neutral[0]
                      : theme.colors.text,
                  },
                ]}
              >
                진행중
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedStatus === 'completed'
                    ? colors.neutral[500]
                    : isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ]}
              onPress={() => handleStatusFilterChange('completed')}
            >
              <Icon
                name="check-circle"
                size={16}
                color={selectedStatus === 'completed' ? colors.neutral[0] : theme.colors.text}
              />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedStatus === 'completed'
                      ? colors.neutral[0]
                      : theme.colors.text,
                  },
                ]}
              >
                완료
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>

        {trips.length > 0 ? (
          <Animated.View
            style={[
              styles.tripsContainer,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            {isFiltered ? (
              <>
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultCount, { color: theme.colors.textSecondary }]}>
                    {trips.length}개의 여행
                  </Text>
                </View>
                {trips.map((trip, index) => renderTripCard(trip, index))}
              </>
            ) : (
              <>
                {renderSection('진행중인 여행', groupedTrips.ongoing, 'airplane')}
                {renderSection('다가오는 여행', groupedTrips.upcoming, 'calendar-clock')}
                {renderSection('완료된 여행', groupedTrips.completed, 'check-circle')}
              </>
            )}
          </Animated.View>
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
                  backgroundColor: isDark
                    ? colors.neutral[800]
                    : colors.primary[50],
                },
              ]}
            >
              <Icon
                name="bag-suitcase-outline"
                size={80}
                color={theme.colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              아직 계획된 여행이 없습니다
            </Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
              첫 여행 계획을 만들어보세요!{'\n'}AI가 완벽한 일정을 만들어드립니다.
            </Text>
            <View style={styles.emptyButtonWrapper}>
              <Button
                variant="primary"
                size="lg"
                icon="sparkles"
                onPress={() => navigation.navigate('CreateTrip')}
              >
                AI 여행 계획 시작하기
              </Button>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
    skeletonCard: {
      borderRadius: 16,
      padding: 20,
      height: 140,
      justifyContent: 'flex-end',
    },
    skeletonLine: {
      borderRadius: 6,
    },
    content: {
      flex: 1,
    },
    createButtonWrapper: {
      padding: 20,
      paddingBottom: 0,
    },
    searchWrapper: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      padding: 0,
    },
    filterWrapper: {
      paddingTop: 12,
    },
    filterChipsContainer: {
      paddingHorizontal: 20,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 6,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: '600',
    },
    resultHeader: {
      paddingBottom: 8,
    },
    resultCount: {
      fontSize: 14,
      fontWeight: '600',
    },
    tripsContainer: {
      padding: 20,
      paddingTop: 8,
    },
    section: {
      marginTop: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginLeft: 8,
      flex: 1,
    },
    sectionBadge: {
      backgroundColor: isDark ? colors.neutral[800] : colors.primary[50],
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minWidth: 32,
      alignItems: 'center',
    },
    sectionBadgeText: {
      fontSize: 14,
      fontWeight: '700',
    },
    cardWrapper: {
      marginBottom: 16,
    },
    tripCard: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme.colors.white,
      ...theme.shadows.lg,
    },
    tripImage: {
      width: '100%',
      height: 280,
    },
    tripImageInner: {
      borderRadius: 20,
    },
    tripOverlay: {
      flex: 1,
      justifyContent: 'space-between',
      padding: 20,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    deleteButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusBadgeInner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 4,
    },
    tripContent: {
      gap: 8,
    },
    destinationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    destinationName: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.neutral[0],
      flex: 1,
    },
    datesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    datesText: {
      fontSize: 14,
      color: colors.neutral[200],
      fontWeight: '500',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 4,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    infoText: {
      fontSize: 12,
      color: colors.neutral[300],
      fontWeight: '500',
    },
    weatherCompact: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    description: {
      fontSize: 14,
      color: colors.neutral[200],
      lineHeight: 20,
      marginTop: 4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      marginTop: 60,
    },
    emptyIconContainer: {
      width: 160,
      height: 160,
      borderRadius: 80,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: 32,
    },
    emptyButtonWrapper: {
      width: '100%',
    },
  });

export default TripListScreen;
