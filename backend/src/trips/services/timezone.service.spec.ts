import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TimezoneService } from './timezone.service';
import { GeocodingService } from '../../common/services/geocoding.service';

// Mock @googlemaps/google-maps-services-js
const mockGeocode = jest.fn();
const mockTimezone = jest.fn();
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    geocode: mockGeocode,
    timezone: mockTimezone,
  })),
}));

describe('TimezoneService', () => {
  let service: TimezoneService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let geocodingService: jest.Mocked<Partial<GeocodingService>>;

  const mockGeocodeResponse = {
    data: {
      results: [
        {
          geometry: { location: { lat: 35.6762, lng: 139.6503 } },
          formatted_address: 'Tokyo, Japan',
        },
      ],
    },
  };

  const mockTimezoneResponse = {
    data: {
      timeZoneId: 'Asia/Tokyo',
      timeZoneName: 'Japan Standard Time',
      rawOffset: 32400, // +9 hours in seconds
      dstOffset: 0,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheManager = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    geocodingService = {
      geocode: jest.fn(),
      geocodeBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimezoneService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-maps-key') },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: GeocodingService, useValue: geocodingService },
      ],
    }).compile();

    service = module.get<TimezoneService>(TimezoneService);
  });

  describe('constructor', () => {
    it('should initialize when valid API key is provided', () => {
      expect((service as any).apiKey).toBe('test-maps-key');
    });

    it('should not initialize when API key is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TimezoneService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
          { provide: GeocodingService, useValue: geocodingService },
        ],
      }).compile();

      const noKeyService = module.get<TimezoneService>(TimezoneService);
      expect((noKeyService as any).apiKey).toBeNull();
    });
  });

  describe('getLocationInfo', () => {
    it('should return null when API key is not configured', async () => {
      (service as any).apiKey = null;
      const result = await service.getLocationInfo('Tokyo');
      expect(result).toBeNull();
    });

    it('should return location info for valid destination', async () => {
      mockGeocode.mockResolvedValue(mockGeocodeResponse);

      const result = await service.getLocationInfo('Tokyo');

      expect(result).toEqual({
        latitude: 35.6762,
        longitude: 139.6503,
        formattedAddress: 'Tokyo, Japan',
      });
    });

    it('should return null when no geocoding results', async () => {
      mockGeocode.mockResolvedValue({ data: { results: [] } });

      const result = await service.getLocationInfo('NonexistentPlace');
      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockGeocode.mockRejectedValue(new Error('API Error'));

      const result = await service.getLocationInfo('Tokyo');
      expect(result).toBeNull();
    });
  });

  describe('getTimezoneInfo', () => {
    it('should return null when API key is not configured', async () => {
      (service as any).apiKey = null;
      const result = await service.getTimezoneInfo(35.68, 139.76);
      expect(result).toBeNull();
    });

    it('should return timezone info for valid coordinates', async () => {
      mockTimezone.mockResolvedValue(mockTimezoneResponse);

      const result = await service.getTimezoneInfo(
        35.68,
        139.76,
        new Date('2025-07-01T12:00:00Z'),
      );

      expect(result).toBeDefined();
      expect(result!.timezoneId).toBe('Asia/Tokyo');
      expect(result!.timezone).toBe('Japan Standard Time');
      expect(result!.timezoneOffset).toBe(9); // +9 hours
    });

    it('should use current time when no timestamp provided', async () => {
      mockTimezone.mockResolvedValue(mockTimezoneResponse);

      await service.getTimezoneInfo(35.68, 139.76);

      expect(mockTimezone).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            timestamp: expect.any(Number),
          }),
        }),
      );
    });

    it('should handle DST offset', async () => {
      mockTimezone.mockResolvedValue({
        data: {
          timeZoneId: 'America/New_York',
          timeZoneName: 'Eastern Daylight Time',
          rawOffset: -18000, // -5 hours
          dstOffset: 3600, // +1 hour DST
        },
      });

      const result = await service.getTimezoneInfo(40.7128, -74.006);
      expect(result!.timezoneOffset).toBe(-4); // -5 + 1 = -4
    });

    it('should return null on API error', async () => {
      mockTimezone.mockRejectedValue(new Error('Timezone API Error'));

      const result = await service.getTimezoneInfo(35.68, 139.76);
      expect(result).toBeNull();
    });
  });

  describe('getDestinationTimezone', () => {
    it('should return null when geocoding fails', async () => {
      mockGeocode.mockResolvedValue({ data: { results: [] } });

      const result = await service.getDestinationTimezone('Unknown Place');
      expect(result).toBeNull();
    });

    it('should chain geocode + timezone calls', async () => {
      mockGeocode.mockResolvedValue(mockGeocodeResponse);
      mockTimezone.mockResolvedValue(mockTimezoneResponse);

      const result = await service.getDestinationTimezone('Tokyo');

      expect(result).toBeDefined();
      expect(result!.timezoneId).toBe('Asia/Tokyo');
      expect(mockGeocode).toHaveBeenCalled();
      expect(mockTimezone).toHaveBeenCalled();
    });
  });

  describe('geocodeActivities', () => {
    it('should delegate to GeocodingService when available', async () => {
      (geocodingService.geocodeBatch as jest.Mock).mockResolvedValue([
        { latitude: 35.71, longitude: 139.79, source: 'locationiq', confidence: 0.9 },
        { latitude: 35.66, longitude: 139.75, source: 'locationiq', confidence: 0.9 },
      ]);

      const activities = [
        { location: 'Senso-ji' },
        { location: 'Tokyo Tower' },
      ];
      const result = await service.geocodeActivities(activities, 'Tokyo');

      expect(geocodingService.geocodeBatch).toHaveBeenCalledWith([
        'Senso-ji, Tokyo',
        'Tokyo Tower, Tokyo',
      ]);
      expect(result[0]).toEqual({ latitude: 35.71, longitude: 139.79 });
      expect(result[1]).toEqual({ latitude: 35.66, longitude: 139.75 });
    });

    it('should return zero coordinates when GeocodingService returns null', async () => {
      (geocodingService.geocodeBatch as jest.Mock).mockResolvedValue([null]);

      const activities = [{ location: 'Unknown Spot' }];
      const result = await service.geocodeActivities(activities, 'Tokyo');

      expect(result[0]).toEqual({ latitude: 0, longitude: 0 });
    });

    it('should fall back to Google Maps when GeocodingService is not injected', async () => {
      // Create service without GeocodingService
      const module = await Test.createTestingModule({
        providers: [
          TimezoneService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('test-maps-key') },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();

      const fallbackService = module.get<TimezoneService>(TimezoneService);

      mockGeocode.mockResolvedValueOnce({
        data: {
          results: [{ geometry: { location: { lat: 35.71, lng: 139.79 } } }],
        },
      });

      const activities = [{ location: 'Senso-ji' }];
      const result = await fallbackService.geocodeActivities(activities, 'Tokyo');

      expect(result[0]).toEqual({ latitude: 35.71, longitude: 139.79 });
      expect(mockGeocode).toHaveBeenCalled();
    });

    it('should return zero coordinates when API key is missing and no GeocodingService', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TimezoneService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();

      const noKeyService = module.get<TimezoneService>(TimezoneService);
      const activities = [{ location: 'Senso-ji' }];
      const result = await noKeyService.geocodeActivities(activities, 'Tokyo');

      expect(result[0]).toEqual({ latitude: 0, longitude: 0 });
    });
  });

  describe('calculateTimeDifference', () => {
    it('should return no difference message for same timezone', () => {
      const result = service.calculateTimeDifference(9, 'Asia/Tokyo', 'ko');
      // i18n key 'timezone.noDifference' — could be "시차 없음" or similar
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return ahead message for positive difference', () => {
      const result = service.calculateTimeDifference(9, 'UTC', 'en');
      expect(result).toContain('ahead');
    });

    it('should return behind message for negative difference', () => {
      const result = service.calculateTimeDifference(-5, 'UTC', 'en');
      expect(result).toContain('behind');
    });

    it('should support Japanese language', () => {
      const result = service.calculateTimeDifference(9, 'UTC', 'ja');
      // Japanese output should contain time-related text
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatTimezoneInfo', () => {
    it('should format timezone info correctly', () => {
      const info = {
        timezone: 'Japan Standard Time',
        timezoneId: 'Asia/Tokyo',
        timezoneOffset: 9,
        localTime: '2025-07-01T21:00:00.000+09:00',
      };

      const result = service.formatTimezoneInfo(info);

      expect(result.timezone).toBe('Japan Standard Time (Asia/Tokyo)');
      expect(result.offset).toBe('UTC+9');
      expect(result.localTime).toContain('2025-07-01');
    });

    it('should format negative offset correctly', () => {
      const info = {
        timezone: 'Eastern Standard Time',
        timezoneId: 'America/New_York',
        timezoneOffset: -5,
        localTime: '2025-07-01T07:00:00.000-05:00',
      };

      const result = service.formatTimezoneInfo(info);
      expect(result.offset).toBe('UTC-5');
    });

    it('should format half-hour offset correctly', () => {
      const info = {
        timezone: 'India Standard Time',
        timezoneId: 'Asia/Kolkata',
        timezoneOffset: 5.5,
        localTime: '2025-07-01T17:30:00.000+05:30',
      };

      const result = service.formatTimezoneInfo(info);
      expect(result.offset).toBe('UTC+5:30');
    });
  });
});
