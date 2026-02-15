/**
 * OnboardingScreen - Welcome & Feature Showcase
 *
 * 앱 첫 진입 시 보여주는 온보딩 화면
 * - 앱 소개 및 주요 기능 안내
 * - 로그인/회원가입 진입점
 * - 다크모드 지원
 * - 모바일 최적화
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { AuthStackParamList } from '../../types';

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
};

interface OnboardingSlide {
  id: string;
  icon: string;
  title: string;
  description: string;
  gradient: [string, string];
}

const getSlides = (t: TFunction): OnboardingSlide[] => [
  {
    id: '1',
    icon: 'airplane-takeoff',
    title: t('onboarding.slides.plan.title'),
    description: t('onboarding.slides.plan.description'),
    gradient: [colors.primary[500], colors.primary[700]],
  },
  {
    id: '2',
    icon: 'weather-sunny',
    title: t('onboarding.slides.customize.title'),
    description: t('onboarding.slides.customize.description'),
    gradient: [colors.primary[400], colors.primary[600]],
  },
  {
    id: '3',
    icon: 'pencil-ruler',
    title: t('onboarding.slides.weather.title'),
    description: t('onboarding.slides.weather.description'),
    gradient: [colors.travel.ocean, colors.primary[800]],
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const { isDark } = useTheme();
  const { t } = useTranslation('auth');
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const SLIDES = getSlides(t);

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < SLIDES.length) {
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    } else {
      navigation.navigate('Login');
    }
  }, [currentIndex, SLIDES.length, SCREEN_WIDTH, navigation]);

  const handleSkip = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
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

  const isWeb = Platform.OS === 'web';
  const ControlsWrapper = isWeb ? View : SafeAreaView;
  const controlsProps = isWeb ? {} : { edges: ['bottom'] as const };

  // Web: bypass RN Responder system with native DOM onClick
  const webClick = (handler: () => void) =>
    isWeb ? { onClick: (e: any) => { e.stopPropagation(); handler(); } } : {};

  return (
    <View style={styles.container}>
      <View style={[styles.slideArea, isWeb && { pointerEvents: 'auto' as const }]}>
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
            {
              useNativeDriver: false,
              listener: isWeb ? (event: any) => {
                clearTimeout(scrollTimeout.current);
                scrollTimeout.current = setTimeout(() => {
                  const x = event.nativeEvent.contentOffset.x;
                  const index = Math.round(x / SCREEN_WIDTH);
                  setCurrentIndex(index);
                }, 150);
              } : undefined,
            }
          )}
          onMomentumScrollEnd={!isWeb ? (event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            setCurrentIndex(index);
          } : undefined}
          scrollEventThrottle={16}
        />
      </View>

      <ControlsWrapper style={styles.controls} {...controlsProps}>
        {renderPagination()}

        <View style={styles.buttonContainer}>
          {!isLastSlide ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSkip}
                accessibilityLabel={t('onboarding.skip')}
                accessibilityRole="button"
                {...webClick(handleSkip)}
              >
                <Text style={styles.skipButtonText}>{t('onboarding.skip')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed && styles.nextButtonPressed,
                ]}
                onPress={handleNext}
                accessibilityLabel={t('onboarding.next')}
                accessibilityRole="button"
                {...webClick(handleNext)}
              >
                <Text style={styles.nextButtonText}>{t('onboarding.next')}</Text>
                <Icon name="arrow-right" size={20} color={colors.primary[700]} />
              </Pressable>
            </>
          ) : (
            <View style={styles.lastSlideButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.nextButtonPressed,
                ]}
                onPress={() => navigation.navigate('Login')}
                accessibilityLabel={t('onboarding.start')}
                accessibilityRole="button"
                {...webClick(() => navigation.navigate('Login'))}
              >
                <Icon name="login" size={20} color={colors.primary[700]} />
                <Text style={styles.startButtonText}>{t('onboarding.start')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.registerLink,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => navigation.navigate('Register')}
                accessibilityLabel={t('onboarding.noAccount')}
                accessibilityRole="link"
                {...webClick(() => navigation.navigate('Register'))}
              >
                <Text style={styles.registerLinkText}>
                  {t('onboarding.noAccount')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ControlsWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[700],
  },
  slideArea: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 0,
  },
  slide: {
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
    paddingBottom: 40,
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
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 24 : 0,
    backgroundColor: colors.primary[700],
    zIndex: 10,
    position: 'relative',
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[700],
  },
  registerLink: {
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as any,
  registerLinkText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  nextButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
