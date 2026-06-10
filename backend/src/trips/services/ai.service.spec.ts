import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AIService } from './ai.service';
import { AnalyticsService } from './analytics.service';
import { TemplateService } from './template.service';
import { TimezoneService } from './timezone.service';
import { ApiUsageService } from '../../admin/api-usage.service';

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

// Helper to create async iterable stream mock matching OpenAI streaming API.
// finishReason defaults to 'stop'; pass 'length' to simulate a max_tokens
// truncation (the model cutting off mid-JSON).
function mockStream(content: string, finishReason: string = 'stop') {
  const chunks = [
    { choices: [{ delta: { content }, finish_reason: null }], usage: null },
    {
      choices: [{ delta: {}, finish_reason: finishReason }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    },
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
  let apiUsageLog: jest.Mock;
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
    apiUsageLog = jest.fn().mockResolvedValue(undefined);

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
        {
          provide: ApiUsageService,
          useValue: { logApiUsage: apiUsageLog },
        },
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
          {
            provide: ApiUsageService,
            useValue: { logApiUsage: jest.fn().mockResolvedValue(undefined) },
          },
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
          {
            provide: ApiUsageService,
            useValue: { logApiUsage: jest.fn().mockResolvedValue(undefined) },
          },
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

    it('should always call OpenAI regardless of repeated requests (no cache)', async () => {
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));

      // Call twice with identical arguments
      await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );
      await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      // OpenAI must be called both times — no caching shortcut
      expect(openaiCreate).toHaveBeenCalledTimes(2);
    });

    it('should generate activities from OpenAI without caching the result', async () => {
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));

      const result = await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Visit Senso-ji Temple');
      expect(result[1].title).toBe('Lunch at Tsukiji Market');
      // No cache set — weather context differs per request
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('logs a truncation error when the model hits max_tokens (finish_reason=length)', async () => {
      // Simulate a max_tokens cutoff: valid JSON content but finish_reason=length.
      openaiCreate.mockResolvedValue(
        mockStream(mockActivitiesResponse, 'length'),
      );

      await service.generateDailyItinerary(
        tripContext,
        1,
        new Date('2025-07-01'),
      );

      // Truncation must be surfaced explicitly as an error log for the dashboard,
      // not silently swallowed.
      expect(apiUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          errorCode: expect.stringContaining('truncated_max_tokens'),
        }),
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

    it('should use the correct language in the OpenAI system prompt', async () => {
      openaiCreate.mockResolvedValue(mockStream(mockActivitiesResponse));

      await service.generateDailyItinerary(
        { ...tripContext, language: 'ja' },
        1,
        new Date('2025-07-01'),
      );

      expect(openaiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Japanese'),
            }),
          ]),
        }),
        expect.anything(),
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

    it('should always call OpenAI even when template exists (template is save-only now)', async () => {
      // Template cache is no longer used for serving — each request goes to AI
      // so weather context can be reflected in the generated itinerary.
      (templateService.findTemplate as jest.Mock).mockResolvedValue({
        days: [
          {
            dayNumber: 1,
            activities: [
              {
                time: '09:00',
                title: 'Old Cached Activity',
                location: 'Tokyo',
                estimatedDuration: 60,
                estimatedCost: 0,
                type: 'sightseeing',
              },
            ],
          },
        ],
        templateId: 'tmpl-123',
        generatedAt: new Date(),
        isStale: false,
      });
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(2)));

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      // OpenAI MUST be called — template is no longer used as a serving cache
      expect(openaiCreate).toHaveBeenCalled();
      expect(result.length).toBe(2);
      // Result comes from AI (Senso-ji), not from template (Old Cached Activity)
      expect(result[0].activities[0].title).toBe('Visit Senso-ji Temple');
    }, 15000);

    it('should always call AI and auto-save template after generation', async () => {
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(2)));

      const shortTrip = { ...tripContext, endDate: new Date('2025-07-02') };
      const result = await service.generateAllItineraries(shortTrip);

      expect(result.length).toBe(2);
      expect(openaiCreate).toHaveBeenCalled();
      // Auto-save to template DB must still happen (for analytics/warmup)
      expect(templateService.saveFromAI).toHaveBeenCalled();
    }, 15000);

    // ── Partial-success preservation (long trips) ────────────────────────
    // A long trip routes to generateParallelItineraries (per-day calls).
    // Even when many days fail, the successfully generated days MUST be
    // preserved instead of throwing away the entire trip. Only a total
    // wipe-out (zero days succeed) is treated as a genuine AI failure.
    const longTrip = (days: number) => ({
      ...tripContext,
      startDate: new Date('2025-07-01'),
      endDate: new Date(
        new Date('2025-07-01').getTime() + (days - 1) * 24 * 60 * 60 * 1000,
      ),
    });

    it('preserves succeeded days when >50% of days fail on a long trip', async () => {
      cacheManager.get.mockResolvedValue(null);
      // 10-day trip: make a majority (6) of the per-day calls fail, the rest
      // succeed. Old behaviour threw "Too many days failed" and lost
      // everything; new behaviour must return all 10 days with the failed
      // ones as empty itineraries.
      let call = 0;
      openaiCreate.mockImplementation(() => {
        call++;
        // Fail 6 of the first 10 day-calls, succeed on the others.
        if (call % 10 < 6) {
          return Promise.reject(new Error('OpenAI 500'));
        }
        return Promise.resolve(mockStream(mockActivitiesResponse));
      });

      const result = await service.generateAllItineraries(longTrip(10));

      // Must not throw; must return one entry per day (sorted, gap-filled).
      expect(result.length).toBe(10);
      const succeeded = result.filter((r) => r.activities.length > 0);
      const empty = result.filter((r) => r.activities.length === 0);
      expect(succeeded.length).toBeGreaterThan(0);
      expect(empty.length).toBeGreaterThan(0);
    }, 20000);

    it('throws only when zero days succeed on a long trip', async () => {
      cacheManager.get.mockResolvedValue(null);
      // Every per-day call fails → genuine total failure → must throw so the
      // caller marks aiStatus = "failed".
      openaiCreate.mockRejectedValue(new Error('OpenAI down'));

      await expect(
        service.generateAllItineraries(longTrip(10)),
      ).rejects.toThrow();
    }, 20000);

    it('should inject weatherByDay into the prompt when provided', async () => {
      openaiCreate.mockResolvedValue(mockStream(mockFullTripResponse(2)));

      const weatherMap = new Map([
        [1, { temperature: 28, condition: 'Sunny', precipitation: 10 }],
        [2, { temperature: 15, condition: 'Rain', precipitation: 80 }],
      ]);
      const shortTrip = {
        ...tripContext,
        endDate: new Date('2025-07-02'),
        weatherByDay: weatherMap,
      };
      await service.generateAllItineraries(shortTrip);

      // Prompt must contain weather info for Day 2 rain warning
      expect(openaiCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Rain'),
            }),
          ]),
        }),
        expect.anything(),
      );
    }, 15000);
  });
});
