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

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { useInterstitialAd } from '../../components/ads';
import { getHeroImageUrl } from '../../utils/images';

type CreateTripScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'CreateTrip'>;

interface Props {
  navigation: CreateTripScreenNavigationProp;
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

const CreateTripScreen: React.FC<Props> = ({ navigation }) => {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [description, setDescription] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState('USD');
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
    setNumberOfTravelers(count);
  };

  const calculateDuration = (): number | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  const handleCreateTrip = async () => {
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

    setIsLoading(true);
    setGenerationStep(0);
    progressAnim.setValue(0);

    // Animate progress steps to simulate multi-phase generation
    const steps = [0, 1, 2, 3];
    let stepIndex = 0;
    Animated.timing(progressAnim, {
      toValue: 0.2,
      duration: 400,
      useNativeDriver: false,
    }).start();

    stepTimerRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setGenerationStep(stepIndex);
        Animated.timing(progressAnim, {
          toValue: (stepIndex + 1) / (steps.length + 1),
          duration: 600,
          useNativeDriver: false,
        }).start();
      }
    }, 2000);

    try {
      const budgetNum = totalBudget ? parseFloat(totalBudget) : undefined;
      const tripData = {
        destination: destination.trim(),
        startDate,
        endDate,
        numberOfTravelers,
        description: description.trim() || undefined,
        totalBudget: budgetNum && budgetNum > 0 ? budgetNum : undefined,
        budgetCurrency: budgetNum && budgetNum > 0 ? budgetCurrency : undefined,
      };

      const trip = await apiService.createTrip(tripData);

      // Complete the progress bar
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Schedule trip reminder notifications
      scheduleTripReminders(trip).catch(() => {});
      trackEvent('trip_created', { destination: destination.trim() });

      showToast({
        type: 'success',
        message: t('create.generating'),
        position: 'top',
        duration: 2000,
      });

      // Show interstitial ad after trip creation, then navigate
      setTimeout(async () => {
        if (isAdLoaded) {
          await showInterstitial();
        }
        navigation.navigate('TripDetail', { tripId: trip.id });
      }, 500);
    } catch (error: any) {
      const message = error.response?.data?.message || t('create.alerts.createFailed');

      showToast({
        type: 'error',
        message,
        position: 'top',
        duration: 4000,
      });
    } finally {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setIsLoading(false);
      setGenerationStep(0);
    }
  };

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
                onRecommendationsLoaded={(recommendations) => {
                  // Auto-fill recommended values
                  if (recommendations.recommendedDuration && !startDate && !endDate) {
                    handleSelectDuration(recommendations.recommendedDuration);
                  }
                  if (recommendations.recommendedTravelers && numberOfTravelers === 1) {
                    setNumberOfTravelers(recommendations.recommendedTravelers);
                  }
                }}
              />
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
              {DURATION_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickPickChip,
                    {
                      backgroundColor: isDark
                        ? colors.neutral[800]
                        : colors.neutral[100],
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => handleSelectDuration(option.days)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  <Icon
                    name={option.icon}
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text
                    style={[styles.quickPickText, { color: theme.colors.text }]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
                  if (!isNaN(num) && num > 0) {
                    setNumberOfTravelers(num);
                  }
                }}
                keyboardType="number-pad"
                editable={!isLoading}
                accessibilityLabel={t('create.travelers.title')}
              />
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

          {/* Info Box */}
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
            </View>
          </View>

          {/* Generation Progress */}
          {isLoading && (
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
                  { icon: 'calendar-edit', text: t('create.progress.planning') },
                  { icon: 'weather-partly-cloudy', text: t('create.progress.weather') },
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
            </View>
          )}

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
              {isLoading ? t('create.generating') : t('create.submit')}
            </Button>
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  });

export default CreateTripScreen;
