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

import React, { useState, useRef, useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { TripsStackParamList } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import Button from '../../components/core/Button';
import DestinationInsights from '../../components/DestinationInsights';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CreateTripScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'CreateTrip'>;

interface Props {
  navigation: CreateTripScreenNavigationProp;
}

// Popular destination suggestions
const POPULAR_DESTINATIONS = [
  { name: '도쿄', icon: 'torii-gate', color: colors.travel.sunset },
  { name: '파리', icon: 'eiffel-tower', color: colors.travel.forest },
  { name: '뉴욕', icon: 'city', color: colors.travel.ocean },
  { name: '방콕', icon: 'palm-tree', color: colors.travel.sunset },
  { name: '런던', icon: 'bridge', color: colors.neutral[600] },
  { name: '바르셀로나', icon: 'beach', color: colors.warning.main },
];

// Duration quick picks (in days)
const DURATION_OPTIONS = [
  { days: 3, label: '3일', icon: 'calendar-week' },
  { days: 7, label: '1주일', icon: 'calendar-week-begin' },
  { days: 14, label: '2주일', icon: 'calendar-month' },
  { days: 30, label: '한 달', icon: 'calendar-multiple' },
];

// Traveler quick picks
const TRAVELER_OPTIONS = [
  { count: 1, label: '나 혼자', icon: 'account' },
  { count: 2, label: '2명', icon: 'account-multiple' },
  { count: 4, label: '3-4명', icon: 'account-group' },
  { count: 6, label: '5명 이상', icon: 'account-supervisor' },
];

const CreateTripScreen: React.FC<Props> = ({ navigation }) => {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
  }, []);

  const handleSelectDestination = (dest: string) => {
    setDestination(dest);
  };

  const handleSelectDuration = (days: number) => {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    end.setDate(end.getDate() + days);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
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
    // Validation
    if (!destination.trim()) {
      showToast({
        type: 'warning',
        message: '여행 목적지를 입력해주세요.',
        position: 'top',
      });
      return;
    }

    if (!startDate || !endDate) {
      showToast({
        type: 'warning',
        message: '여행 날짜를 선택해주세요.',
        position: 'top',
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      showToast({
        type: 'error',
        message: '종료일은 시작일 이후여야 합니다.',
        position: 'top',
      });
      return;
    }

    setIsLoading(true);
    try {
      const tripData = {
        destination: destination.trim(),
        startDate,
        endDate,
        numberOfTravelers,
        description: description.trim() || undefined,
      };

      const trip = await apiService.createTrip(tripData);

      showToast({
        type: 'success',
        message: 'AI가 여행 일정을 자동으로 생성했습니다!',
        position: 'top',
        duration: 2000,
      });

      // Navigate after a short delay to allow toast to be seen
      setTimeout(() => {
        navigation.navigate('TripDetail', { tripId: trip.id });
      }, 500);
    } catch (error: any) {
      console.error('Trip creation error:', error);
      const message = error.response?.data?.message || '여행 계획을 생성할 수 없습니다. 다시 시도해주세요.';

      showToast({
        type: 'error',
        message,
        position: 'top',
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
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
            uri: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80',
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
              <Text style={styles.heroTitle}>다음 모험을 계획해볼까요?</Text>
              <Text style={styles.heroSubtitle}>
                AI가 당신만의 완벽한 여행 일정을 만들어드립니다
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
                어디로 떠나시나요?
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
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <Icon name="magnify" size={20} color={theme.colors.textSecondary} />
              </View>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="또는 직접 입력하세요 (예: 제주도, 부산)"
                placeholderTextColor={theme.colors.textSecondary}
                value={destination}
                onChangeText={setDestination}
                editable={!isLoading}
                autoCapitalize="words"
              />
            </View>

            {/* Destination Insights */}
            {destination && destination.trim().length >= 2 && (
              <DestinationInsights
                destination={destination}
                onRecommendationsLoaded={(recommendations) => {
                  console.log('Recommendations loaded:', recommendations);
                  // Optionally auto-fill recommended values
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
                얼마나 머무시나요?
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
              <View style={styles.dateInputWrapper}>
                <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]}>
                  시작일
                </Text>
                <TextInput
                  style={[styles.dateInput, { color: theme.colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={startDate}
                  onChangeText={setStartDate}
                  editable={!isLoading}
                />
              </View>
              <Icon
                name="arrow-right"
                size={20}
                color={theme.colors.textSecondary}
                style={styles.dateArrow}
              />
              <View style={styles.dateInputWrapper}>
                <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]}>
                  종료일
                </Text>
                <TextInput
                  style={[styles.dateInput, { color: theme.colors.text }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={endDate}
                  onChangeText={setEndDate}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Duration Display */}
            {duration && duration > 0 && (
              <View style={styles.durationDisplay}>
                <Icon name="calendar" size={16} color={theme.colors.primary} />
                <Text style={[styles.durationText, { color: theme.colors.primary }]}>
                  총 {duration}일간의 여행
                </Text>
              </View>
            )}
          </View>

          {/* Travelers */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="account-group" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                누구와 함께 가시나요?
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
                placeholder="또는 직접 입력하세요"
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
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="text" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                특별한 계획이 있나요? (선택)
              </Text>
            </View>

            <View style={styles.textAreaWrapper}>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text }]}
                placeholder="여행의 목적이나 특별한 요구사항을 자유롭게 입력하세요&#10;예: 벚꽃 명소 중심으로, 미식 투어, 가족 여행"
                placeholderTextColor={theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isLoading}
              />
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
                AI 자동 생성
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                최근 3개월간 여행 데이터를 분석하여{'\n'}
                최적의 맞춤형 일정을 자동으로 생성합니다
              </Text>
            </View>
          </View>

          {/* Create Button */}
          <View style={styles.createButtonWrapper}>
            <Button
              variant="primary"
              size="lg"
              icon="sparkles"
              fullWidth
              onPress={handleCreateTrip}
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'AI가 일정을 만드는 중...' : 'AI로 여행 계획 생성하기'}
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
  });

export default CreateTripScreen;
