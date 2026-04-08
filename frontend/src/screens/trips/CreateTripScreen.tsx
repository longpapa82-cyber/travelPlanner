/**
 * CreateTripScreen v2.0 - 2025 Design
 *
 * Complete redesign with:
 * - Inspiring hero section with travel imagery
 * - Popular destination quick picks
 * - Duration quick picks (3 days, 1 week, 2 weeks)
 * - Traveler quick picks (1, 2, 3-4, 5+)
 * - Modern input design with visual feedback
 * - Trip duration calculator
 * - Smooth animations
 * - Dark mode support
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Animated,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { TripsStackParamList } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import { trackEvent } from '../../services/eventTracker';
import { useNotifications } from '../../contexts/NotificationContext';
import Button from '../../components/core/Button';
import DatePickerField from '../../components/core/DatePicker';
import DestinationInsights from '../../components/DestinationInsights';
import { useInterstitialAd, useRewardedAd } from '../../components/ads';
import { usePremium } from '../../contexts/PremiumContext';
import { getHeroImageUrl } from '../../utils/images';

type CreateTripScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'CreateTrip'>;

type CreateTripScreenRouteProp = RouteProp<TripsStackParamList, 'CreateTrip'>;

interface Props {
  navigation: CreateTripScreenNavigationProp;
  route: CreateTripScreenRouteProp;
}

// Popular destination suggestions
const getPopularDestinations = (t: TFunction) => [
  { name: t('create.destinations.tokyo'), icon: 'temple-buddhist', color: colors.travel.sunset },
  { name: t('create.destinations.osaka'), icon: 'eiffel-tower', color: colors.travel.forest },
  { name: t('create.destinations.newyork'), icon: 'city', color: colors.travel.ocean },
  { name: t('create.destinations.bangkok'), icon: 'palm-tree', color: colors.travel.sunset },
  { name: t('create.destinations.london'), icon: 'bridge', color: colors.neutral[600] },
  { name: t('create.destinations.barcelona'), icon: 'beach', color: colors.warning.main },
];

// Duration quick picks (in days)
const getDurationOptions = (t: TFunction) => [
  { days: 3, label: t('create.duration.options.3days'), icon: 'calendar-week' },
  { days: 7, label: t('create.duration.options.1week'), icon: 'calendar-week-begin' },
  { days: 14, label: t('create.duration.options.2weeks'), icon: 'calendar-month' },
  { days: 30, label: t('create.duration.options.1month'), icon: 'calendar-multiple' },
];

// Traveler quick picks
const getTravelerOptions = (t: TFunction) => [
  { count: 1, label: t('create.travelers.options.solo'), icon: 'account' },
  { count: 2, label: t('create.travelers.options.two'), icon: 'account-multiple' },
  { count: 4, label: t('create.travelers.options.group'), icon: 'account-group' },
  { count: 6, label: t('create.travelers.options.large'), icon: 'account-supervisor' },
];

const CreateTripScreen: React.FC<Props> = ({ navigation, route }) => {
  const [planningMode, setPlanningMode] = useState<'ai' | 'manual'>('ai');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [description, setDescription] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState('USD');
  const [prefBudget, setPrefBudget] = useState<string>('');
  const [prefStyle, setPrefStyle] = useState<string>('');
  const [prefInterests, setPrefInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{ destination?: string; dates?: string }>({});
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { scheduleTripReminders } = useNotifications();
  const { t } = useTranslation('trips');
  const { show: showInterstitial, isLoaded: isAdLoaded } = useInterstitialAd();
  const { isPremium, isAdmin, aiTripsRemaining, aiTripsLimit, isAiLimitReached, refreshStatus, showPaywall } = usePremium();
  const { show: showRewarded, isLoaded: isRewardedLoaded, reload: reloadRewardedAd } = useRewardedAd();
  const [insightsUnlocked, setInsightsUnlocked] = useState(false);

  // Restore state after Android Activity recreation (rewarded ad lifecycle)
  useEffect(() => {
    // Check if returning from rewarded ad with persisted state
    AsyncStorage.getItem('@rewarded_ad_destination').then((savedDest) => {
      if (savedDest) {
        setDestination(savedDest);
        setInsightsUnlocked(true);
        // Clean up
        AsyncStorage.multiRemove(['@rewarded_ad_destination']).catch(() => {});
      }
    });
  }, []);
  const [showAiConsent, setShowAiConsent] = useState(false);
  const [aiConsentGiven, setAiConsentGiven] = useState(false);
  const [isShowingRewardedAd, setIsShowingRewardedAd] = useState(false);

  // Check if AI consent was previously given and preload rewarded ad
  useEffect(() => {
    AsyncStorage.getItem('@travelplanner:ai_consent').then((val) => {
      if (val === 'true') setAiConsentGiven(true);
    }).catch(() => {});

    // Preload rewarded ad on screen mount
    if (!isRewardedLoaded) {
      console.log('[CreateTripScreen] Preloading rewarded ad on mount');
      reloadRewardedAd();
    }
  }, []);

  // Auto-switch to manual mode when AI limit is reached
  useEffect(() => {
    if (isAiLimitReached && planningMode === 'ai') {
      setPlanningMode('manual');
    }
  }, [isAiLimitReached]);

  const doCreateTripRef = useRef<(() => Promise<void>) | null>(null);

  const handleAiConsentAccept = useCallback(async () => {
    setAiConsentGiven(true);
    setShowAiConsent(false);
    await AsyncStorage.setItem('@travelplanner:ai_consent', 'true').catch(() => {});
    // Resume trip creation after consent (use ref to avoid stale closure)
    doCreateTripRef.current?.();
  }, []);

  const POPULAR_DESTINATIONS = getPopularDestinations(t);
  const DURATION_OPTIONS = getDurationOptions(t);

  // 여행 생성 시 최소 출발일은 내일부터
  const minStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const TRAVELER_OPTIONS = getTravelerOptions(t);

  // Auto-fill preferences from user profile
  useEffect(() => {
    apiService.getProfile().then((profile: any) => {
      if (profile?.travelPreferences) {
        const prefs = profile.travelPreferences;
        if (prefs.budget) setPrefBudget(prefs.budget);
        if (prefs.travelStyle) setPrefStyle(prefs.travelStyle);
        if (prefs.interests?.length) setPrefInterests(prefs.interests);
      }
    }).catch(() => {});
  }, []);

  // Pre-fill from navigation params (popular/featured destination clicks)
  useEffect(() => {
    const params = route.params;
    if (!params) return;
    if (params.destination) handleSelectDestination(params.destination);
    if (params.duration) handleSelectDuration(params.duration);
    if (params.travelers) handleSelectTravelers(params.travelers);
  }, [route.params]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
  }, []);

  const toggleInterest = (interest: string) => {
    setPrefInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const handleSelectDestination = (dest: string) => {
    setDestination(dest);
    if (dest.trim()) setFieldErrors(prev => ({ ...prev, destination: undefined }));
  };

  const handleSelectDuration = (days: number) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    const end = new Date(tomorrow);
    end.setDate(end.getDate() + days - 1);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setFieldErrors(prev => ({ ...prev, dates: undefined }));
  };

  const handleSelectTravelers = (count: number) => {
    setNumberOfTravelers(Math.min(count, 50));
  };

  const calculateDuration = (): number | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  const handleCreateTrip = async () => {
    // ✅ FIX: Prevent duplicate requests from double-tap
    if (isLoading || isCreatingRef.current) {
      return; // Block concurrent calls
    }

    // Inline validation
    const errors: { destination?: string; dates?: string } = {};
    if (!destination.trim()) {
      errors.destination = t('create.alerts.destinationRequired');
    }
    if (!startDate || !endDate) {
      errors.dates = t('create.alerts.datesRequired');
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        errors.dates = t('create.alerts.startDateRequired');
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    // Check AI trip limit for free users — show paywall instead of toast
    if (planningMode === 'ai' && isAiLimitReached) {
      showPaywall('ai_limit');
      return;
    }

    // Show AI consent modal on first AI usage (Apple App Store requirement)
    if (planningMode === 'ai' && !aiConsentGiven) {
      setShowAiConsent(true);
      return;
    }

    doCreateTrip();
  };

  // Map SSE step names to UI step indices
  const STEP_MAP: Record<string, number> = {
    validating: 0,
    weather: 1,
    ai_generating: 2,
    geocoding: 2,
    saving: 3,
    complete: 3,
  };

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutWarningRef = useRef<NodeJS.Timeout | null>(null);
  const isCreatingRef = useRef(false); // Guard: Prevent duplicate creation from rapid clicks
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancelCreation = useCallback(() => {
    abortControllerRef.current?.abort();
    setShowCancelConfirm(false);
    setIsLoading(false);
    setGenerationStep(0);
    isCreatingRef.current = false; // Reset guard on cancel
    if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
  }, []);

  const doCreateTrip = async () => {
    // Double-check loading state to prevent race conditions
    if (isLoading || isCreatingRef.current) {
      return;
    }

    // Set guards immediately
    isCreatingRef.current = true;
    setIsLoading(true);
    setGenerationStep(0);
    progressAnim.setValue(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Timeout warnings for AI mode
    if (planningMode === 'ai') {
      Animated.timing(progressAnim, {
        toValue: 0.1,
        duration: 400,
        useNativeDriver: false,
      }).start();

      // 60s warning toast
      timeoutWarningRef.current = setTimeout(() => {
        if (abortController.signal.aborted) return;
        showToast({
          type: 'warning',
          message: t('create.progress.takingLong', { defaultValue: 'AI generation is taking longer than usual...' }),
          position: 'top',
          duration: 5000,
        });

        // 120s cancel confirmation
        timeoutWarningRef.current = setTimeout(() => {
          if (abortController.signal.aborted) return;
          setShowCancelConfirm(true);
        }, 60000);
      }, 60000);
    }

    try {
      const budgetNum = totalBudget ? parseFloat(totalBudget) : undefined;
      const preferences: any = {};
      if (prefBudget) preferences.budget = prefBudget;
      if (prefStyle) preferences.travelStyle = prefStyle;
      if (prefInterests.length > 0) preferences.interests = prefInterests;

      const validBudget = budgetNum && Number.isFinite(budgetNum) && budgetNum > 0;
      const tripData = {
        destination: destination.trim(),
        startDate,
        endDate,
        numberOfTravelers,
        description: description.trim() || undefined,
        totalBudget: validBudget ? budgetNum : undefined,
        budgetCurrency: validBudget ? budgetCurrency : undefined,
        preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
        planningMode,
      };

      // Use polling-based progress tracking (Railway SSE workaround)
      const trip = await apiService.createTripWithPolling(
        tripData,
        (step: string) => {
          const stepIndex = STEP_MAP[step] ?? 0;
          setGenerationStep(stepIndex);
          const progress = (stepIndex + 1) / 5;
          Animated.timing(progressAnim, {
            toValue: progress,
            duration: 400,
            useNativeDriver: false,
          }).start();
        },
        abortController.signal,
      );

      // Complete the progress bar
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Refresh subscription status so AI remaining count updates
      await refreshStatus();

      // Show pre-warning when user has 1 AI trip left after this one
      if (!isPremium && aiTripsRemaining === 2) {
        // After this trip, only 1 remains
        showToast({
          type: 'info',
          message: t('create.aiInfo.remaining', { remaining: 1, total: aiTripsLimit > 0 ? aiTripsLimit : 3 }),
          position: 'top',
          duration: 4000,
        });
      }

      // Schedule trip reminder notifications
      scheduleTripReminders(trip).catch(() => {});
      trackEvent('trip_created', { destination: destination.trim() });

      // Auto-save preferences to user profile (non-blocking)
      if (Object.keys(preferences).length > 0) {
        apiService.updateTravelPreferences(preferences).catch(() => {});
      }

      // Show AI failure warning if AI generation failed
      if (trip.aiStatus === 'failed') {
        showToast({
          type: 'warning',
          message: t('create.aiFallbackWarning', { defaultValue: 'AI 일정 생성에 실패했습니다. 수동으로 활동을 추가해주세요.' }),
          position: 'top',
          duration: 4000,
        });
      } else {
        showToast({
          type: 'success',
          message: t('create.generating'),
          position: 'top',
          duration: 2000,
        });
      }

      // Show interstitial ad after trip creation (skip for premium), then navigate
      setTimeout(async () => {
        // Ensure tripId exists before navigation
        if (!trip?.id) {
          console.error('[CreateTripScreen] Trip created but no ID received:', trip);
          showToast({
            type: 'error',
            message: t('create.alerts.createFailed'),
            position: 'top',
            duration: 4000,
          });
          setIsLoading(false);
          isCreatingRef.current = false;
          return;
        }

        // Show ad (non-blocking with timeout) then navigate
        if (!isPremium && !isAdmin && isAdLoaded) {
          try {
            // Race between ad completion and 10s timeout to prevent white screen
            await Promise.race([
              showInterstitial(),
              new Promise(resolve => setTimeout(resolve, 10000)),
            ]);
          } catch (error) {
            console.warn('[CreateTripScreen] Interstitial ad failed:', error);
          }
        }

        // Navigate to trip detail after ad completes (or immediately if no ad)
        // Clean up persisted insights state
        if (destination) AsyncStorage.removeItem(`@insights_unlocked_${destination}`).catch(() => {});

        // Navigate to TripDetail, falling back to TripList if navigation fails
        console.log('[CreateTripScreen] Navigating to TripDetail with tripId:', trip.id);
        try {
          navigation.reset({
            index: 1,
            routes: [
              { name: 'TripList' },
              { name: 'TripDetail', params: { tripId: trip.id } },
            ],
          });
        } catch (navError) {
          console.warn('[CreateTripScreen] Navigation reset failed, trying navigate:', navError);
          navigation.navigate('TripList' as any);
        }

        // Reset guards after successful navigation
        setIsLoading(false);
        isCreatingRef.current = false;
      }, 500);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        showToast({
          type: 'info',
          message: t('create.progress.cancelled', { defaultValue: 'Trip creation cancelled' }),
          position: 'top',
          duration: 3000,
        });
        // Reset guards after cancel
        setIsLoading(false);
        isCreatingRef.current = false;
        return;
      }

      // Check if trip was created but stream interrupted
      if (error.tripCreated) {
        // Log error to backend for admin visibility
        apiService.reportError({
          errorMessage: error.message || 'SSE stream interrupted after trip creation',
          screen: 'CreateTripScreen',
          severity: 'warning',
        }).catch(() => {});

        // 🔧 FIX: Refresh subscription status to update AI trip count
        await refreshStatus();

        // 🔧 FIX: Try to fetch the recently created trip
        try {
          const trips = await apiService.getTrips({
            sortBy: 'createdAt',
            order: 'DESC',
            limit: 1
          });

          if (trips?.data && trips.data.length > 0) {
            const latestTrip = trips.data[0];
            const tripCreatedAt = new Date(latestTrip.createdAt).getTime();
            const now = Date.now();

            if (now - tripCreatedAt < 10000) {
              // ✅ Found the recently created trip - navigate to TripDetail
              showToast({
                type: 'success',
                message: t('create.generating'),
                position: 'top',
                duration: 2000,
              });

              // Show interstitial ad after trip creation (skip for premium), then navigate
              setTimeout(async () => {
                // Ensure tripId exists before navigation
                if (!latestTrip?.id) {
                  console.error('[CreateTripScreen] Latest trip found but no ID:', latestTrip);
                  navigation.navigate('TripList');
                  setIsLoading(false);
                  isCreatingRef.current = false;
                  return;
                }

                // Show ad in parallel with navigation (non-blocking)
                if (!isPremium && !isAdmin && isAdLoaded) {
                  // Don't await - let ad show in parallel with navigation
                  showInterstitial().catch((error) => {
                    console.warn('[CreateTripScreen] Interstitial ad failed:', error);
                    // Continue with navigation even if ad fails
                  });
                }

                // Navigate immediately, don't wait for ad
                console.log('[CreateTripScreen] Navigating to TripDetail with tripId:', latestTrip.id);
                navigation.navigate('TripDetail', { tripId: latestTrip.id });

                // Reset guards after successful navigation
                setIsLoading(false);
                isCreatingRef.current = false;
              }, 500);
              return;
            }
          }
        } catch (fetchError) {
          // If fetching fails, fall through to showing warning and navigating to TripList
        }

        // If we couldn't find the trip, show warning and navigate to TripList
        showToast({
          type: 'warning',
          message: t('create.alerts.streamInterrupted', {
            defaultValue: 'Trip created but connection interrupted. Please check your trips list.'
          }),
          position: 'top',
          duration: 5000,
        });
        // Navigate to trips list after short delay
        setTimeout(() => {
          navigation.navigate('TripList');
          // Reset guards after navigation
          setIsLoading(false);
          isCreatingRef.current = false;
        }, 2000);
        return;
      }

      const serverMsg = error.response?.data?.message || '';
      // Map backend English error to i18n message
      const message = serverMsg.includes('AI generation limit')
        ? t('create.aiInfo.limitReached', { total: aiTripsLimit > 0 ? aiTripsLimit : 3 })
        : serverMsg || t('create.alerts.createFailed');

      // Log error to backend for admin visibility
      apiService.reportError({
        errorMessage: error.message || message,
        screen: 'CreateTripScreen',
        severity: 'error',
        stackTrace: error.stack,
      }).catch(() => {});

      // Refresh subscription status so AI remaining count is accurate
      await refreshStatus();

      showToast({
        type: 'error',
        message,
        position: 'top',
        duration: 4000,
      });

      // Reset guards after error shown
      setIsLoading(false);
      isCreatingRef.current = false;
    } finally {
      // Clean up resources but DON'T reset guards here
      // Guards are reset only in specific places above (success/error/cancel)
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
      abortControllerRef.current = null;
      setGenerationStep(0);
      setShowCancelConfirm(false);
    }
  };

  // Keep ref in sync so handleAiConsentAccept always calls latest doCreateTrip
  doCreateTripRef.current = doCreateTrip;

  // Clean up timers and abort controller on unmount
  useEffect(() => {
    return () => {
      if (timeoutWarningRef.current) clearTimeout(timeoutWarningRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const duration = calculateDuration();

  const styles = createStyles(theme, isDark);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <ImageBackground
          source={{
            uri: getHeroImageUrl('createTrip', { width: 1200 }),
          }}
          style={styles.hero}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)']}
            style={styles.heroGradient}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={t('common:back', { defaultValue: 'Go back' })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.backButtonInner}>
                <Icon name="arrow-left" size={24} color={colors.neutral[0]} />
              </View>
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.heroContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.heroTitle}>{t('create.hero.title')}</Text>
              <Text style={styles.heroSubtitle}>
                {t('create.hero.subtitle')}
              </Text>
            </Animated.View>
          </LinearGradient>
        </ImageBackground>

        {/* Form Section */}
        <Animated.View
          style={[
            styles.formSection,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Planning Mode Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="lightbulb-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.mode.title')}
              </Text>
            </View>
            <View style={styles.modeCards}>
              {/* AI Mode Card */}
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: planningMode === 'ai'
                      ? `${theme.colors.primary}15`
                      : isDark ? colors.neutral[800] : colors.neutral[0],
                    borderColor: planningMode === 'ai'
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderWidth: planningMode === 'ai' ? 2 : 1,
                    opacity: isAiLimitReached ? 0.5 : 1,
                  },
                ]}
                onPress={() => !isAiLimitReached && setPlanningMode('ai')}
                disabled={isLoading || isAiLimitReached}
                accessibilityRole="button"
                accessibilityLabel={t('create.mode.ai')}
                accessibilityState={{ selected: planningMode === 'ai', disabled: isAiLimitReached }}
              >
                <Icon
                  name="robot"
                  size={28}
                  color={planningMode === 'ai' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeCardTitle,
                    {
                      color: planningMode === 'ai' ? theme.colors.primary : theme.colors.text,
                    },
                  ]}
                >
                  {t('create.mode.ai')}
                </Text>
                <Text
                  style={[
                    styles.modeCardDesc,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('create.mode.aiDesc')}
                </Text>
                {isAiLimitReached && (
                  <Text style={[styles.modeCardDesc, { color: colors.error?.main || '#EF4444', marginTop: 4, fontWeight: '600', fontSize: 11 }]}>
                    {t('create.aiInfo.limitReached', { total: aiTripsLimit > 0 ? aiTripsLimit : 3 })}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Manual Mode Card */}
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: planningMode === 'manual'
                      ? `${theme.colors.primary}15`
                      : isDark ? colors.neutral[800] : colors.neutral[0],
                    borderColor: planningMode === 'manual'
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderWidth: planningMode === 'manual' ? 2 : 1,
                  },
                ]}
                onPress={() => setPlanningMode('manual')}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={t('create.mode.manual')}
                accessibilityState={{ selected: planningMode === 'manual' }}
              >
                <Icon
                  name="pencil-ruler"
                  size={28}
                  color={planningMode === 'manual' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeCardTitle,
                    {
                      color: planningMode === 'manual' ? theme.colors.primary : theme.colors.text,
                    },
                  ]}
                >
                  {t('create.mode.manual')}
                </Text>
                <Text
                  style={[
                    styles.modeCardDesc,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('create.mode.manualDesc')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Destination */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="map-marker" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.destination.title')}
              </Text>
            </View>

            {/* Popular Destinations */}
            <View style={styles.quickPicks}>
              {POPULAR_DESTINATIONS.map((dest, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickPickChip,
                    {
                      backgroundColor:
                        destination === dest.name
                          ? theme.colors.primary
                          : isDark
                          ? colors.neutral[800]
                          : colors.neutral[100],
                      borderColor:
                        destination === dest.name
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  onPress={() => handleSelectDestination(dest.name)}
                  accessibilityRole="button"
                  accessibilityLabel={dest.name}
                  accessibilityState={{ selected: destination === dest.name }}
                >
                  <Icon
                    name={dest.icon}
                    size={16}
                    color={
                      destination === dest.name
                        ? colors.neutral[0]
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.quickPickText,
                      {
                        color:
                          destination === dest.name
                            ? colors.neutral[0]
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {dest.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Destination Input */}
            <View style={[styles.inputWrapper, fieldErrors.destination && styles.inputError]}>
              <View style={styles.inputIconContainer}>
                <Icon name="magnify" size={20} color={fieldErrors.destination ? colors.error.main : theme.colors.textSecondary} />
              </View>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('create.destination.placeholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={destination}
                onChangeText={(text) => {
                  setDestination(text);
                  if (text.trim()) setFieldErrors(prev => ({ ...prev, destination: undefined }));
                }}
                editable={!isLoading}
                autoCapitalize="words"
                accessibilityLabel={t('create.destination.title')}
              />
            </View>
            {fieldErrors.destination && (
              <Text style={styles.errorText}>{fieldErrors.destination}</Text>
            )}

            {/* Destination Insights */}
            {destination && destination.trim().length >= 2 && (
              <DestinationInsights
                destination={destination}
                showEnhancedInsights={insightsUnlocked}
                onRecommendationsLoaded={(recommendations) => {
                  // Auto-fill recommended values
                  if (recommendations.recommendedDuration && !startDate && !endDate) {
                    handleSelectDuration(Math.min(recommendations.recommendedDuration, 90));
                  }
                  if (recommendations.recommendedTravelers && numberOfTravelers === 1) {
                    handleSelectTravelers(recommendations.recommendedTravelers);
                  }
                }}
              />
            )}

            {/* Rewarded Ad — unlock extra insights */}
            {destination.trim().length >= 2 && !insightsUnlocked && (
              <TouchableOpacity
                style={[
                  styles.rewardedAdButton,
                  {
                    backgroundColor: isDark ? `${colors.warning.main}20` : `${colors.warning.main}10`,
                    borderColor: colors.warning.main,
                    opacity: !isRewardedLoaded || isShowingRewardedAd ? 0.5 : 1,
                  },
                ]}
                onPress={async () => {
                  if (isShowingRewardedAd) {
                    console.log('[CreateTripScreen] Already showing rewarded ad, ignoring click');
                    return;
                  }

                  console.log('[CreateTripScreen] Rewarded ad button clicked', {
                    isLoaded: isRewardedLoaded,
                    isShowingAd: isShowingRewardedAd,
                    isDev: __DEV__,
                    platform: Platform.OS
                  });

                  // Enhanced error handling with better user feedback
                  if (!isRewardedLoaded) {
                    console.log('[CreateTripScreen] Ad not loaded, handling fallback');

                    // Development/Web fallback - unlock insights without ad
                    if (__DEV__ || Platform.OS === 'web') {
                      setInsightsUnlocked(true);
                      showToast({
                        type: 'info',
                        message: t('create.rewardedAd.devMode', {
                          defaultValue: '개발 모드: 인사이트가 잠금 해제되었습니다',
                        }),
                        position: 'top',
                        duration: 2000,
                      });
                      return;
                    }

                    // Production: Try to reload the ad with user feedback
                    console.log('[CreateTripScreen] Production mode: attempting to reload ad');
                    showToast({
                      type: 'info',
                      message: t('create.rewardedAd.loading', {
                        defaultValue: '광고를 불러오는 중입니다...',
                      }),
                      position: 'top',
                      duration: 2000,
                    });

                    // Attempt to reload and wait briefly
                    reloadRewardedAd();

                    // Wait 3 seconds for ad to load
                    setTimeout(() => {
                      if (!isRewardedLoaded) {
                        showToast({
                          type: 'warning',
                          message: t('create.rewardedAd.notAvailable', {
                            defaultValue: '광고를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
                          }),
                          position: 'top',
                          duration: 3000,
                        });
                      }
                    }, 3000);
                    return;
                  }

                  try {
                    console.log('[CreateTripScreen] Starting to show rewarded ad');
                    setIsShowingRewardedAd(true);

                    // Fire-and-forget: don't await the ad show.
                    // Android may destroy the Activity during ad display,
                    // causing the await to never resolve or resolve in wrong context.
                    // The reward callback handles everything we need.
                    showRewarded(() => {
                      console.log('[CreateTripScreen] Reward earned, unlocking insights');
                      setInsightsUnlocked(true);
                      setIsShowingRewardedAd(false);
                      showToast({
                        type: 'success',
                        message: t('create.rewardedAd.success', {
                          defaultValue: '상세 인사이트가 잠금 해제되었습니다!',
                        }),
                        position: 'top',
                        duration: 2000,
                      });
                    }).catch((error) => {
                      console.error('[CreateTripScreen] Rewarded ad error:', error);
                      setInsightsUnlocked(true);
                      setIsShowingRewardedAd(false);
                      showToast({
                        type: 'warning',
                        message: t('create.rewardedAd.errorButUnlocked', {
                          defaultValue: '광고 로드에 실패했지만 인사이트가 잠금 해제되었습니다',
                        }),
                        position: 'top',
                        duration: 3000,
                      });
                    });
                  } catch (error) {
                    console.error('[CreateTripScreen] Rewarded ad sync error:', error);
                    setInsightsUnlocked(true);
                    setIsShowingRewardedAd(false);
                  }
                }}
                disabled={isShowingRewardedAd}
                accessibilityRole="button"
                accessibilityLabel={t('create.rewardedAd.label')}
              >
                <Icon name="gift-outline" size={20} color={colors.warning.main} />
                <Text style={[styles.rewardedAdText, { color: theme.colors.text }]}>
                  {t('create.rewardedAd.label')}
                </Text>
                {isShowingRewardedAd ? (
                  <ActivityIndicator size="small" color={colors.warning.main} />
                ) : (
                  <Icon name="play-circle-outline" size={18} color={colors.warning.main} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="calendar-range" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.duration.title')}
              </Text>
            </View>

            {/* Duration Quick Picks */}
            <View style={styles.quickPicks}>
              {DURATION_OPTIONS.map((option, index) => {
                const isSelected = calculateDuration() === option.days;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.quickPickChip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : isDark
                          ? colors.neutral[800]
                          : colors.neutral[100],
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                    ]}
                    onPress={() => handleSelectDuration(option.days)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Icon
                      name={option.icon}
                      size={16}
                      color={
                        isSelected
                          ? colors.neutral[0]
                          : theme.colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.quickPickText,
                        {
                          color: isSelected
                            ? colors.neutral[0]
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date Inputs */}
            <View style={styles.dateRow}>
              <DatePickerField
                label={t('create.dates.start')}
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  if (val && endDate) setFieldErrors(prev => ({ ...prev, dates: undefined }));
                }}
                minimumDate={minStartDate}
                disabled={isLoading}
              />
              <Icon
                name="arrow-right"
                size={20}
                color={theme.colors.textSecondary}
                style={styles.dateArrow}
              />
              <DatePickerField
                label={t('create.dates.end')}
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  if (startDate && val) setFieldErrors(prev => ({ ...prev, dates: undefined }));
                }}
                minimumDate={startDate ? new Date(startDate + 'T00:00:00') : minStartDate}
                disabled={isLoading}
              />
            </View>
            {fieldErrors.dates && (
              <Text style={styles.errorText}>{fieldErrors.dates}</Text>
            )}

            {/* Duration Display */}
            {duration && duration > 0 && (
              <View style={styles.durationDisplay}>
                <Icon name="calendar" size={16} color={theme.colors.primary} />
                <Text style={[styles.durationText, { color: theme.colors.primary }]}>
                  {t('create.duration.totalDays', { days: duration })}
                </Text>
              </View>
            )}
          </View>

          {/* Travelers */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="account-group" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.travelers.title')}
              </Text>
            </View>

            {/* Traveler Quick Picks */}
            <View style={styles.quickPicks}>
              {TRAVELER_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickPickChip,
                    {
                      backgroundColor:
                        numberOfTravelers === option.count
                          ? theme.colors.primary
                          : isDark
                          ? colors.neutral[800]
                          : colors.neutral[100],
                      borderColor:
                        numberOfTravelers === option.count
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  onPress={() => handleSelectTravelers(option.count)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: numberOfTravelers === option.count }}
                >
                  <Icon
                    name={option.icon}
                    size={16}
                    color={
                      numberOfTravelers === option.count
                        ? colors.neutral[0]
                        : theme.colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.quickPickText,
                      {
                        color:
                          numberOfTravelers === option.count
                            ? colors.neutral[0]
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Number Input */}
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <Icon name="account" size={20} color={theme.colors.textSecondary} />
              </View>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('create.duration.custom')}
                placeholderTextColor={theme.colors.textSecondary}
                value={numberOfTravelers.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text);
                  if (!isNaN(num) && num > 0 && num <= 50) {
                    setNumberOfTravelers(num);
                  }
                }}
                keyboardType="number-pad"
                editable={!isLoading}
                accessibilityLabel={t('create.travelers.title')}
              />
            </View>
          </View>

          {/* Travel Preferences */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="tune-variant" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.preferences.title')} {t('create.notes.optional')}
              </Text>
            </View>

            {/* Budget Level */}
            <Text style={[styles.prefLabel, { color: theme.colors.textSecondary }]}>
              {t('create.preferences.budget.title')}
            </Text>
            <View style={styles.quickPicks}>
              {(['budget', 'midRange', 'luxury'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.quickPickChip,
                    {
                      backgroundColor:
                        prefBudget === level
                          ? theme.colors.primary
                          : isDark ? colors.neutral[800] : colors.neutral[100],
                      borderColor:
                        prefBudget === level
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  onPress={() => setPrefBudget(prefBudget === level ? '' : level)}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t(`create.preferences.budget.${level}`)}
                  accessibilityState={{ selected: prefBudget === level }}
                >
                  <Icon
                    name={level === 'budget' ? 'cash' : level === 'midRange' ? 'cash-multiple' : 'diamond-stone'}
                    size={16}
                    color={prefBudget === level ? colors.neutral[0] : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.quickPickText,
                      { color: prefBudget === level ? colors.neutral[0] : theme.colors.text },
                    ]}
                  >
                    {t(`create.preferences.budget.${level}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Travel Style */}
            <Text style={[styles.prefLabel, { color: theme.colors.textSecondary }]}>
              {t('create.preferences.style.title')}
            </Text>
            <View style={styles.quickPicks}>
              {(['relaxed', 'balanced', 'active', 'adventure'] as const).map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.quickPickChip,
                    {
                      backgroundColor:
                        prefStyle === style
                          ? theme.colors.primary
                          : isDark ? colors.neutral[800] : colors.neutral[100],
                      borderColor:
                        prefStyle === style
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  onPress={() => setPrefStyle(prefStyle === style ? '' : style)}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={t(`create.preferences.style.${style}`)}
                  accessibilityState={{ selected: prefStyle === style }}
                >
                  <Icon
                    name={style === 'relaxed' ? 'beach' : style === 'balanced' ? 'scale-balance' : style === 'active' ? 'run-fast' : 'hiking'}
                    size={16}
                    color={prefStyle === style ? colors.neutral[0] : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.quickPickText,
                      { color: prefStyle === style ? colors.neutral[0] : theme.colors.text },
                    ]}
                  >
                    {t(`create.preferences.style.${style}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interests (multi-select) */}
            <Text style={[styles.prefLabel, { color: theme.colors.textSecondary }]}>
              {t('create.preferences.interests.title')}
            </Text>
            <View style={styles.quickPicks}>
              {(['food', 'culture', 'nature', 'shopping', 'nightlife', 'history', 'art', 'sports', 'photography'] as const).map((interest) => {
                const selected = prefInterests.includes(interest);
                const iconMap: Record<string, string> = {
                  food: 'silverware-fork-knife', culture: 'drama-masks', nature: 'tree',
                  shopping: 'shopping', nightlife: 'glass-cocktail', history: 'pillar',
                  art: 'palette', sports: 'basketball', photography: 'camera',
                };
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.quickPickChip,
                      {
                        backgroundColor: selected
                          ? theme.colors.primary
                          : isDark ? colors.neutral[800] : colors.neutral[100],
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => toggleInterest(interest)}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={t(`create.preferences.interests.${interest}`)}
                    accessibilityState={{ selected }}
                  >
                    <Icon
                      name={iconMap[interest] || 'tag'}
                      size={16}
                      color={selected ? colors.neutral[0] : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.quickPickText,
                        { color: selected ? colors.neutral[0] : theme.colors.text },
                      ]}
                    >
                      {t(`create.preferences.interests.${interest}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="text" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.notes.title')} {t('create.notes.optional')}
              </Text>
            </View>

            <View style={styles.textAreaWrapper}>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text }]}
                placeholder={t('create.notes.placeholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isLoading}
                accessibilityLabel={t('create.notes.title')}
              />
            </View>
          </View>

          {/* Budget */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="wallet-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('create.budget.title')}
              </Text>
            </View>

            <View style={styles.budgetRow}>
              {/* Currency Selector */}
              <View style={styles.currencySelector}>
                {['KRW', 'USD', 'JPY', 'EUR'].map((cur) => (
                  <TouchableOpacity
                    key={cur}
                    style={[
                      styles.currencyChip,
                      {
                        backgroundColor:
                          budgetCurrency === cur
                            ? theme.colors.primary
                            : isDark
                            ? colors.neutral[800]
                            : colors.neutral[100],
                        borderColor:
                          budgetCurrency === cur
                            ? theme.colors.primary
                            : theme.colors.border,
                      },
                    ]}
                    onPress={() => setBudgetCurrency(cur)}
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel={cur}
                    accessibilityState={{ selected: budgetCurrency === cur }}
                  >
                    <Text
                      style={[
                        styles.currencyChipText,
                        {
                          color:
                            budgetCurrency === cur
                              ? colors.neutral[0]
                              : theme.colors.text,
                        },
                      ]}
                    >
                      {cur}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Budget Amount Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Icon name="cash" size={20} color={theme.colors.textSecondary} />
                </View>
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder={t('create.budget.placeholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={totalBudget}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    setTotalBudget(cleaned);
                  }}
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                  accessibilityLabel={t('create.budget.title')}
                />
              </View>
            </View>
          </View>

          {/* Info Box (AI mode only) */}
          {planningMode === 'ai' && (
          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: isDark
                  ? `${theme.colors.primary}20`
                  : `${theme.colors.primary}10`,
              },
            ]}
          >
            <Icon name="robot" size={24} color={theme.colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>
                {t('create.aiInfo.title')}
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                {t('create.aiInfo.description')}
              </Text>
              {!isPremium && (
                <Text style={[styles.infoText, { color: aiTripsRemaining > 0 ? theme.colors.primary : colors.error?.main || '#EF4444', marginTop: 4, fontWeight: '600' }]}>
                  {aiTripsRemaining > 0
                    ? t('create.aiInfo.remaining', { remaining: aiTripsRemaining, total: aiTripsLimit > 0 ? aiTripsLimit : 3 })
                    : t('create.aiInfo.limitReached', { total: aiTripsLimit > 0 ? aiTripsLimit : 3 })}
                </Text>
              )}
            </View>
          </View>
          )}

          {/* Generation Progress (AI mode only) */}
          {isLoading && planningMode === 'ai' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <View style={styles.progressSteps}>
                {[
                  { icon: 'map-search-outline', text: t('create.progress.analyzing') },
                  { icon: 'weather-partly-cloudy', text: t('create.progress.weather') },
                  { icon: 'calendar-edit', text: t('create.progress.planning') },
                  { icon: 'check-circle-outline', text: t('create.progress.finalizing') },
                ].map((step, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.progressStep,
                      idx <= generationStep ? styles.progressStepActive : null,
                    ]}
                  >
                    <Icon
                      name={step.icon}
                      size={18}
                      color={idx <= generationStep ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.progressStepText,
                        {
                          color: idx <= generationStep
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                          fontWeight: idx === generationStep ? '700' : '500',
                        },
                      ]}
                    >
                      {step.text}
                    </Text>
                    {idx === generationStep && (
                      <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 4 }} />
                    )}
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.textSecondary }]}
                onPress={handleCancelCreation}
              >
                <Icon name="close" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                  {t('create.progress.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel Confirmation Modal (timeout) */}
          <Modal
            visible={showCancelConfirm}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCancelConfirm(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                <Icon name="clock-alert-outline" size={40} color={theme.colors.primary} />
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {t('create.progress.takingLong', { defaultValue: 'AI generation is taking longer than usual...' })}
                </Text>
                <Text style={[styles.modalBody, { color: theme.colors.textSecondary }]}>
                  {t('create.progress.cancelAndManual', { defaultValue: 'Would you like to cancel and add activities manually?' })}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalSecondaryButton, { borderColor: theme.colors.border }]}
                    onPress={() => setShowCancelConfirm(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                      {t('create.progress.keepWaiting', { defaultValue: 'Keep waiting' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalPrimaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleCancelCreation}
                  >
                    <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                      {t('create.progress.cancelCreate', { defaultValue: 'Cancel & go manual' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Create Button */}
          <View style={styles.createButtonWrapper}>
            <Button
              variant="primary"
              size="lg"
              icon={isLoading ? undefined : 'creation'}
              fullWidth
              onPress={handleCreateTrip}
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading
                ? (planningMode === 'ai' ? t('create.generating') : t('create.mode.manualCreating'))
                : t('create.submit')}
            </Button>
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
      {/* AI Usage Consent Modal (Apple App Store requirement) */}
      <Modal
        visible={showAiConsent}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAiConsent(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]} accessibilityViewIsModal={true}>
            <Icon name="robot" size={40} color={theme.colors.primary} />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t('create.aiConsent.title')}
            </Text>
            <Text style={[styles.modalBody, { color: theme.colors.textSecondary }]}>
              {t('create.aiConsent.body')}
            </Text>
            <Text style={[styles.modalDataList, { color: theme.colors.textSecondary }]}>
              {t('create.aiConsent.dataList')}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleAiConsentAccept}
              accessibilityRole="button"
            >
              <Text style={styles.modalButtonText}>
                {t('create.aiConsent.accept')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAiConsent(false)}
              accessibilityRole="button"
            >
              <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>
                {t('create.aiConsent.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    hero: {
      width: '100%',
      height: 240,
    },
    heroGradient: {
      flex: 1,
      padding: 20,
      justifyContent: 'space-between',
    },
    backButton: {
      alignSelf: 'flex-start',
    },
    backButtonInner: {
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
      fontSize: 32,
      fontWeight: '700',
      color: colors.neutral[0],
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: 16,
      color: colors.neutral[100],
      lineHeight: 22,
    },
    formSection: {
      padding: 20,
    },
    section: {
      marginBottom: 32,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    prefLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 4,
    },
    modeCards: {
      flexDirection: 'row',
      gap: 12,
    },
    modeCard: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      gap: 8,
    },
    modeCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    modeCardDesc: {
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
    },
    quickPicks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    quickPickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
    },
    quickPickText: {
      fontSize: 14,
      fontWeight: '600',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
      paddingHorizontal: 16,
      height: 56,
    },
    inputError: {
      borderColor: colors.error.main,
      borderWidth: 1.5,
    },
    errorText: {
      color: colors.error.main,
      fontSize: 13,
      fontWeight: '500',
      marginTop: 6,
      marginLeft: 4,
    },
    inputIconContainer: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
      height: '100%',
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    dateInputWrapper: {
      flex: 1,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
      padding: 12,
    },
    dateLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 6,
    },
    dateInput: {
      fontSize: 16,
      fontWeight: '500',
    },
    dateArrow: {
      marginTop: 20,
    },
    durationDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: isDark
        ? `${theme.colors.primary}20`
        : `${theme.colors.primary}10`,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    durationText: {
      fontSize: 14,
      fontWeight: '700',
    },
    textAreaWrapper: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
      padding: 16,
      minHeight: 120,
    },
    textArea: {
      fontSize: 16,
      lineHeight: 22,
      minHeight: 88,
    },
    budgetRow: {
      gap: 12,
    },
    currencySelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    currencyChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
    },
    currencyChipText: {
      fontSize: 13,
      fontWeight: '700',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    infoText: {
      fontSize: 14,
      lineHeight: 20,
    },
    createButtonWrapper: {
      marginTop: 8,
    },
    progressContainer: {
      marginBottom: 20,
      padding: 16,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderRadius: 12,
    },
    progressBarBg: {
      height: 6,
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200],
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary[500],
      borderRadius: 3,
    },
    progressSteps: {
      gap: 10,
    },
    progressStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      opacity: 0.5,
    },
    progressStepActive: {
      opacity: 1,
    },
    progressStepText: {
      fontSize: 14,
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      alignSelf: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    rewardedAdButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginTop: 12,
    },
    rewardedAdText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      maxWidth: 360,
      width: '100%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      marginTop: 16,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalBody: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 12,
    },
    modalDataList: {
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 24,
    },
    modalButton: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    modalButtonText: {
      color: colors.neutral[0],
      fontSize: 16,
      fontWeight: '700',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    modalSecondaryButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
    },
    modalPrimaryButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    modalCancelButton: {
      paddingVertical: 8,
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '500',
    },
  });

export default CreateTripScreen;
