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

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { trackEvent } from '../../services/eventTracker';
import EmailVerificationBanner from '../../components/feedback/EmailVerificationBanner';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Button from '../../components/core/Button';
import { WeatherWidget } from '../../components/WeatherWidget';
import { AdBanner } from '../../components/ads';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { getDestinationImageUrl } from '../../utils/images';

type TripListScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'TripList'>;

interface Props {
  navigation: TripListScreenNavigationProp;
}

interface AdvancedFilters {
  country: string;
  startDateFrom: string;
  startDateTo: string;
  budgetMin: string;
  budgetMax: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  country: '',
  startDateFrom: '',
  startDateTo: '',
  budgetMin: '',
  budgetMax: '',
};

const TripListScreen: React.FC<Props> = ({ navigation }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [totalTrips, setTotalTrips] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'upcoming' | 'ongoing' | 'completed' | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const { showToast } = useToast();
  const [fetchError, setFetchError] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const TRIPS_PER_PAGE = 20;

  const buildParams = (overrides?: {
    search?: string;
    status?: 'upcoming' | 'ongoing' | 'completed';
    page?: number;
    filters?: AdvancedFilters;
  }) => {
    const filters = overrides?.filters ?? appliedFilters;
    return {
      search: (overrides?.search ?? searchText) || undefined,
      status: (overrides?.status ?? selectedStatus) || undefined,
      country: filters.country || undefined,
      startDateFrom: filters.startDateFrom || undefined,
      startDateTo: filters.startDateTo || undefined,
      budgetMin: filters.budgetMin ? Number(filters.budgetMin) : undefined,
      budgetMax: filters.budgetMax ? Number(filters.budgetMax) : undefined,
      sortBy: 'startDate' as const,
      order: 'DESC' as const,
      page: overrides?.page ?? 1,
      limit: TRIPS_PER_PAGE,
    };
  };

  const fetchTrips = async (params?: {
    search?: string;
    status?: 'upcoming' | 'ongoing' | 'completed';
    page?: number;
    filters?: AdvancedFilters;
  }) => {
    try {
      setFetchError(false);
      const data = await apiService.getTrips(buildParams(params));
      // Handle both paginated response { trips, total } and legacy array response
      if (data && Array.isArray(data.trips)) {
        setTrips(data.trips);
        setTotalTrips(data.total);
        setCurrentPage(data.page || 1);
      } else if (Array.isArray(data)) {
        setTrips(data);
        setTotalTrips(data.length);
        setCurrentPage(1);
      }
    } catch (error) {
      setFetchError(true);
      if (isRefreshing) {
        showToast({ type: 'error', message: t('list.error.refreshFailed'), position: 'top' });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadMoreTrips = async () => {
    if (isLoadingMore || trips.length >= totalTrips) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await apiService.getTrips(buildParams({ page: nextPage }));
      if (data && Array.isArray(data.trips)) {
        setTrips(prev => [...prev, ...data.trips]);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      // Silent fail — previous page data preserved
    } finally {
      setIsLoadingMore(false);
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
      if (text) trackEvent('search', { query: text });
      fetchTrips({ search: text || undefined, status: selectedStatus || undefined });
    }, 500);
  }, [selectedStatus, appliedFilters]);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((status: 'upcoming' | 'ongoing' | 'completed' | null) => {
    setSelectedStatus(status);
    trackEvent('filter_applied', { status: status || 'all' });
    fetchTrips({ search: searchText || undefined, status: status || undefined });
  }, [searchText, appliedFilters]);

  const activeFilterCount = useMemo(() => [
    appliedFilters.country,
    appliedFilters.startDateFrom,
    appliedFilters.startDateTo,
    appliedFilters.budgetMin,
    appliedFilters.budgetMax,
  ].filter(Boolean).length, [appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...advancedFilters });
    setShowAdvancedFilters(false);
    fetchTrips({
      search: searchText || undefined,
      status: selectedStatus || undefined,
      filters: advancedFilters,
    });
  };

  const handleResetFilters = () => {
    setAdvancedFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setShowAdvancedFilters(false);
    fetchTrips({
      search: searchText || undefined,
      status: selectedStatus || undefined,
      filters: EMPTY_FILTERS,
    });
  };

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
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
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
        setTrips(prev => prev.filter(t => t.id !== trip.id));
        trackEvent('trip_deleted', { tripId: trip.id });
        showToast({ type: 'success', message: t('detail.alerts.deleteSuccess'), position: 'top' });
      } catch (error: any) {
        const msg = error.response?.data?.message || t('list.alerts.deleteFailed');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(msg);
        } else {
          Alert.alert(t('list.alerts.error'), msg);
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(t('list.alerts.deleteMessage', { name: trip.destination }))) {
        doDelete();
      }
    } else {
      Alert.alert(
        t('list.alerts.deleteTitle'),
        t('list.alerts.deleteMessage', { name: trip.destination }),
        [
          { text: t('list.alerts.cancel'), style: 'cancel' },
          { text: t('list.alerts.delete'), style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
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
          text: t('list.status.upcoming'),
          bgColor: colors.travel.ocean,
        };
      case 'ongoing':
        return {
          color: colors.success.main,
          icon: 'airplane',
          text: t('list.status.ongoing'),
          bgColor: colors.success.main,
        };
      case 'completed':
        return {
          color: colors.neutral[500],
          icon: 'check-circle',
          text: t('list.status.completed'),
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

  const groupedTrips = useMemo(() => ({
    ongoing: trips.filter(t => t.status === 'ongoing'),
    upcoming: trips.filter(t => t.status === 'upcoming'),
    completed: trips.filter(t => t.status === 'completed'),
  }), [trips]);

  const renderTripCard = (trip: Trip, index: number) => {
    const statusConfig = getStatusConfig(trip.status);
    const imageUrl = getDestinationImageUrl(trip.destination, { width: 400 });
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
          accessibilityLabel={`${trip.destination} ${t('list.accessibility.trip')}, ${getStatusConfig(trip.status).text}`}
          accessibilityRole="button"
          accessibilityHint={t('list.accessibility.viewDetail')}
          testID="trip-card"
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
                  <View style={styles.completedCardActions}>
                    <View style={styles.readOnlyBadge}>
                      <Icon name="lock" size={12} color={colors.neutral[0]} />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteTrip(trip)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityLabel={`${trip.destination} ${t('list.accessibility.deleteTrip')}`}
                      accessibilityRole="button"
                    >
                      <Icon name="delete-outline" size={20} color={colors.neutral[0]} />
                    </TouchableOpacity>
                  </View>
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
                    <Text style={styles.infoText}>{t('list.info.days', { count: duration })}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Icon name="format-list-checks" size={14} color={colors.neutral[300]} />
                    <Text style={styles.infoText}>{t('list.info.itineraries', { count: trip.itineraries.length })}</Text>
                  </View>
                  {trip.numberOfTravelers && (
                    <View style={styles.infoItem}>
                      <Icon name="account-group" size={14} color={colors.neutral[300]} />
                      <Text style={styles.infoText}>{t('list.info.travelers', { count: trip.numberOfTravelers })}</Text>
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

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

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

  const isFiltered = searchText.length > 0 || selectedStatus !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        removeClippedSubviews={Platform.OS !== 'web'}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <EmailVerificationBanner />
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
            {t('list.createButton')}
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
              placeholder={t('list.searchPlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              value={searchText}
              onChangeText={handleSearchChange}
              accessibilityLabel={t('list.accessibility.search')}
              accessibilityHint={t('list.accessibility.searchHint')}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} accessibilityRole="button" accessibilityLabel={t('common:clear')}>
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
              testID="filter-all"
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
                {t('list.filters.all')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="filter-upcoming"
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
                {t('list.filters.upcoming')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="filter-ongoing"
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
                {t('list.filters.ongoing')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="filter-completed"
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
                {t('list.filters.completed')}
              </Text>
            </TouchableOpacity>

            {/* Advanced Filter Toggle */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilterCount > 0
                    ? colors.primary[500]
                    : isDark ? colors.neutral[800] : colors.neutral[100],
                },
              ]}
              onPress={() => {
                setShowAdvancedFilters(!showAdvancedFilters);
                if (!showAdvancedFilters) setAdvancedFilters({ ...appliedFilters });
              }}
            >
              <Icon
                name="tune-variant"
                size={16}
                color={activeFilterCount > 0 ? colors.neutral[0] : theme.colors.text}
              />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: activeFilterCount > 0
                      ? colors.neutral[0]
                      : theme.colors.text,
                  },
                ]}
              >
                {activeFilterCount > 0
                  ? t('list.advancedFilters.activeCount', { count: activeFilterCount })
                  : t('list.advancedFilters.toggle')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>

        {/* Advanced Filter Panel */}
        {showAdvancedFilters && (
          <View style={[styles.advancedFilterPanel, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}>
            {/* Country */}
            <View style={styles.advFilterRow}>
              <Text style={[styles.advFilterLabel, { color: theme.colors.text }]}>
                {t('list.advancedFilters.country')}
              </Text>
              <TextInput
                style={[styles.advFilterInput, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                placeholder={t('list.advancedFilters.countryPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={advancedFilters.country}
                onChangeText={(v) => setAdvancedFilters(f => ({ ...f, country: v }))}
              />
            </View>

            {/* Date Range */}
            <View style={styles.advFilterRow}>
              <Text style={[styles.advFilterLabel, { color: theme.colors.text }]}>
                {t('list.advancedFilters.dateRange')}
              </Text>
              <View style={styles.advFilterRowInner}>
                <TextInput
                  style={[styles.advFilterInputHalf, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                  placeholder={t('list.advancedFilters.dateFrom')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.startDateFrom}
                  onChangeText={(v) => setAdvancedFilters(f => ({ ...f, startDateFrom: v }))}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={{ color: theme.colors.textSecondary }}>~</Text>
                <TextInput
                  style={[styles.advFilterInputHalf, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                  placeholder={t('list.advancedFilters.dateTo')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.startDateTo}
                  onChangeText={(v) => setAdvancedFilters(f => ({ ...f, startDateTo: v }))}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Budget Range */}
            <View style={styles.advFilterRow}>
              <Text style={[styles.advFilterLabel, { color: theme.colors.text }]}>
                {t('list.advancedFilters.budget')}
              </Text>
              <View style={styles.advFilterRowInner}>
                <TextInput
                  style={[styles.advFilterInputHalf, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                  placeholder={t('list.advancedFilters.budgetMin')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.budgetMin}
                  onChangeText={(v) => setAdvancedFilters(f => ({ ...f, budgetMin: v }))}
                  keyboardType="numeric"
                />
                <Text style={{ color: theme.colors.textSecondary }}>~</Text>
                <TextInput
                  style={[styles.advFilterInputHalf, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                  placeholder={t('list.advancedFilters.budgetMax')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.budgetMax}
                  onChangeText={(v) => setAdvancedFilters(f => ({ ...f, budgetMax: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.advFilterActions}>
              <TouchableOpacity
                style={[styles.advFilterResetBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
                onPress={handleResetFilters}
                accessibilityRole="button"
                accessibilityLabel={t('list.advancedFilters.reset')}
              >
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                  {t('list.advancedFilters.reset')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advFilterApplyBtn, { backgroundColor: colors.primary[500] }]}
                onPress={handleApplyFilters}
                accessibilityRole="button"
                accessibilityLabel={t('list.advancedFilters.apply')}
              >
                <Text style={{ color: colors.neutral[0], fontWeight: '600', fontSize: 14 }}>
                  {t('list.advancedFilters.apply')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                    {t('list.resultCount', { count: trips.length })}
                  </Text>
                </View>
                {trips.map((trip, index) => renderTripCard(trip, index))}
              </>
            ) : (
              <>
                {renderSection(t('list.sections.ongoing'), groupedTrips.ongoing, 'airplane')}
                {renderSection(t('list.sections.upcoming'), groupedTrips.upcoming, 'calendar-clock')}
                {renderSection(t('list.sections.completed'), groupedTrips.completed, 'archive')}
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
                    : fetchError ? `${colors.error.main}15` : colors.primary[50],
                },
              ]}
            >
              <Icon
                name={fetchError ? 'wifi-off' : (searchText || selectedStatus) ? 'magnify-close' : 'bag-suitcase-outline'}
                size={80}
                color={fetchError ? colors.error.main : theme.colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {fetchError
                ? t('list.error.title')
                : (searchText || selectedStatus)
                  ? t('list.empty.noResults')
                  : t('list.empty.title')}
            </Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
              {fetchError
                ? t('list.error.description')
                : (searchText || selectedStatus)
                  ? t('list.empty.noResultsDescription')
                  : t('list.empty.description')}
            </Text>
            <View style={styles.emptyButtonWrapper}>
              {fetchError ? (
                <Button
                  variant="primary"
                  size="lg"
                  icon="refresh"
                  onPress={() => fetchTrips()}
                >
                  {t('list.error.retry')}
                </Button>
              ) : (searchText || selectedStatus) ? (
                <Button
                  variant="outline"
                  size="lg"
                  icon="filter-remove"
                  onPress={() => {
                    setSearchText('');
                    setSelectedStatus(null);
                    setAppliedFilters(EMPTY_FILTERS);
                    setAdvancedFilters(EMPTY_FILTERS);
                    fetchTrips({ search: undefined, status: undefined, filters: EMPTY_FILTERS });
                  }}
                >
                  {t('list.empty.clearFilters')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  icon="creation"
                  onPress={() => navigation.navigate('CreateTrip')}
                >
                  {t('list.empty.cta')}
                </Button>
              )}
            </View>
          </Animated.View>
        )}

        {/* Ad Banner */}
        {trips.length > 0 && <AdBanner size="adaptive" style={{ marginHorizontal: 16 }} />}

        {/* Load More */}
        {trips.length > 0 && trips.length < totalTrips && (
          <View style={styles.loadMoreWrapper}>
            <TouchableOpacity
              style={[styles.loadMoreBtn, { borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
              onPress={loadMoreTrips}
              disabled={isLoadingMore}
              accessibilityRole="button"
              accessibilityLabel={t('list.pagination.showMore')}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Icon name="chevron-down" size={18} color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14 }}>
                    {t('list.pagination.showMore')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {t('list.pagination.showing', { shown: trips.length, total: totalTrips })}
            </Text>
          </View>
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
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[300],
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
    completedCardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    readOnlyBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
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
    advancedFilterPanel: {
      marginHorizontal: 20,
      marginTop: 8,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    advFilterRow: {
      gap: 6,
    },
    advFilterLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    advFilterInput: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
    },
    advFilterRowInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    advFilterInputHalf: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
    },
    advFilterActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    advFilterResetBtn: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    advFilterApplyBtn: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    loadMoreWrapper: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    loadMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
  });

export default TripListScreen;
