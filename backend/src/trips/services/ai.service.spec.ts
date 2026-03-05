import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AIService } from './ai.service';
import { AnalyticsService } from './analytics.service';
import { TemplateService } from './template.service';
import { TimezoneService } from './timezone.service';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// Helper to create async iterable stream mock matching OpenAI streaming API
function mockStream(content: string) {
  const chunks = [
    { choices: [{ delta: { content } }], usage: null },
    { choices: [{ delta: {} }], usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 } },
  ];
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe('AIService', () => {
  let service: AIService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let analyticsService: jest.Mocked<Partial<AnalyticsService>>;
  let templateService: jest.Mocked<Partial<TemplateService>>;
  let timezoneService: jest.Mocked<Partial<TimezoneService>>;
  let openaiCreate: jest.Mock;

  const tripContext = {
    destination: 'Tokyo',
    country: 'Japan',
    city: 'Tokyo',
    startDate: new Date('2025-07-01'),
    endDate: new Date('2025-07-03'),
    numberOfTravelers: 2,
    preferences: {
      budget: 'moderate',
      travelStyle: 'cultural',
      interests: ['temples', 'food'],
    },
    language: 'en',
  };

  const mockActivitiesResponse = JSON.stringify({
    activities: [
      {
        time: '09:00',
        title: 'Visit Senso-ji Temple',
        description: 'Famous Buddhist temple in Asakusa',
        location: 'Senso-ji Temple, Asakusa, Tokyo',
        estimatedDuration: 90,
        estimatedCost: 0,
        type: 'sightseeing',
      },
      {
        time: '11:30',
        title: 'Lunch at Tsukiji Market',
        description: 'Fresh sushi at the outer market',
        location: 'Tsukiji Outer Market, Chuo, Tokyo',
        estimatedDuration: 60,
        estimatedCost: 20,
        type: 'food',
      },
    ],
  });

  beforeEach(async () => {
    cacheManager = { get: jest.fn(), set: jest.fn() };
    analyticsService = {
      getDestinationRecommendations: jest.fn().mockResolvedValue(null),
    };
    templateService = {
      findTemplate: jest.fn().mockResolvedValue(null),
      saveFromAI: jest.fn().mockResolvedValue(undefined),
      getStaleTemplates: jest.fn().mockResolvedValue([]),
      markVerified: jest.fn().mockResolvedValue(undefined),
    };
    timezoneService = {
      geocodeActivities: jest.fn().mockResolvedValue([
        { latitude: 35.7148, longitude: 139.7967 },
        { latitude: 35.6654, longitude: 139.7707 },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('sk-test-key') },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: TemplateService, useValue: templateService },
        { provide: TimezoneService, useValue: timezoneService },
      ],
    }).compile();

    service = module.get<AIService>(AIService);

    // Access the mocked OpenAI instance
    openaiCreate = (service as any).openai.chat.completions.create;
  });

  describe('constructor', () => {
    it('should initialize OpenAI when valid API key is provided', () => {
      expect((service as any).openai).toBeDefined();
    });

    it('should not initialize OpenAI when API key is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AIService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
          { provide: AnalyticsService, useValue: analyticsService },
          { provide: TemplateService, useValue: templateService },
          { provide: TimezoneService, useValue: timezoneService },
        ],
      }).compile();

      const noKeyService = module.get<AIService>(AIService);
      expect((noKeyService as any).openai).toBeUndefined();
    });

    it('should not initialize OpenAI when API key is placeholder', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AIService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('your-api-key') },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
          { provide: AnalyticsService, useValue: analyticsService },
          { provide: TemplateService, useValue: templateService },
          { provide: TimezoneService, useValue: timezoneService },
        ],
      }).compile();

      const placeholderService = module.get<AIService>(AIService);
      expect((placeholderService as any).openai).toBeUndefined();
    });
  });

  describe('generateDailyItinerary', () => {
    it('should return empty array when OpenAI is not configured', async () => {
      (service as any).openai = undefined;
      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );
      expect(result).toEqual([]);
    });

    it('should return cached result when available', async () => {
      const cachedActivities = [
        {
          time: '09:00',
          title: 'Cached Activity',
          description: '',
          location: 'Tokyo',
          estimatedDuration: 60,
          estimatedCost: 0,
          type: 'sightseeing',
        },
      ];
      cacheManager.get.mockResolvedValue(cachedActivities);

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result).toEqual(cachedActivities);
      expect(openaiCreate).not.toHaveBeenCalled();
    });

    it('should generate activities from OpenAI and cache the result', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Visit Senso-ji Temple');
      expect(result[1].title).toBe('Lunch at Tsukiji Market');
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('ai:itinerary:Tokyo'),
        result,
        86400000,
      );
    });

    it('should include geocoded coordinates in activities', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result[0].latitude).toBe(35.7148);
      expect(result[0].longitude).toBe(139.7967);
    });

    it('should handle geocoding failure gracefully', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));
      (timezoneService.geocodeActivities as jest.Mock).mockRejectedValue(
        new Error('Geocoding API down'),
      );

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      // Activities should still be returned without coordinates
      expect(result.length).toBe(2);
      expect(result[0].latitude).toBeUndefined();
    });

    it('should return empty array when OpenAI returns empty content', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(''));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result).toEqual([]);
    });

    it('should return empty array on OpenAI API error', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result).toEqual([]);
    });

    it('should handle malformed JSON response', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream('not valid json'));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result).toEqual([]);
    });

    it('should use correct cache key including language', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));

      await service.generateDailyItinerary(
        { ...tripContext, language: 'ja' },
        1,
        new Date('2025-07-01'),
      );

      expect(cacheManager.get).toHaveBeenCalledWith(
        expect.stringContaining(':ja'),
      );
    });

    it('should pass analytics recommendations to prompt builder', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));
      (
        analyticsService.getDestinationRecommendations as jest.Mock
      ).mockResolvedValue({
        recommendedDuration: 5,
        recommendedTravelers: 2,
        bestMonths: [3, 4, 10, 11],
        budget: 'moderate',
        travelStyle: 'cultural',
        topActivities: ['temple visit', 'sushi tasting'],
      });

      await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(
        analyticsService.getDestinationRecommendations,
      ).toHaveBeenCalledWith('Tokyo');
      // OpenAI should have been called (prompt includes recommendations)
      expect(openaiCreate).toHaveBeenCalled();
    });

    it('should handle response with "itinerary" key instead of "activities"', async () => {
      cacheManager.get.mockResolvedValue(null);
      const altResponse = JSON.stringify({
        itinerary: [
          {
            time: '10:00',
            title: 'Alt Activity',
            description: 'desc',
            location: 'Tokyo Tower',
            estimatedDuration: 60,
            estimatedCost: 15,
            type: 'sightseeing',
          },
        ],
      });
      openaiCreate.mockResolvedValue(mockStream(altResponse));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Alt Activity');
    });

    it('should filter out activities with missing title or location', async () => {
      cacheManager.get.mockResolvedValue(null);
      const badResponse = JSON.stringify({
        activities: [
          {
            time: '09:00',
            title: 'Good Activity',
            description: 'ok',
            location: 'Tokyo',
            estimatedDuration: 60,
            estimatedCost: 0,
            type: 'sightseeing',
          },
          {
            time: '10:00',
            title: '',
            description: 'no title',
            location: 'Somewhere',
            estimatedDuration: 60,
            estimatedCost: 0,
            type: 'food',
          },
          {
            time: '11:00',
            title: 'No Location',
            description: 'no loc',
            location: '',
            estimatedDuration: 60,
            estimatedCost: 0,
            type: 'food',
          },
          null,
        ],
      });
      openaiCreate.mockResolvedValue(mockStream(badResponse));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      // Empty title falls back to 'Activity' (truthy), so it passes.
      // Empty location remains '' (falsy), so "No Location" is filtered out.
      // null is filtered by the object check.
      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Good Activity');
      expect(result[1].title).toBe('Activity'); // fallback from empty title
    });
  });

  describe('generateAllItineraries', () => {
    const mockFullTripResponse = (days: number) =>
      JSON.stringify({
        days: Array.from({ length: days }, (_, i) => ({
          day: i + 1,
          activities: [
            {
              time: '09:00',
              title: 'Visit Senso-ji Temple',
              description: 'Famous Buddhist temple in Asakusa',
              location: 'Senso-ji Temple, Asakusa, Tokyo',
              estimatedDuration: 90,
              estimatedCost: 0,
              type: 'sightseeing',
            },
            {
              time: '11:30',
              title: 'Lunch at Tsukiji Market',
              description: 'Fresh sushi at the outer market',
              location: 'Tsukiji Outer Market, Chuo, Tokyo',
              estimatedDuration: 60,
              estimatedCost: 20,
              type: 'food',
            },
          ],
        })),
      });

    it('should generate itineraries for all trip days via single prompt', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(2)));

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      expect(result.length).toBe(2);
      expect(result[0].dayNumber).toBe(1);
      expect(result[1].dayNumber).toBe(2);
      expect(result[0].activities.length).toBe(2);
    }, 15000);

    it('should handle single-day trip', async () => {
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(1)));

      const singleDay = {
        ...tripContext,
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-01'),
      };
      const result = await service.generateAllItineraries(singleDay);

      expect(result.length).toBe(1);
      expect(result[0].dayNumber).toBe(1);
    });

    it('should fall back to parallel when single prompt fails', async () => {
      cacheManager.get.mockResolvedValue(null);
      // First call (single prompt) fails with retries (3 attempts), then per-day calls succeed
      openaiCreate
        .mockRejectedValueOnce(new Error('Token limit exceeded'))
        .mockRejectedValueOnce(new Error('Token limit exceeded'))
        .mockRejectedValueOnce(new Error('Token limit exceeded'))
        .mockResolvedValue(mockStream(mockActivitiesResponse));

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      expect(result.length).toBe(2);
      expect(result[0].activities.length).toBe(2);
      expect(result[1].activities.length).toBe(2);
    }, 15000);

    it('should return template data instantly when template cache hits', async () => {
      const mockTemplateResult = {
        days: [
          {
            dayNumber: 1,
            activities: [
              {
                time: '09:00',
                title: 'Cached Temple Visit',
                description: 'From template',
                location: 'Senso-ji Temple',
                estimatedDuration: 90,
                estimatedCost: 0,
                type: 'sightseeing',
              },
            ],
          },
          {
            dayNumber: 2,
            activities: [
              {
                time: '10:00',
                title: 'Cached Market Tour',
                description: 'From template',
                location: 'Tsukiji Market',
                estimatedDuration: 60,
                estimatedCost: 15,
                type: 'food',
              },
            ],
          },
        ],
        templateId: 'tmpl-123',
        generatedAt: new Date(),
        isStale: false,
      };
      (templateService.findTemplate as jest.Mock).mockResolvedValue(
        mockTemplateResult,
      );

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      // Should use template data, NOT call OpenAI
      expect(result.length).toBe(2);
      expect(result[0].activities[0].title).toBe('Cached Temple Visit');
      expect(result[1].activities[0].title).toBe('Cached Market Tour');
      expect(openaiCreate).not.toHaveBeenCalled();
    });

    it('should call AI when template is stale and auto-save result', async () => {
      // Template found but stale → should call AI
      (templateService.findTemplate as jest.Mock).mockResolvedValue({
        days: [],
        templateId: 'tmpl-stale',
        generatedAt: new Date('2024-01-01'),
        isStale: true,
      });
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(2)));

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      expect(result.length).toBe(2);
      expect(openaiCreate).toHaveBeenCalled();
      // Auto-save should be called
      expect(templateService.saveFromAI).toHaveBeenCalled();
    }, 15000);

    it('should fall back to AI when template lookup fails', async () => {
      (templateService.findTemplate as jest.Mock).mockRejectedValue(
        new Error('DB down'),
      );
      cacheManager.get.mockResolvedValue(null);
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(2)));

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      // Should still work via AI fallback
      expect(result.length).toBe(2);
      expect(openaiCreate).toHaveBeenCalled();
    }, 15000);
  });
});
