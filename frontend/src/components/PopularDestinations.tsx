import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import analyticsService, { DestinationStats } from '../services/analytics.service';
import { theme } from '../constants/theme';

interface PopularDestinationsProps {
  onDestinationPress?: (destination: DestinationStats) => void;
}

export const PopularDestinations: React.FC<PopularDestinationsProps> = ({
  onDestinationPress,
}) => {
  const [destinations, setDestinations] = useState<DestinationStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPopularDestinations();
  }, []);

  const loadPopularDestinations = async () => {
    try {
      setLoading(true);
      const data = await analyticsService.getPopularDestinations(5);
      setDestinations(data);
    } catch (error) {
      console.error('Failed to load popular destinations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDestinationPress = (destination: DestinationStats) => {
    if (onDestinationPress) {
      onDestinationPress(destination);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>인기 여행지</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (destinations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trending-up" size={24} color={theme.colors.primary} />
        <Text style={styles.title}>최근 3개월 인기 여행지</Text>
      </View>
      <Text style={styles.subtitle}>
        실제 여행자들이 가장 많이 선택한 여행지를 확인하세요
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {destinations.map((destination, index) => (
          <TouchableOpacity
            key={`${destination.destination}-${index}`}
            style={styles.card}
            onPress={() => handleDestinationPress(destination)}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>

            <Text style={styles.destinationName}>{destination.destination}</Text>
            {destination.city && (
              <Text style={styles.cityName}>{destination.city}</Text>
            )}

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.statText}>{destination.tripCount}명 방문</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="calendar" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.statText}>평균 {destination.averageDuration}일</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="person" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.statText}>
                  {destination.averageTravelers}명과 함께
                </Text>
              </View>
            </View>

            {destination.popularMonths && destination.popularMonths.length > 0 && (
              <View style={styles.monthsContainer}>
                <Text style={styles.monthsLabel}>인기 시즌:</Text>
                <Text style={styles.monthsText}>
                  {destination.popularMonths
                    .map(m => analyticsService.getMonthAbbr(m))
                    .join(', ')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    width: 280,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  rankBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  destinationName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  cityName: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  statsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  monthsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 6,
  },
  monthsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  monthsText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
});

export default PopularDestinations;
