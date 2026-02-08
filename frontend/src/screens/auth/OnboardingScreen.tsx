/**
 * OnboardingScreen - Welcome & Feature Showcase
 *
 * 앱 첫 진입 시 보여주는 온보딩 화면
 * - 앱 소개 및 주요 기능 안내
 * - 로그인/회원가입 진입점
 * - 다크모드 지원
 * - 모바일 최적화
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { AuthStackParamList } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
};

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Icon.glyphMap;
  title: string;
  description: string;
  gradient: [string, string];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'airplane-takeoff',
    title: '목적지만 선택하세요',
    description: 'AI가 여행지, 일정, 예산까지\n완벽한 여행 계획을 자동으로 만들어드립니다.',
    gradient: [colors.primary[500], colors.primary[700]],
  },
  {
    id: '2',
    icon: 'weather-sunny',
    title: '현지 정보를 한눈에',
    description: '날씨, 시차, 환율 등\n여행에 필요한 모든 정보를 제공합니다.',
    gradient: [colors.secondary[400], colors.secondary[600]],
  },
  {
    id: '3',
    icon: 'pencil-ruler',
    title: '자유롭게 수정하세요',
    description: '자동 생성된 일정을 원하는 대로\n추가, 수정, 삭제할 수 있습니다.',
    gradient: [colors.travel.ocean, colors.primary[800]],
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      navigation.navigate('Login');
    }
  };

  const handleSkip = () => {
    navigation.navigate('Login');
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <LinearGradient colors={item.gradient} style={styles.slideGradient}>
        <View style={styles.slideContent}>
          <View style={styles.iconContainer}>
            <Icon name={item.icon} size={80} color={colors.neutral[0]} />
          </View>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.pagination}>
      {SLIDES.map((_, index) => {
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });
        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.4, 1, 0.4],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity: dotOpacity,
                backgroundColor: colors.neutral[0],
              },
            ]}
          />
        );
      })}
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH
          );
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      <SafeAreaView style={styles.controls} edges={['bottom']}>
        {/* Pagination Dots */}
        {renderPagination()}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {!isLastSlide ? (
            <>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>건너뛰기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>다음</Text>
                <Icon name="arrow-right" size={20} color={colors.primary[700]} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.lastSlideButtons}>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Icon name="login" size={20} color={colors.primary[700]} />
                <Text style={styles.startButtonText}>시작하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.7}
              >
                <Text style={styles.registerLinkText}>
                  계정이 없으신가요? 회원가입
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[700],
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  slideGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.neutral[0],
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  slideDescription: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 28,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 24 : 0,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[700],
  },
  lastSlideButtons: {
    flex: 1,
    alignItems: 'center',
    gap: 16,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 28,
    gap: 10,
    width: '100%',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[700],
  },
  registerLink: {
    paddingVertical: 8,
  },
  registerLinkText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});
