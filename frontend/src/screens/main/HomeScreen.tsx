/**
 * HomeScreen v2.0 - 2025 Design
 *
 * 완전히 리뉴얼된 홈 화면:
 * - Hero section with gradient
 * - Real destination images
 * - Modern cards with shadows
 * - Smooth animations
 * - Beautiful typography
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  ImageBackground,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, TripsStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { colors, getColorWithOpacity } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Button from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { Badge } from '../../components/core/Badge';
import { Section } from '../../components/layout/Section';
import { FadeIn } from '../../components/animation/FadeIn';
import { SlideIn } from '../../components/animation/SlideIn';
import PopularDestinations from '../../components/PopularDestinations';
import apiService from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<TripsStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

// Featured destinations with real Unsplash images
const FEATURED_DESTINATIONS = [
  {
    id: '1',
    name: '도쿄',
    country: '일본',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    description: '벚꽃과 전통이 어우러진 도시',
    weather: '23°C',
    rating: 4.8,
  },
  {
    id: '2',
    name: '파리',
    country: '프랑스',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    description: '예술과 낭만의 도시',
    weather: '18°C',
    rating: 4.9,
  },
  {
    id: '3',
    name: '뉴욕',
    country: '미국',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
    description: '잠들지 않는 도시',
    weather: '20°C',
    rating: 4.7,
  },
  {
    id: '4',
    name: '바르셀로나',
    country: '스페인',
    image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80',
    description: '가우디의 예술과 지중해',
    weather: '25°C',
    rating: 4.8,
  },
  {
    id: '5',
    name: '서울',
    country: '한국',
    image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&q=80',
    description: '전통과 현대가 공존하는 도시',
    weather: '22°C',
    rating: 4.6,
  },
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const [stats, setStats] = useState({ completed: 0, ongoing: 0, upcoming: 0 });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Fetch trip stats
  const fetchStats = useCallback(async () => {
    try {
      const trips = await apiService.getTrips();
      const completed = trips.filter((t: any) => t.status === 'completed').length;
      const ongoing = trips.filter((t: any) => t.status === 'ongoing').length;
      const upcoming = trips.filter((t: any) => t.status === 'upcoming').length;
      setStats({ completed, ongoing, upcoming });
    } catch (error) {
      // Silent fail - stats are non-critical
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  useEffect(() => {
    // Start animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCreateTrip = () => {
    navigation.navigate('Trips', { screen: 'CreateTrip' });
  };

  const handleViewTrips = () => {
    navigation.navigate('Trips', { screen: 'TripList' });
  };

  const handleDestinationPress = (destination: typeof FEATURED_DESTINATIONS[0]) => {
    navigation.navigate('Trips', { screen: 'CreateTrip' });
  };

  const styles = createStyles(theme, isDark);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80' }}
        style={styles.heroSection}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.3)',
            'rgba(0,0,0,0.5)',
            'rgba(0,0,0,0.7)',
          ]}
          style={styles.heroGradient}
        >
          <Animated.View
            style={[
              styles.heroContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.heroGreeting}>안녕하세요 👋</Text>
            <Text style={styles.heroTitle}>{user?.name}님,</Text>
            <Text style={styles.heroSubtitle}>
              다음 모험을 계획해볼까요?
            </Text>

            <View style={styles.heroActions}>
              <Button
                variant="primary"
                size="lg"
                icon="star-circle"
                onPress={handleCreateTrip}
                style={styles.heroCTA}
              >
                AI 여행 계획 만들기
              </Button>
            </View>
          </Animated.View>
        </LinearGradient>
      </ImageBackground>

      {/* Quick Stats - Using new Card component */}
      <FadeIn duration={600} delay={200}>
        <View style={styles.statsContainer}>
          <Card elevation="sm" padding="md" style={styles.statCard}>
            <Icon name="airplane-takeoff" size={28} color={colors.primary[500]} />
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>여행 완료</Text>
          </Card>

          <Card elevation="sm" padding="md" style={styles.statCard}>
            <Icon name="map-marker-multiple" size={28} color={colors.secondary[500]} />
            <Text style={styles.statValue}>{stats.ongoing}</Text>
            <Text style={styles.statLabel}>진행 중</Text>
          </Card>

          <Card elevation="sm" padding="md" style={styles.statCard}>
            <Icon name="calendar-clock" size={28} color={colors.accent} />
            <Text style={styles.statValue}>{stats.upcoming}</Text>
            <Text style={styles.statLabel}>예정</Text>
          </Card>
        </View>
      </FadeIn>

      {/* Popular Destinations from Real Data */}
      <FadeIn duration={600} delay={300}>
        <PopularDestinations
          onDestinationPress={() => {
            navigation.navigate('Trips', { screen: 'CreateTrip' });
          }}
        />
      </FadeIn>

      {/* Featured Destinations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>지금 떠나기 좋은 곳</Text>
            <Text style={styles.sectionSubtitle}>인기 여행지를 둘러보세요</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>전체보기 →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.destinationsScroll}
        >
          {FEATURED_DESTINATIONS.map((destination, index) => (
            <Animated.View
              key={destination.id}
              style={[
                { opacity: fadeAnim },
                {
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 50],
                      outputRange: [0, index * 20],
                    }),
                  }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.destinationCard}
                onPress={() => handleDestinationPress(destination)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: destination.image }}
                  style={styles.destinationImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[
                    'transparent',
                    'rgba(0,0,0,0.3)',
                    'rgba(0,0,0,0.8)',
                  ]}
                  style={styles.destinationOverlay}
                >
                  {/* Badges - Using Badge component */}
                  <View style={styles.destinationBadges}>
                    <Badge
                      variant="neutral"
                      size="sm"
                      icon="weather-sunny"
                      style={styles.transparentBadge}
                      textStyle={{ color: colors.neutral[0] }}
                    >
                      {destination.weather}
                    </Badge>
                    <Badge
                      variant="neutral"
                      size="sm"
                      icon="star"
                      style={styles.transparentBadge}
                      textStyle={{ color: colors.neutral[0] }}
                    >
                      {destination.rating}
                    </Badge>
                  </View>

                  {/* Destination Info */}
                  <View style={styles.destinationInfo}>
                    <Text style={styles.destinationName}>{destination.name}</Text>
                    <Text style={styles.destinationCountry}>{destination.country}</Text>
                    <Text style={styles.destinationDescription}>
                      {destination.description}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.destinationActions}>
                    <TouchableOpacity style={styles.iconButton}>
                      <Icon name="heart-outline" size={20} color={colors.neutral[0]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton}>
                      <Icon name="share-variant" size={20} color={colors.neutral[0]} />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <SlideIn direction="bottom" duration={500} delay={400}>
        <Section title="빠른 실행" padding="lg" spacing="md">
          <View style={styles.quickActionsGrid}>
            <Card
              elevation="sm"
              padding="lg"
              onPress={handleViewTrips}
              style={styles.quickActionCard}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.primary[100] }]}>
                <Icon name="map-marker-multiple" size={28} color={colors.primary[600]} />
              </View>
              <Text style={styles.quickActionTitle}>내 여행</Text>
              <Text style={styles.quickActionDescription}>
                진행 중인 여행 확인
              </Text>
            </Card>

            <Card
              elevation="sm"
              padding="lg"
              style={styles.quickActionCard}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary[100] }]}>
                <Icon name="compass-outline" size={28} color={colors.secondary[600]} />
              </View>
              <Text style={styles.quickActionTitle}>여행 영감</Text>
              <Text style={styles.quickActionDescription}>
                새로운 아이디어 탐색
              </Text>
            </Card>
          </View>
        </Section>
      </SlideIn>

      {/* Travel Tips */}
      <FadeIn duration={600} delay={600}>
        <Section title="여행 팁" padding="lg" spacing="md">
          <Card elevation="sm" padding="lg">
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.tipIconContainer}>
                <Icon name="lightbulb" size={24} color={colors.secondary[500]} />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>미리 계획하세요</Text>
                <Text style={styles.tipText}>
                  여행 계획은 출발 2-3개월 전에 시작하는 것이 좋습니다. 항공권과 숙소가 저렴할 수 있어요!
                </Text>
              </View>
            </View>
          </Card>
        </Section>
      </FadeIn>

      {/* Bottom Spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // Hero Section
  heroSection: {
    width: '100%',
    height: 360,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing.xl,
  },
  heroContent: {
    padding: theme.spacing.xl,
  },
  heroGreeting: {
    fontSize: 16,
    color: colors.neutral[0],
    marginBottom: theme.spacing.xs,
    opacity: 0.9,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.neutral[0],
    marginBottom: theme.spacing.xs,
  },
  heroSubtitle: {
    fontSize: 18,
    color: colors.neutral[0],
    marginBottom: theme.spacing.lg,
    opacity: 0.9,
  },
  heroActions: {
    marginTop: theme.spacing.md,
  },
  heroCTA: {
    backgroundColor: colors.primary[500],
    ...theme.shadows.lg,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  // Sections
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary[500],
    fontWeight: '600',
  },

  // Destinations
  destinationsScroll: {
    paddingRight: theme.spacing.lg,
  },
  destinationCard: {
    width: CARD_WIDTH,
    height: 400,
    borderRadius: theme.borderRadius.xl,
    marginRight: theme.spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral[800],
    ...theme.shadows.lg,
  },
  destinationImage: {
    width: '100%',
    height: '100%',
  },
  destinationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  destinationBadges: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  transparentBadge: {
    backgroundColor: getColorWithOpacity(colors.neutral[900], 0.6),
  },
  destinationInfo: {
    marginBottom: theme.spacing.md,
  },
  destinationName: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.neutral[0],
    marginBottom: theme.spacing.xs,
  },
  destinationCountry: {
    fontSize: 16,
    color: colors.neutral[200],
    marginBottom: theme.spacing.sm,
  },
  destinationDescription: {
    fontSize: 14,
    color: colors.neutral[300],
    lineHeight: 20,
  },
  destinationActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: getColorWithOpacity(colors.neutral[900], 0.6),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  quickActionDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Tip Card
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: getColorWithOpacity(colors.secondary[500], 0.1),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  tipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

export default HomeScreen;
