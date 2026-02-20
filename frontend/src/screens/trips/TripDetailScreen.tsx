/**
 * TripDetailScreen v3.0 - Refactored
 *
 * Orchestrator component that composes:
 * - TripHero: Hero image, trip info, action buttons
 * - ItineraryDayCard: Per-day cards with weather, progress, activities
 * - ActivityItem: Individual draggable activity cards (used inside ItineraryDayCard)
 * - CollaboratorSection: Collaborator list and invite modal
 * - tripDetailUtils: Shared utility functions
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { TripsStackParamList, Trip, Activity } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import { trackEvent } from '../../services/eventTracker';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { useConfirm } from '../../components/feedback/ConfirmDialog';
import { API_URL } from '../../constants/config';
import Button from '../../components/core/Button';
import { ActivityModal } from '../../components/ActivityModal';
import { ShareModal } from '../../components/ShareModal';
import { TripMapView } from '../../components/TripMapView';
import { BudgetSummary } from '../../components/BudgetSummary';
import TripPhotoGallery from '../../components/TripPhotoGallery';
import { AdBanner } from '../../components/ads';
import AffiliateLink from '../../components/ads/AffiliateLink';
import { getDestinationImageUrl } from '../../utils/images';
import TripHero from './TripHero';
import ItineraryDayCard from './ItineraryDayCard';
import CollaboratorSection from './CollaboratorSection';

type TripDetailScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'TripDetail'>;
type TripDetailScreenRouteProp = RouteProp<TripsStackParamList, 'TripDetail'>;

interface Props {
  navigation: TripDetailScreenNavigationProp;
  route: TripDetailScreenRouteProp;
}

const TripDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('trips');
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // Activity modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedItineraryId, setSelectedItineraryId] = useState<string>('');
  const [selectedActivityIndex, setSelectedActivityIndex] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | undefined>(undefined);

  // Share modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Collaboration state
  const [collaborators, setCollaborators] = useState<any[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'itinerary' | 'map' | 'expenses'>('itinerary');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ── Data fetching ─────────────────────────────────────

  const fetchTripDetails = useCallback(async () => {
    try {
      const data = await apiService.getTripById(tripId);
      setTrip(data);
      trackEvent('trip_viewed', { tripId });
    } catch (error) {
      showToast({ type: 'error', message: t('detail.alerts.fetchError'), position: 'top' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tripId, t]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  // Auto-refresh every 5 minutes for ongoing trips
  useEffect(() => {
    if (!trip || trip.status !== 'ongoing') return;
    const interval = setInterval(fetchTripDetails, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [trip?.status, fetchTripDetails]);

  // Fade-in animation
  useEffect(() => {
    if (!isLoading && trip) {
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
  }, [isLoading, trip]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchTripDetails();
  }, [fetchTripDetails]);

  // ── Collaborators ─────────────────────────────────────

  const fetchCollaborators = useCallback(async () => {
    try {
      const data = await apiService.getCollaborators(tripId);
      setCollaborators(data);
    } catch {
      setCollaborators([]);
    }
  }, [tripId]);

  useEffect(() => {
    if (trip) fetchCollaborators();
  }, [trip?.id, fetchCollaborators]);

  // ── Hero action handlers ──────────────────────────────

  const handleDuplicateTrip = useCallback(async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const newTrip = await apiService.duplicateTrip(tripId);
      trackEvent('trip_duplicated', { tripId });
      showToast({ type: 'success', message: t('detail.alerts.duplicateSuccess'), position: 'top' });
      navigation.navigate('TripDetail', { tripId: newTrip.id });
    } catch (error: any) {
      const msg = error.response?.data?.message || t('detail.alerts.duplicateError');
      showToast({ type: 'error', message: msg, position: 'top' });
    } finally {
      setIsDuplicating(false);
    }
  }, [isDuplicating, tripId, t, navigation]);

  const handleExportIcal = useCallback(() => {
    const url = apiService.getExportIcalUrl(tripId);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      import('react-native').then(({ Linking }) => Linking.openURL(url));
    }
  }, [tripId]);

  const handleChangeCoverPhoto = useCallback(async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const { url } = await apiService.uploadPhoto(result.assets[0].uri);
      await apiService.updateTrip(tripId, { coverImage: url } as any);
      setTrip((prev) => prev ? { ...prev, coverImage: url } : prev);
      trackEvent('cover_changed', { tripId });
    } catch {
      showToast({ type: 'error', message: t('detail.photos.uploadFailed'), position: 'top' });
    }
  }, [tripId, t, showToast]);

  // ── Activity handlers ─────────────────────────────────

  const handleAddActivity = useCallback((itineraryId: string) => {
    setSelectedItineraryId(itineraryId);
    setSelectedActivity(undefined);
    setSelectedActivityIndex(null);
    setModalMode('add');
    setModalVisible(true);
  }, []);

  const handleEditActivity = useCallback((itineraryId: string, activityIndex: number, activity: Activity) => {
    setSelectedItineraryId(itineraryId);
    setSelectedActivityIndex(activityIndex);
    setSelectedActivity(activity);
    setModalMode('edit');
    setModalVisible(true);
  }, []);

  const handleDeleteActivity = useCallback(async (itineraryId: string, activityIndex: number) => {
    const ok = await confirm({
      title: t('detail.alerts.deleteTitle'),
      message: t('detail.alerts.deleteMessage'),
      confirmText: t('detail.alerts.delete'),
      cancelText: t('detail.alerts.cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiService.deleteActivity(tripId, itineraryId, activityIndex);
      trackEvent('activity_deleted', { tripId });
      await fetchTripDetails();
      showToast({ type: 'success', message: t('detail.alerts.deleteSuccess'), position: 'top' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('detail.alerts.deleteError'), position: 'top' });
    }
  }, [tripId, t, fetchTripDetails, confirm, showToast]);

  const handleToggleActivityCompletion = useCallback(async (
    itineraryId: string,
    activityIndex: number,
    currentActivity: Activity
  ) => {
    try {
      const newCompletedStatus = !(currentActivity.completed ?? false);
      await apiService.updateActivity(tripId, itineraryId, activityIndex, {
        completed: newCompletedStatus,
      });
      await fetchTripDetails();
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('detail.alerts.toggleError'), position: 'top' });
    }
  }, [tripId, t, fetchTripDetails, showToast]);

  const handleSaveActivity = useCallback(async (activityData: Partial<Activity>) => {
    try {
      const { time, title, description, location, estimatedDuration, estimatedCost, actualCost, type } = activityData;
      const sanitizedData = { time, title, description, location, estimatedDuration, estimatedCost, actualCost, type };

      if (modalMode === 'add') {
        await apiService.addActivity(tripId, selectedItineraryId, sanitizedData);
      } else {
        if (selectedActivityIndex !== null) {
          await apiService.updateActivity(tripId, selectedItineraryId, selectedActivityIndex, sanitizedData);
        }
      }
      await fetchTripDetails();
      trackEvent(modalMode === 'add' ? 'activity_added' : 'activity_edited', { tripId });
      setModalVisible(false);
    } catch (error: any) {
      throw error;
    }
  }, [modalMode, tripId, selectedItineraryId, selectedActivityIndex, fetchTripDetails]);

  const handleReorderActivities = useCallback(async (itineraryId: string, newOrder: number[]) => {
    try {
      await apiService.reorderActivities(tripId, itineraryId, newOrder);
      await fetchTripDetails();
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('detail.alerts.reorderError'), position: 'top' });
    }
  }, [tripId, t, fetchTripDetails, showToast]);

  // ── Computed values ───────────────────────────────────

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const getDuration = (): number => {
    if (!trip) return 0;
    return Math.ceil(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  };

  // ── Loading state ─────────────────────────────────────

  if (isLoading) {
    const skelBg = isDark ? colors.neutral[700] : colors.neutral[200];
    const skelBase = isDark ? colors.neutral[800] : colors.neutral[100];
    return (
      <View style={styles.loadingContainer}>
        <View style={{ width: '100%', height: 220, backgroundColor: skelBase }} />
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ width: '70%', height: 22, borderRadius: 6, backgroundColor: skelBg }} />
          <View style={{ width: '40%', height: 16, borderRadius: 6, backgroundColor: skelBg }} />
          <View style={{ width: '55%', height: 14, borderRadius: 6, backgroundColor: skelBg, marginTop: 4 }} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {[80, 60, 60].map((w, i) => (
              <View key={i} style={{ width: w, height: 36, borderRadius: 18, backgroundColor: skelBg }} />
            ))}
          </View>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ backgroundColor: skelBase, borderRadius: 12, padding: 14, gap: 8, marginTop: 8 }}>
              <View style={{ width: '60%', height: 16, borderRadius: 4, backgroundColor: skelBg }} />
              <View style={{ width: '80%', height: 12, borderRadius: 4, backgroundColor: skelBg }} />
              <View style={{ width: '35%', height: 12, borderRadius: 4, backgroundColor: skelBg }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────

  if (!trip) {
    return (
      <View style={styles.errorContainer}>
        <View
          style={[
            styles.errorIconContainer,
            { backgroundColor: isDark ? colors.neutral[800] : colors.error.light },
          ]}
        >
          <Icon name="alert-circle-outline" size={60} color={colors.error.main} />
        </View>
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
          {t('detail.notFound.title')}
        </Text>
        <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
          {t('detail.notFound.description')}
        </Text>
        <View style={styles.errorButtonWrapper}>
          <Button variant="primary" size="md" icon="arrow-left" onPress={() => navigation.goBack()}>
            {t('detail.notFound.back')}
          </Button>
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────

  const imageUrl = trip.coverImage
    ? (trip.coverImage.startsWith('http') ? trip.coverImage : `${API_URL.replace('/api', '')}${trip.coverImage}`)
    : getDestinationImageUrl(trip.destination, { width: 800 });
  const duration = getDuration();

  // On web, GestureHandlerRootView intercepts touch events and breaks native scroll
  const RootWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <RootWrapper style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Completed Trip Banner */}
        {trip.status === 'completed' && (
          <View style={[styles.completedBanner, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] }]}>
            <Icon name="lock" size={20} color={colors.neutral[500]} />
            <View style={styles.completedBannerTextContainer}>
              <Text style={[styles.completedBannerTitle, { color: theme.colors.text }]}>
                {t('detail.completedBanner.title')}
              </Text>
              <Text style={[styles.completedBannerMessage, { color: theme.colors.textSecondary }]}>
                {t('detail.completedBanner.description')}
              </Text>
            </View>
          </View>
        )}

        {/* Hero Section */}
        <TripHero
          trip={trip}
          imageUrl={imageUrl}
          duration={duration}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
          isDuplicating={isDuplicating}
          onGoBack={() => navigation.goBack()}
          onEdit={() => navigation.navigate('EditTrip', { tripId: trip.id })}
          onDuplicate={handleDuplicateTrip}
          onExportIcal={handleExportIcal}
          onChangeCoverPhoto={handleChangeCoverPhoto}
          onShare={() => { trackEvent('trip_shared', { tripId: trip.id }); setShareModalVisible(true); }}
        />

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
          {/* Tab Bar */}
          <View style={[styles.tabBar, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'itinerary' && styles.tabActive]}
              onPress={() => setActiveTab('itinerary')}
            >
              <Icon name="calendar-text" size={18} color={activeTab === 'itinerary' ? colors.primary[500] : colors.neutral[400]} />
              <Text style={[styles.tabText, activeTab === 'itinerary' && styles.tabTextActive]}>
                {t('detail.tabs.itinerary')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'map' && styles.tabActive]}
              onPress={() => setActiveTab('map')}
            >
              <Icon name="map-outline" size={18} color={activeTab === 'map' ? colors.primary[500] : colors.neutral[400]} />
              <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>
                {t('detail.tabs.map')}
              </Text>
            </TouchableOpacity>
            {collaborators.length > 0 && (
              <TouchableOpacity
                style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
                onPress={() => navigation.navigate('Expenses', { tripId })}
              >
                <Icon name="wallet-outline" size={18} color={activeTab === 'expenses' ? colors.primary[500] : colors.neutral[400]} />
                <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
                  {t('detail.expenses.title')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Map View */}
          {activeTab === 'map' && (
            <TripMapView
              itineraries={trip.itineraries}
              destination={trip.destination}
            />
          )}

          {/* Trip Description */}
          {activeTab === 'itinerary' && trip.description && (
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

          {/* Photo Gallery */}
          {activeTab === 'itinerary' && <TripPhotoGallery trip={trip} />}

          {/* Budget Summary */}
          {activeTab === 'itinerary' && <BudgetSummary trip={trip} />}

          {/* Affiliate Links — Accommodations */}
          {activeTab === 'itinerary' && (
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
                <Icon name="bed" size={20} color={theme.colors.primary} />
                <Text style={[styles.affiliateSectionTitle, { color: theme.colors.text }]}>
                  {t('detail.affiliateAccom', { defaultValue: t('detail.affiliateSection') })}
                </Text>
              </View>
              <Text style={[styles.affiliateSectionSubtitle, { color: theme.colors.textSecondary }]}>
                {t('detail.affiliateSubtitle', { destination: trip.destination })}
              </Text>
              <View style={styles.affiliateButtons}>
                <AffiliateLink provider="booking" destination={trip.destination} checkIn={trip.startDate} checkOut={trip.endDate} travelers={trip.numberOfTravelers} tripId={trip.id} variant="primary" size="medium" style={styles.affiliateButton} />
                <AffiliateLink provider="expedia" destination={trip.destination} checkIn={trip.startDate} checkOut={trip.endDate} travelers={trip.numberOfTravelers} tripId={trip.id} variant="outline" size="medium" style={styles.affiliateButton} />
              </View>
            </Animated.View>
          )}

          {/* Affiliate Links — Experiences & Tours */}
          {activeTab === 'itinerary' && (
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
                <Icon name="ticket-outline" size={20} color={colors.secondary[500]} />
                <Text style={[styles.affiliateSectionTitle, { color: theme.colors.text }]}>
                  {t('detail.affiliateExperience', { defaultValue: 'Tours & Activities' })}
                </Text>
              </View>
              <View style={styles.affiliateButtons}>
                <AffiliateLink provider="viator" destination={trip.destination} tripId={trip.id} variant="outline" size="medium" style={styles.affiliateButton} />
                <AffiliateLink provider="klook" destination={trip.destination} tripId={trip.id} variant="outline" size="medium" style={styles.affiliateButton} />
              </View>
            </Animated.View>
          )}

          {/* Ad Banner */}
          {activeTab === 'itinerary' && (
            <AdBanner size="adaptive" style={{ marginHorizontal: 16 }} />
          )}

          {/* Itineraries */}
          {activeTab === 'itinerary' && (
            trip.itineraries.length > 0 ? (
              trip.itineraries
                .sort((a, b) => a.dayNumber - b.dayNumber)
                .map((itinerary) => (
                  <ItineraryDayCard
                    key={itinerary.id}
                    itinerary={itinerary}
                    dayIndex={itinerary.dayNumber - 1}
                    tripStatus={trip.status}
                    fadeAnim={fadeAnim}
                    canAddActivity={trip.status !== 'completed'}
                    onAddActivity={handleAddActivity}
                    onEditActivity={handleEditActivity}
                    onDeleteActivity={handleDeleteActivity}
                    onToggleCompletion={handleToggleActivityCompletion}
                    onReorderActivities={handleReorderActivities}
                  />
                ))
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
                    { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] },
                  ]}
                >
                  <Icon name="calendar-blank" size={60} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {t('detail.emptyItinerary')}
                </Text>
                <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
                  {t('detail.emptyItineraryMessage')}
                </Text>
              </Animated.View>
            )
          )}

          {/* Bottom Ad Banner */}
          {activeTab === 'itinerary' && trip.itineraries.length > 0 && (
            <AdBanner size="banner" style={{ marginHorizontal: 16 }} />
          )}

          {/* Collaboration Section */}
          <CollaboratorSection
            tripId={tripId}
            collaborators={collaborators}
            onRefreshCollaborators={fetchCollaborators}
          />

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
    </RootWrapper>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      ...(Platform.OS === 'web' ? { overflow: 'hidden' as const } : {}),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
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
    tabBar: {
      flexDirection: 'row',
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      padding: 4,
      ...theme.shadows.sm,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: isDark ? colors.primary[900] : colors.primary[50],
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.neutral[400],
    },
    tabTextActive: {
      color: colors.primary[500],
    },
  });

export default TripDetailScreen;
