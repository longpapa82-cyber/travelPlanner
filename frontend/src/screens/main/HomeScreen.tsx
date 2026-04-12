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

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Animated,
  ImageBackground,
  Platform,
  useWindowDimensions,
  Share,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, TripsStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { colors, getColorWithOpacity } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import Button from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { Badge } from '../../components/core/Badge';
import { Section } from '../../components/layout/Section';
import { FadeIn } from '../../components/animation/FadeIn';
import { SlideIn } from '../../components/animation/SlideIn';
import { Shimmer } from '../../components/animation/Shimmer';
import PopularDestinations from '../../components/PopularDestinations';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import PremiumPromoBanner from '../../components/PremiumPromoBanner';
import apiService from '../../services/api';
import { AdBanner } from '../../components/ads';
import { getDestinationImageUrl, getHeroImageUrl } from '../../utils/images';
import { useTutorial } from '../../contexts/TutorialContext';
import CoachMark from '../../components/tutorial/CoachMark';
import WelcomeModal from '../../components/tutorial/WelcomeModal';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<TripsStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

// Featured destinations with real Unsplash images
const getFeaturedDestinations = (t: TFunction) => [
  {
    id: '1',
    name: t('destinations.tokyo.name'),
    country: t('destinations.tokyo.country'),
    image: getDestinationImageUrl('도쿄'),
    description: t('destinations.tokyo.description'),
    weather: '23°C',
    rating: 4.8,
  },
  {
    id: '2',
    name: t('destinations.osaka.name'),
    country: t('destinations.osaka.country'),
    image: getDestinationImageUrl('오사카'),
    description: t('destinations.osaka.description'),
    weather: '24°C',
    rating: 4.7,
  },
  {
    id: '3',
    name: t('destinations.bangkok.name'),
    country: t('destinations.bangkok.country'),
    image: getDestinationImageUrl('방콕'),
    description: t('destinations.bangkok.description'),
    weather: '32°C',
    rating: 4.6,
  },
  {
    id: '4',
    name: t('destinations.danang.name'),
    country: t('destinations.danang.country'),
    image: getDestinationImageUrl('다낭'),
    description: t('destinations.danang.description'),
    weather: '28°C',
    rating: 4.5,
  },
  {
    id: '5',
    name: t('destinations.paris.name'),
    country: t('destinations.paris.country'),
    image: getDestinationImageUrl('파리'),
    description: t('destinations.paris.description'),
    weather: '18°C',
    rating: 4.9,
  },
  {
    id: '6',
    name: t('destinations.singapore.name'),
    country: t('destinations.singapore.country'),
    image: getDestinationImageUrl('싱가포르'),
    description: t('destinations.singapore.description'),
    weather: '30°C',
    rating: 4.7,
  },
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('home');
  const { t: tTutorial } = useTranslation('tutorial');
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CARD_WIDTH = SCREEN_WIDTH * 0.75;
  const [stats, setStats] = useState({ completed: 0, ongoing: 0, upcoming: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const FEATURED_DESTINATIONS = getFeaturedDestinations(t);

  // Tutorial: CoachMark for "Create Trip" button
  const isFocused = useIsFocused();
  const { showCoachMark, completeCoach, navigateToCreateTrip, clearNavigateFlag } = useTutorial();
  const createTripRef = useRef<View>(null);
  const [createTripLayout, setCreateTripLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (navigateToCreateTrip) {
      clearNavigateFlag();
      navigation.navigate('Trips', { screen: 'CreateTrip' });
    }
  }, [navigateToCreateTrip, clearNavigateFlag, navigation]);

  useEffect(() => {
    if (showCoachMark && createTripRef.current) {
      // Wait longer for entrance animations and layout to stabilize,
      // then re-measure in case scroll position changed.
      const measure = () => {
        createTripRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            setCreateTripLayout({ x, y, width, height });
          }
        });
      };
      // Multiple measurement attempts to handle async layout/animation
      const t1 = setTimeout(measure, 800);
      const t2 = setTimeout(measure, 1500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [showCoachMark]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch trip stats
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const data = await apiService.getTrips();
      // Handle both paginated { trips, total } and legacy array response
      const tripList = Array.isArray(data) ? data : (data?.trips ?? []);
      const completed = tripList.filter((t: any) => t.status === 'completed').length;
      const ongoing = tripList.filter((t: any) => t.status === 'ongoing').length;
      const upcoming = tripList.filter((t: any) => t.status === 'upcoming').length;
      setStats({ completed, ongoing, upcoming });
    } catch (error) {
      // Silent fail - stats are non-critical
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
  }, [fetchStats]);

  useEffect(() => {
    // Start animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
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
    navigation.navigate('Trips', {
      screen: 'CreateTrip',
      params: { destination: destination.name },
    });
  };

  const handleShareDestination = useCallback(async (destination: typeof FEATURED_DESTINATIONS[0]) => {
    try {
      await Share.share({
        message: `${destination.name}, ${destination.country}\n${destination.description}\n\nhttps://mytravel-planner.com`,
      });
    } catch {
      // User cancelled share
    }
  }, []);

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const scrollContent = (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Announcement Banner */}
      <AnnouncementBanner />

      {/* Hero Section */}
      <ImageBackground
        source={{ uri: getHeroImageUrl('travelDefault', { width: 1200 }) }}
        style={styles.heroSection}
        resizeMode="cover"
        testID="home-hero"
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
            <Text style={styles.heroGreeting}>{t('greeting')}</Text>
            <Text style={styles.heroTitle}>{t('heroTitle', { name: user?.name })}</Text>
            <Text style={styles.heroSubtitle}>
              {t('subtitle')}
            </Text>

            <View style={styles.heroActions} ref={createTripRef} collapsable={false}>
              <Button
                variant="primary"
                size="lg"
                icon="star-circle"
                onPress={handleCreateTrip}
                style={styles.heroCTA}
              >
                {t('createTrip')}
              </Button>
            </View>
          </Animated.View>
        </LinearGradient>
      </ImageBackground>

      {/* Quick Stats - Using new Card component */}
      <FadeIn duration={600} delay={200}>
        <View style={styles.statsContainer} testID="trip-stats">
          {isStatsLoading ? (
            <>
              {[colors.primary[500], colors.secondary[500], colors.accent].map((color, i) => (
                <Card key={i} elevation="sm" padding="md" style={styles.statCard}>
                  <Shimmer width={28} height={28} borderRadius={14} />
                  <Shimmer width={40} height={24} borderRadius={4} style={{ marginTop: 8 }} />
                  <Shimmer width={50} height={12} borderRadius={4} style={{ marginTop: 4 }} />
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card elevation="sm" padding="md" style={styles.statCard}>
                <Icon name="airplane-takeoff" size={28} color={colors.primary[500]} />
                <Text style={styles.statValue}>{stats.completed}</Text>
                <Text style={styles.statLabel}>{t('stats.completed')}</Text>
              </Card>

              <Card elevation="sm" padding="md" style={styles.statCard}>
                <Icon name="map-marker-multiple" size={28} color={colors.secondary[500]} />
                <Text style={styles.statValue}>{stats.ongoing}</Text>
                <Text style={styles.statLabel}>{t('stats.ongoing')}</Text>
              </Card>

              <Card elevation="sm" padding="md" style={styles.statCard}>
                <Icon name="calendar-clock" size={28} color={colors.accent} />
                <Text style={styles.statValue}>{stats.upcoming}</Text>
                <Text style={styles.statLabel}>{t('stats.upcoming')}</Text>
              </Card>
            </>
          )}
        </View>
      </FadeIn>

      {/* Popular Destinations from Real Data */}
      <FadeIn duration={600} delay={300}>
        <PopularDestinations
          onDestinationPress={(dest) => {
            navigation.navigate('Trips', {
              screen: 'CreateTrip',
              params: {
                destination: dest.destination,
                duration: dest.averageDuration,
                travelers: dest.averageTravelers,
              },
            });
          }}
        />
      </FadeIn>

      {/* Featured Destinations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{t('featured.title')}</Text>
            <Text style={styles.sectionSubtitle}>{t('featured.subtitle')}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Discover')} accessibilityRole="button" accessibilityLabel={t('featured.seeAll')}>
            <Text style={styles.seeAllText}>{t('featured.seeAll')}</Text>
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
                style={[styles.destinationCard, { width: CARD_WIDTH }]}
                onPress={() => handleDestinationPress(destination)}
                activeOpacity={0.9}
                accessibilityLabel={`${destination.name}, ${destination.country} - ${t('createTrip')}`}
                accessibilityRole="button"
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
                    <TouchableOpacity
                      style={styles.ctaButton}
                      onPress={() => handleDestinationPress(destination)}
                      accessibilityLabel={`${destination.name} - ${t('createTrip')}`}
                      accessibilityRole="button"
                    >
                      <Icon name="plus-circle" size={18} color={colors.neutral[0]} />
                      <Text style={styles.ctaButtonText}>{t('createTrip')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleShareDestination(destination)}
                      accessibilityLabel={`${t('common:share')} ${destination.name}`}
                      accessibilityRole="button"
                    >
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
        <Section title={t('quickActions.title')} padding="lg" spacing="md">
          <View style={styles.quickActionsGrid}>
            <Card
              elevation="sm"
              padding="lg"
              onPress={handleViewTrips}
              style={styles.quickActionCard}
              accessibilityRole="button"
              accessibilityLabel={t('quickActions.myTrips')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: isDark ? `${colors.primary[500]}20` : colors.primary[100] }]}>
                <Icon name="map-marker-multiple" size={28} color={isDark ? colors.primary[400] : colors.primary[600]} />
              </View>
              <Text style={styles.quickActionTitle}>{t('quickActions.myTrips')}</Text>
              <Text style={styles.quickActionDescription}>
                {t('quickActions.myTripsDesc')}
              </Text>
            </Card>

            <Card
              elevation="sm"
              padding="lg"
              onPress={() => navigation.navigate('Discover')}
              style={styles.quickActionCard}
              accessibilityRole="button"
              accessibilityLabel={t('quickActions.inspiration')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: isDark ? `${colors.secondary[500]}20` : colors.secondary[100] }]}>
                <Icon name="compass-outline" size={28} color={isDark ? colors.secondary[400] : colors.secondary[600]} />
              </View>
              <Text style={styles.quickActionTitle}>{t('quickActions.inspiration')}</Text>
              <Text style={styles.quickActionDescription}>
                {t('quickActions.inspirationDesc')}
              </Text>
            </Card>
          </View>
        </Section>
      </SlideIn>

      {/* Premium Promo Banner — free users only */}
      <PremiumPromoBanner />

      {/* Travel Tips */}
      <FadeIn duration={600} delay={600}>
        <Section title={t('tip.sectionTitle')} padding="lg" spacing="md">
          <Card elevation="sm" padding="lg">
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.tipIconContainer}>
                <Icon name="lightbulb" size={24} color={colors.secondary[500]} />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{t('tip.title')}</Text>
                <Text style={styles.tipText}>
                  {t('tip.description')}
                </Text>
              </View>
            </View>
          </Card>
        </Section>
      </FadeIn>

      {/* Ad Banner */}
      <AdBanner size="adaptive" style={{ marginHorizontal: 16 }} />

      {/* Bottom Spacing */}
      <View style={{ height: 40 }} />

      {/* Tutorial: Welcome Modal + CoachMark */}
      <WelcomeModal />
      <CoachMark
        visible={showCoachMark && isFocused}
        targetLayout={createTripLayout}
        message={tTutorial('coach.createTrip')}
        position="above"
        onNext={completeCoach}
        onDismiss={completeCoach}
      />
    </ScrollView>
  );

  return scrollContent;
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
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: getColorWithOpacity(colors.primary[500], 0.85),
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[0],
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
