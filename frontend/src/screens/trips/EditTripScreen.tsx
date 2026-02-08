/**
 * EditTripScreen v1.0
 *
 * Trip editing screen with status-based constraints:
 * - UPCOMING trips: Full editing allowed
 * - ONGOING trips: Limited editing (no date changes)
 * - COMPLETED trips: Read-only mode (redirect to detail)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { TripsStackParamList, Trip } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';
import Button from '../../components/core/Button';
import DatePickerField from '../../components/core/DatePicker';

type EditTripScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'EditTrip'>;
type EditTripScreenRouteProp = RouteProp<TripsStackParamList, 'EditTrip'>;

interface Props {
  navigation: EditTripScreenNavigationProp;
  route: EditTripScreenRouteProp;
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

// Traveler quick picks
const TRAVELER_OPTIONS = [
  { count: 1, label: '나 혼자', icon: 'account' },
  { count: 2, label: '2명', icon: 'account-multiple' },
  { count: 4, label: '3-4명', icon: 'account-group' },
  { count: 6, label: '5명 이상', icon: 'account-supervisor' },
];

const EditTripScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { theme, isDark } = useTheme();

  // Form state
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [description, setDescription] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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

  const fetchTripDetails = async () => {
    try {
      const data = await apiService.getTripById(tripId);

      // Check if trip is completed - redirect to detail view
      if (data.status === 'completed') {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
          window.alert('완료된 여행은 수정할 수 없습니다.');
        } else {
          Alert.alert('수정 불가', '완료된 여행은 수정할 수 없습니다.');
        }
        navigation.replace('TripDetail', { tripId });
        return;
      }

      setTrip(data);
      // Initialize form with existing data
      setDestination(data.destination);
      setStartDate(data.startDate.split('T')[0]);
      setEndDate(data.endDate.split('T')[0]);
      setNumberOfTravelers(data.numberOfTravelers || 1);
      setDescription(data.description || '');
    } catch (error) {
      console.error('Failed to fetch trip details:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('여행 정보를 불러올 수 없습니다.');
      } else {
        Alert.alert('오류', '여행 정보를 불러올 수 없습니다.');
      }
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDestination = (dest: string) => {
    setDestination(dest);
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

  const handleSaveTrip = async () => {
    if (!trip) return;

    // Validation
    if (!destination.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('여행 목적지를 입력해주세요.');
      } else {
        Alert.alert('필수 입력', '여행 목적지를 입력해주세요.');
      }
      return;
    }

    if (!startDate || !endDate) {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('여행 날짜를 선택해주세요.');
      } else {
        Alert.alert('필수 입력', '여행 날짜를 선택해주세요.');
      }
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('종료일은 시작일 이후여야 합니다.');
      } else {
        Alert.alert('날짜 오류', '종료일은 시작일 이후여야 합니다.');
      }
      return;
    }

    // Warning for ongoing trips if dates changed
    if (trip.status === 'ongoing') {
      const originalStart = trip.startDate.split('T')[0];
      const originalEnd = trip.endDate.split('T')[0];

      if (startDate !== originalStart || endDate !== originalEnd) {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '진행 중인 여행의 날짜를 변경하면 일정에 영향을 줄 수 있습니다. 계속하시겠습니까?'
          );
          if (!confirmed) return;
        } else {
          Alert.alert(
            '날짜 변경 경고',
            '진행 중인 여행의 날짜를 변경하면 일정에 영향을 줄 수 있습니다. 계속하시겠습니까?',
            [
              { text: '취소', style: 'cancel' },
              { text: '계속', onPress: () => saveTrip() },
            ]
          );
          return;
        }
      }
    }

    await saveTrip();
  };

  const saveTrip = async () => {
    setIsSaving(true);
    try {
      const tripData = {
        destination: destination.trim(),
        startDate,
        endDate,
        numberOfTravelers,
        description: description.trim() || undefined,
      };

      await apiService.updateTrip(tripId, tripData);

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert('여행 정보가 수정되었습니다.');
        navigation.navigate('TripDetail', { tripId });
      } else {
        Alert.alert(
          '수정 완료',
          '여행 정보가 수정되었습니다.',
          [
            {
              text: '확인',
              onPress: () => navigation.navigate('TripDetail', { tripId }),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Trip update error:', error);
      const message = error.response?.data?.message || '여행 정보를 수정할 수 없습니다. 다시 시도해주세요.';

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(message);
      } else {
        Alert.alert('수정 실패', message);
      }
    } finally {
      setIsSaving(false);
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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; icon: string } } = {
      upcoming: { label: '예정', color: colors.primary[500], icon: 'calendar-clock' },
      ongoing: { label: '진행중', color: colors.success.main, icon: 'airplane' },
      completed: { label: '완료', color: colors.neutral[500], icon: 'check-circle' },
    };
    return statusMap[status] || statusMap.upcoming;
  };

  const duration = calculateDuration();
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
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          여행을 찾을 수 없습니다
        </Text>
        <Button variant="primary" size="md" onPress={() => navigation.goBack()}>
          돌아가기
        </Button>
      </View>
    );
  }

  const statusBadge = getStatusBadge(trip.status);
  const isOngoing = trip.status === 'ongoing';

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
            uri: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80',
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
              disabled={isSaving}
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
              <View style={styles.heroHeader}>
                <Text style={styles.heroTitle}>여행 정보 수정</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
                  <Icon name={statusBadge.icon} size={14} color={colors.neutral[0]} />
                  <Text style={styles.statusBadgeText}>{statusBadge.label}</Text>
                </View>
              </View>
              <Text style={styles.heroSubtitle}>
                {trip.destination}
              </Text>
              {isOngoing && (
                <View style={styles.warningBox}>
                  <Icon name="alert" size={16} color={colors.warning.main} />
                  <Text style={styles.warningText}>
                    진행 중인 여행입니다. 날짜 변경 시 주의하세요.
                  </Text>
                </View>
              )}
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
                여행 목적지
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
                  disabled={isSaving}
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
                placeholder="또는 직접 입력하세요"
                placeholderTextColor={theme.colors.textSecondary}
                value={destination}
                onChangeText={setDestination}
                editable={!isSaving}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Duration */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="calendar-range" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                여행 기간
              </Text>
              {isOngoing && (
                <View style={styles.cautionBadge}>
                  <Icon name="alert" size={12} color={colors.warning.main} />
                  <Text style={[styles.cautionText, { color: colors.warning.main }]}>
                    변경 주의
                  </Text>
                </View>
              )}
            </View>

            {/* Date Inputs */}
            <View style={styles.dateRow}>
              <DatePickerField
                label="시작일"
                value={startDate}
                onChange={setStartDate}
                disabled={isSaving}
              />
              <Icon
                name="arrow-right"
                size={20}
                color={theme.colors.textSecondary}
                style={styles.dateArrow}
              />
              <DatePickerField
                label="종료일"
                value={endDate}
                onChange={setEndDate}
                minimumDate={startDate ? new Date(startDate + 'T00:00:00') : undefined}
                disabled={isSaving}
              />
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
                여행 인원
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
                  disabled={isSaving}
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
                editable={!isSaving}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="text" size={24} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                여행 설명 (선택)
              </Text>
            </View>

            <View style={styles.textAreaWrapper}>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text }]}
                placeholder="여행의 목적이나 특별한 요구사항을 자유롭게 입력하세요"
                placeholderTextColor={theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSaving}
              />
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.saveButtonWrapper}>
            <Button
              variant="primary"
              size="lg"
              icon="content-save"
              fullWidth
              onPress={handleSaveTrip}
              loading={isSaving}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '여행 정보 저장'}
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
    errorText: {
      fontSize: 18,
      marginBottom: 24,
      textAlign: 'center',
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
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.neutral[0],
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.neutral[0],
    },
    heroSubtitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.neutral[100],
      marginBottom: 12,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: 'rgba(251, 191, 36, 0.2)',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.warning.main,
    },
    warningText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.warning.main,
      flex: 1,
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
      flex: 1,
    },
    cautionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: `${colors.warning.main}20`,
      borderRadius: 12,
    },
    cautionText: {
      fontSize: 11,
      fontWeight: '600',
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
    saveButtonWrapper: {
      marginTop: 8,
    },
  });

export default EditTripScreen;
