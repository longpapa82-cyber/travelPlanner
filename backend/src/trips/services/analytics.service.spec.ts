import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { Trip, TripStatus } from '../entities/trip.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let _tripRepository: any;

  const mockRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Trip),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    _tripRepository = module.get(getRepositoryToken(Trip));
    jest.clearAllMocks();
  });

  const createMockTrip = (overrides: Partial<Trip> = {}): Trip =>
    ({
      id: 'trip-1',
      destination: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-01-15'),
      numberOfTravelers: 2,
      status: TripStatus.COMPLETED,
      createdAt: new Date(),
      preferences: {},
      itineraries: [],
      ...overrides,
    }) as Trip;

  // ── getPopularDestinations ──

  describe('getPopularDestinations', () => {
    it('should return destinations sorted by trip count', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ destination: 'Tokyo' }),
        createMockTrip({ destination: 'tokyo', id: 'trip-2' }),
        createMockTrip({
          destination: 'Paris',
          country: 'France',
          city: 'Paris',
          id: 'trip-3',
        }),
      ]);

      const result = await service.getPopularDestinations(10);

      expect(result).toHaveLength(2);
      expect(result[0].destination).toBe('Tokyo');
      expect(result[0].tripCount).toBe(2);
      expect(result[1].destination).toBe('Paris');
      expect(result[1].tripCount).toBe(1);
    });

    it('should calculate average duration correctly', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-05'),
        }),
        createMockTrip({
          id: 'trip-2',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-02-10'),
        }),
      ]);

      const result = await service.getPopularDestinations();

      // Trip 1: 5 days, Trip 2: 10 days => avg 8 (rounded)
      expect(result[0].averageDuration).toBe(8);
    });

    it('should calculate average travelers correctly', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ numberOfTravelers: 2 }),
        createMockTrip({ id: 'trip-2', numberOfTravelers: 4 }),
      ]);

      const result = await service.getPopularDestinations();
      expect(result[0].averageTravelers).toBe(3);
    });

    it('should compute popular months (1-indexed)', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ startDate: new Date('2026-01-15') }),
        createMockTrip({ id: 'trip-2', startDate: new Date('2026-01-20') }),
        createMockTrip({ id: 'trip-3', startDate: new Date('2026-03-10') }),
      ]);

      const result = await service.getPopularDestinations();
      // January appears 2x, March 1x => [1, 3]
      expect(result[0].popularMonths).toEqual([1, 3]);
    });

    it('should respect limit parameter', async () => {
      const trips = Array.from({ length: 5 }, (_, i) =>
        createMockTrip({ id: `trip-${i}`, destination: `City${i}` }),
      );
      mockRepository.find.mockResolvedValue(trips);

      const result = await service.getPopularDestinations(2);
      expect(result).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      mockRepository.find.mockRejectedValue(new Error('DB error'));

      const result = await service.getPopularDestinations();
      expect(result).toEqual([]);
    });

    it('should return empty array when no trips found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getPopularDestinations();
      expect(result).toEqual([]);
    });

    it('should group destinations case-insensitively', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ destination: 'TOKYO' }),
        createMockTrip({ id: 'trip-2', destination: 'Tokyo' }),
        createMockTrip({ id: 'trip-3', destination: 'tokyo' }),
      ]);

      const result = await service.getPopularDestinations();
      expect(result).toHaveLength(1);
      expect(result[0].tripCount).toBe(3);
    });
  });

  // ── getTravelTrends ──

  describe('getTravelTrends', () => {
    it('should return trends sorted by popularity', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ destination: 'Tokyo' }),
        createMockTrip({ id: 'trip-2', destination: 'Tokyo' }),
        createMockTrip({ id: 'trip-3', destination: 'Paris' }),
      ]);

      const result = await service.getTravelTrends();

      expect(result).toHaveLength(2);
      expect(result[0].destination).toBe('Tokyo');
      expect(result[0].popularity).toBe(2);
    });

    it('should extract most common budget', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ preferences: { budget: 'moderate' } }),
        createMockTrip({ id: 'trip-2', preferences: { budget: 'moderate' } }),
        createMockTrip({ id: 'trip-3', preferences: { budget: 'luxury' } }),
      ]);

      const result = await service.getTravelTrends();
      expect(result[0].averageBudget).toBe('moderate');
    });

    it('should extract top interests', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ preferences: { interests: ['food', 'culture'] } }),
        createMockTrip({
          id: 'trip-2',
          preferences: { interests: ['food', 'shopping'] },
        }),
      ]);

      const result = await service.getTravelTrends();
      expect(result[0].topInterests[0]).toBe('food');
    });

    it('should handle trips without preferences', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ preferences: undefined }),
        createMockTrip({ id: 'trip-2', preferences: {} }),
      ]);

      const result = await service.getTravelTrends();
      expect(result[0].averageBudget).toBeUndefined();
      expect(result[0].topInterests).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockRepository.find.mockRejectedValue(new Error('DB error'));

      const result = await service.getTravelTrends();
      expect(result).toEqual([]);
    });
  });

  // ── getUserPreferenceStats ──

  describe('getUserPreferenceStats', () => {
    it('should compute budget distribution', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ preferences: { budget: 'budget' } }),
        createMockTrip({ id: 'trip-2', preferences: { budget: 'budget' } }),
        createMockTrip({ id: 'trip-3', preferences: { budget: 'luxury' } }),
      ]);

      const result = await service.getUserPreferenceStats();
      expect(result.budgetDistribution).toEqual({ budget: 2, luxury: 1 });
    });

    it('should compute average duration and travelers', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-04'),
          numberOfTravelers: 2,
        }),
        createMockTrip({
          id: 'trip-2',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-02-06'),
          numberOfTravelers: 4,
        }),
      ]);

      const result = await service.getUserPreferenceStats();
      // Trip 1: 4 days, Trip 2: 6 days => avg 5
      expect(result.averageDuration).toBe(5);
      expect(result.averageTravelers).toBe(3);
    });

    it('should return zeros when no trips', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getUserPreferenceStats();
      expect(result.averageDuration).toBe(0);
      expect(result.averageTravelers).toBe(0);
      expect(result.budgetDistribution).toEqual({});
    });

    it('should return empty stats on error', async () => {
      mockRepository.find.mockRejectedValue(new Error('DB error'));

      const result = await service.getUserPreferenceStats();
      expect(result.averageDuration).toBe(0);
      expect(result.budgetDistribution).toEqual({});
    });
  });

  // ── getDestinationRecommendations ──

  describe('getDestinationRecommendations', () => {
    it('should return recommendations for matching destination', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({
          destination: 'Tokyo, Japan',
          startDate: new Date('2026-01-10'),
          endDate: new Date('2026-01-17'),
          numberOfTravelers: 3,
          preferences: { budget: 'moderate', travelStyle: 'adventure' },
          itineraries: [
            {
              activities: [{ title: 'Temple Visit' }, { title: 'Sushi Tour' }],
            },
          ] as any,
        }),
      ]);

      const result = await service.getDestinationRecommendations('Tokyo');

      expect(result.recommendedDuration).toBe(8); // 8 days
      expect(result.recommendedTravelers).toBe(3);
      expect(result.budget).toBe('moderate');
      expect(result.travelStyle).toBe('adventure');
      expect(result.topActivities).toContain('Temple Visit');
      expect(result.topActivities).toContain('Sushi Tour');
    });

    it('should match destination bidirectionally (partial match)', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ destination: 'Tokyo' }),
      ]);

      // "Tokyo, Japan" includes "Tokyo" → match
      const result =
        await service.getDestinationRecommendations('Tokyo, Japan');
      expect(result.recommendedDuration).toBeGreaterThan(0);
    });

    it('should return defaults when no matching trips', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ destination: 'Paris' }),
      ]);

      const result = await service.getDestinationRecommendations('Tokyo');

      expect(result.recommendedDuration).toBe(5);
      expect(result.recommendedTravelers).toBe(2);
      expect(result.bestMonths).toEqual([]);
      expect(result.topActivities).toEqual([]);
    });

    it('should compute best months', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({
          destination: 'Tokyo',
          startDate: new Date('2026-03-15'),
        }),
        createMockTrip({
          id: 'trip-2',
          destination: 'Tokyo',
          startDate: new Date('2026-03-20'),
        }),
        createMockTrip({
          id: 'trip-3',
          destination: 'Tokyo',
          startDate: new Date('2026-07-10'),
        }),
      ]);

      const result = await service.getDestinationRecommendations('Tokyo');
      expect(result.bestMonths[0]).toBe(3); // March most popular
    });

    it('should return defaults on error', async () => {
      mockRepository.find.mockRejectedValue(new Error('DB error'));

      const result = await service.getDestinationRecommendations('Tokyo');
      expect(result.recommendedDuration).toBe(5);
      expect(result.recommendedTravelers).toBe(2);
    });

    it('should handle trips without itineraries', async () => {
      mockRepository.find.mockResolvedValue([
        createMockTrip({ destination: 'Tokyo', itineraries: undefined }),
      ]);

      const result = await service.getDestinationRecommendations('Tokyo');
      expect(result.topActivities).toEqual([]);
    });
  });
});
