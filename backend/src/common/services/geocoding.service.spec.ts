import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeocodingService } from './geocoding.service';
import { GeocodingCache } from '../entities/geocoding-cache.entity';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeocodingService', () => {
  let service: GeocodingService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let geocodingRepo: {
    findOne: jest.Mock;
    upsert: jest.Mock;
    increment: jest.Mock;
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    geocodingRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeocodingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'LOCATIONIQ_API_KEY') return 'test-locationiq-key';
              if (key === 'GOOGLE_MAPS_API_KEY') return 'test-google-key';
              return undefined;
            }),
          },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: getRepositoryToken(GeocodingCache), useValue: geocodingRepo },
      ],
    }).compile();

    service = module.get<GeocodingService>(GeocodingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('geocode', () => {
    it('should return cached result from Redis', async () => {
      const cached = { latitude: 35.71, longitude: 139.79, source: 'google', confidence: 1.0 };
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.geocode('Senso-ji, Tokyo');

      expect(result).toEqual(cached);
      expect(geocodingRepo.findOne).not.toHaveBeenCalled();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should return cached result from DB and warm Redis', async () => {
      const dbRecord = {
        queryHash: 'abc123',
        query: 'Senso-ji, Tokyo',
        latitude: 35.71,
        longitude: 139.79,
        source: 'locationiq',
        confidence: 0.9,
        hitCount: 5,
      };
      geocodingRepo.findOne.mockResolvedValue(dbRecord);

      const result = await service.geocode('Senso-ji, Tokyo');

      expect(result).toEqual({
        latitude: 35.71,
        longitude: 139.79,
        source: 'locationiq',
        confidence: 0.9,
      });
      expect(cacheManager.set).toHaveBeenCalled();
      expect(geocodingRepo.increment).toHaveBeenCalled();
    });

    it('should call LocationIQ when cache misses', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ lat: '35.71', lon: '139.79' }],
      } as any);

      const result = await service.geocode('Senso-ji, Tokyo');

      expect(result).toEqual({
        latitude: 35.71,
        longitude: 139.79,
        source: 'locationiq',
        confidence: 0.9,
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://us1.locationiq.com/v1/search',
        expect.objectContaining({
          params: expect.objectContaining({ key: 'test-locationiq-key' }),
        }),
      );
    });

    it('should fall back to Google Maps when LocationIQ fails', async () => {
      // LocationIQ fails
      mockedAxios.get
        .mockRejectedValueOnce(new Error('LocationIQ rate limited'))
        // Google Maps succeeds
        .mockResolvedValueOnce({
          data: {
            results: [{ geometry: { location: { lat: 35.71, lng: 139.79 } } }],
          },
        } as any);

      const result = await service.geocode('Senso-ji, Tokyo');

      expect(result).toEqual({
        latitude: 35.71,
        longitude: 139.79,
        source: 'google',
        confidence: 1.0,
      });
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should return null when all providers fail', async () => {
      mockedAxios.get.mockRejectedValue(new Error('All APIs down'));

      const result = await service.geocode('NonexistentPlace');

      expect(result).toBeNull();
    });

    it('should persist results to both Redis and DB', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ lat: '35.71', lon: '139.79' }],
      } as any);

      await service.geocode('Senso-ji, Tokyo');

      expect(cacheManager.set).toHaveBeenCalled();
      // Give fire-and-forget time
      await new Promise((r) => setTimeout(r, 50));
      expect(geocodingRepo.upsert).toHaveBeenCalled();
    });
  });

  describe('geocodeBatch', () => {
    it('should geocode multiple queries', async () => {
      const cached = { latitude: 35.71, longitude: 139.79, source: 'google', confidence: 1.0 };
      cacheManager.get
        .mockResolvedValueOnce(cached)
        .mockResolvedValueOnce(null);
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ lat: '35.66', lon: '139.75' }],
      } as any);

      const results = await service.geocodeBatch([
        'Senso-ji, Tokyo',
        'Tokyo Tower, Tokyo',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(cached);
      expect(results[1]?.latitude).toBe(35.66);
    });
  });

  describe('no API keys configured', () => {
    it('should return null when no API keys are configured', async () => {
      const module = await Test.createTestingModule({
        providers: [
          GeocodingService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
          { provide: getRepositoryToken(GeocodingCache), useValue: geocodingRepo },
        ],
      }).compile();

      const noKeyService = module.get<GeocodingService>(GeocodingService);
      const result = await noKeyService.geocode('Senso-ji, Tokyo');

      expect(result).toBeNull();
    });
  });
});
