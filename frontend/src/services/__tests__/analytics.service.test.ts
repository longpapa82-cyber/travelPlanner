jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../offlineCache', () => ({
  offlineCache: {
    get: jest.fn(),
    set: jest.fn(() => Promise.resolve()),
  },
}));

import api from '../api';
import { offlineCache } from '../offlineCache';
import analyticsService from '../analytics.service';

const mockApi = api as unknown as { get: jest.Mock };
const mockCache = offlineCache as jest.Mocked<typeof offlineCache>;

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getPopularDestinations ──

  describe('getPopularDestinations', () => {
    const mockData = [
      {
        destination: 'Tokyo',
        tripCount: 100,
        averageDuration: 5,
        averageTravelers: 2,
        popularMonths: [3, 4, 10],
      },
    ];

    it('should fetch popular destinations from API', async () => {
      mockApi.get.mockResolvedValue({ data: mockData });

      const result = await analyticsService.getPopularDestinations();

      expect(mockApi.get).toHaveBeenCalledWith(
        '/analytics/popular-destinations',
        { params: { limit: 10 } },
      );
      expect(result).toEqual(mockData);
    });

    it('should pass custom limit parameter', async () => {
      mockApi.get.mockResolvedValue({ data: mockData });

      await analyticsService.getPopularDestinations(5);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/analytics/popular-destinations',
        { params: { limit: 5 } },
      );
    });

    it('should cache response on success', async () => {
      mockApi.get.mockResolvedValue({ data: mockData });

      await analyticsService.getPopularDestinations(10);

      expect(mockCache.set).toHaveBeenCalledWith(
        'popular-destinations:10',
        mockData,
      );
    });

    it('should return cached data on API failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      mockCache.get.mockResolvedValue(mockData);

      const result = await analyticsService.getPopularDestinations();

      expect(result).toEqual(mockData);
    });

    it('should return empty array when API fails and no cache', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      mockCache.get.mockResolvedValue(null);

      const result = await analyticsService.getPopularDestinations();

      expect(result).toEqual([]);
    });
  });

  // ── getTravelTrends ──

  describe('getTravelTrends', () => {
    const mockTrends = [
      {
        destination: 'Paris',
        popularity: 95,
        recentCount: 50,
        topInterests: ['culture', 'food'],
      },
    ];

    it('should fetch travel trends from API', async () => {
      mockApi.get.mockResolvedValue({ data: mockTrends });

      const result = await analyticsService.getTravelTrends();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/travel-trends', {
        params: { limit: 10 },
      });
      expect(result).toEqual(mockTrends);
    });

    it('should cache trends on success', async () => {
      mockApi.get.mockResolvedValue({ data: mockTrends });

      await analyticsService.getTravelTrends(5);

      expect(mockCache.set).toHaveBeenCalledWith(
        'travel-trends:5',
        mockTrends,
      );
    });

    it('should fallback to cache on failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Offline'));
      mockCache.get.mockResolvedValue(mockTrends);

      const result = await analyticsService.getTravelTrends();

      expect(result).toEqual(mockTrends);
    });

    it('should return empty array when no cache available', async () => {
      mockApi.get.mockRejectedValue(new Error('Offline'));
      mockCache.get.mockResolvedValue(null);

      const result = await analyticsService.getTravelTrends();

      expect(result).toEqual([]);
    });
  });

  // ── getUserPreferences ──

  describe('getUserPreferences', () => {
    const mockPrefs = {
      budgetDistribution: { low: 30, mid: 50, high: 20 },
      travelStyleDistribution: { adventure: 40, culture: 60 },
      interestDistribution: { food: 70, nature: 30 },
      averageDuration: 6,
      averageTravelers: 2,
    };

    it('should fetch user preferences from API', async () => {
      mockApi.get.mockResolvedValue({ data: mockPrefs });

      const result = await analyticsService.getUserPreferences();

      expect(mockApi.get).toHaveBeenCalledWith('/analytics/user-preferences');
      expect(result).toEqual(mockPrefs);
    });

    it('should cache preferences on success', async () => {
      mockApi.get.mockResolvedValue({ data: mockPrefs });

      await analyticsService.getUserPreferences();

      expect(mockCache.set).toHaveBeenCalledWith('user-preferences', mockPrefs);
    });

    it('should return cached data on failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Auth error'));
      mockCache.get.mockResolvedValue(mockPrefs);

      const result = await analyticsService.getUserPreferences();

      expect(result).toEqual(mockPrefs);
    });

    it('should return null when no cache available', async () => {
      mockApi.get.mockRejectedValue(new Error('Auth error'));
      mockCache.get.mockResolvedValue(null);

      const result = await analyticsService.getUserPreferences();

      expect(result).toBeNull();
    });
  });

  // ── getDestinationRecommendations ──

  describe('getDestinationRecommendations', () => {
    const mockRecs = {
      recommendedDuration: 5,
      recommendedTravelers: 2,
      bestMonths: [3, 4, 10],
      budget: 'mid',
      travelStyle: 'culture',
      topActivities: ['temple visit', 'food tour'],
    };

    it('should fetch recommendations for destination', async () => {
      mockApi.get.mockResolvedValue({ data: mockRecs });

      const result =
        await analyticsService.getDestinationRecommendations('Tokyo');

      expect(mockApi.get).toHaveBeenCalledWith(
        '/analytics/destination-recommendations',
        { params: { destination: 'Tokyo' } },
      );
      expect(result).toEqual(mockRecs);
    });

    it('should return null on failure', async () => {
      mockApi.get.mockRejectedValue(new Error('Not found'));

      const result =
        await analyticsService.getDestinationRecommendations('Unknown');

      expect(result).toBeNull();
    });
  });

  // ── getMonthName ──

  describe('getMonthName', () => {
    it('should return Korean month name for valid months', () => {
      expect(analyticsService.getMonthName(1)).toBe('1월');
      expect(analyticsService.getMonthName(6)).toBe('6월');
      expect(analyticsService.getMonthName(12)).toBe('12월');
    });

    it('should return empty string for invalid month', () => {
      expect(analyticsService.getMonthName(0)).toBe('');
      expect(analyticsService.getMonthName(13)).toBe('');
    });
  });

  // ── getMonthAbbr ──

  describe('getMonthAbbr', () => {
    it('should return English abbreviation for valid months', () => {
      expect(analyticsService.getMonthAbbr(1)).toBe('Jan');
      expect(analyticsService.getMonthAbbr(6)).toBe('Jun');
      expect(analyticsService.getMonthAbbr(12)).toBe('Dec');
    });

    it('should return empty string for invalid month', () => {
      expect(analyticsService.getMonthAbbr(0)).toBe('');
      expect(analyticsService.getMonthAbbr(13)).toBe('');
    });
  });
});
