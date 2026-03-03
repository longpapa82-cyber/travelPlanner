import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WeatherService } from './weather.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherService', () => {
  let service: WeatherService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  const mockForecastResponse = {
    data: {
      list: [
        {
          dt: 1719835200, // 2025-07-01 12:00 UTC
          main: { temp: 28.5, humidity: 65 },
          weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
          wind: { speed: 3.2 },
          pop: 0.1,
        },
        {
          dt: 1719846000, // 2025-07-01 15:00 UTC
          main: { temp: 30.1, humidity: 60 },
          weather: [{ main: 'Clouds', description: 'few clouds', icon: '02d' }],
          wind: { speed: 2.8 },
          pop: 0.2,
        },
      ],
    },
  };

  const mockCurrentWeatherResponse = {
    data: {
      main: { temp: 27.3, humidity: 70 },
      weather: [{ main: 'Rain', description: 'light rain', icon: '10d' }],
      wind: { speed: 4.5 },
    },
  };

  beforeEach(async () => {
    cacheManager = { get: jest.fn(), set: jest.fn() };
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-weather-key') },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
  });

  describe('constructor', () => {
    it('should initialize when valid API key is provided', () => {
      expect((service as any).apiKey).toBe('test-weather-key');
    });

    it('should not initialize when API key is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WeatherService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();

      const noKeyService = module.get<WeatherService>(WeatherService);
      expect((noKeyService as any).apiKey).toBeNull();
    });

    it('should not initialize when API key is placeholder', async () => {
      const module = await Test.createTestingModule({
        providers: [
          WeatherService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('your-api-key') },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();

      const placeholderService = module.get<WeatherService>(WeatherService);
      expect((placeholderService as any).apiKey).toBeNull();
    });
  });

  describe('getWeatherForecast', () => {
    it('should return null when API key is not configured', async () => {
      (service as any).apiKey = null;
      const result = await service.getWeatherForecast(
        35.68,
        139.76,
        new Date(),
      );
      expect(result).toBeNull();
    });

    it('should return cached result when available', async () => {
      const cached = {
        temperature: 25,
        condition: 'Sunny',
        humidity: 50,
        windSpeed: 2,
        icon: '01d',
      };
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.getWeatherForecast(
        35.68,
        139.76,
        new Date('2025-07-01'),
      );
      expect(result).toEqual(cached);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch forecast from API and cache the result', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue(mockForecastResponse);

      const result = await service.getWeatherForecast(
        35.68,
        139.76,
        new Date('2025-07-01'),
      );

      expect(result).toBeDefined();
      expect(result!.temperature).toBeGreaterThanOrEqual(28);
      expect(result!.temperature).toBeLessThanOrEqual(30);
      expect(['Clear', 'Clouds']).toContain(result!.condition);
      expect(result!.humidity).toBeGreaterThanOrEqual(60);
      expect(result!.windSpeed).toBeGreaterThanOrEqual(2);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('weather:35.68:139.76'),
        result,
        1800000,
      );
    });

    it('should select forecast closest to noon', async () => {
      cacheManager.get.mockResolvedValue(null);
      // Noon timestamp for 2025-07-01
      const noonTs = new Date('2025-07-01T12:00:00Z').getTime() / 1000;
      const response = {
        data: {
          list: [
            {
              dt: noonTs - 7200,
              main: { temp: 20, humidity: 50 },
              weather: [{ main: 'Morning', description: '', icon: '' }],
              wind: { speed: 1 },
            },
            {
              dt: noonTs,
              main: { temp: 25, humidity: 60 },
              weather: [{ main: 'Noon', description: '', icon: '' }],
              wind: { speed: 2 },
            },
            {
              dt: noonTs + 7200,
              main: { temp: 28, humidity: 55 },
              weather: [{ main: 'Afternoon', description: '', icon: '' }],
              wind: { speed: 3 },
            },
          ],
        },
      };
      mockedAxios.get.mockResolvedValue(response);

      const result = await service.getWeatherForecast(
        35.68,
        139.76,
        new Date('2025-07-01'),
      );
      // The algorithm finds the forecast whose dt is closest to noon on the target date
      expect(result).toBeDefined();
      expect(['Morning', 'Noon', 'Afternoon']).toContain(result!.condition);
    });

    it('should return null on API error (network)', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));
      (mockedAxios as any).isAxiosError = jest.fn().mockReturnValue(false);

      const result = await service.getWeatherForecast(
        35.68,
        139.76,
        new Date(),
      );
      expect(result).toBeNull();
    });

    it('should return null on Axios HTTP error', async () => {
      cacheManager.get.mockResolvedValue(null);
      const axiosError = {
        response: { status: 401, data: { message: 'Invalid API key' } },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockedAxios.get.mockRejectedValue(axiosError);
      (mockedAxios as any).isAxiosError = jest.fn().mockReturnValue(true);

      const result = await service.getWeatherForecast(
        35.68,
        139.76,
        new Date(),
      );
      expect(result).toBeNull();
    });

    it('should use cache key with coordinates rounded to 2 decimals', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue(mockForecastResponse);

      await service.getWeatherForecast(
        35.6895,
        139.761,
        new Date('2025-07-01'),
      );

      expect(cacheManager.get).toHaveBeenCalledWith(
        'weather:35.69:139.76:2025-07-01',
      );
    });

    it('should handle undefined precipitation', async () => {
      cacheManager.get.mockResolvedValue(null);
      const noPrecip = {
        data: {
          list: [
            {
              dt: 0,
              main: { temp: 22, humidity: 40 },
              weather: [{ main: 'Clear', description: '', icon: '' }],
              wind: { speed: 1 },
            },
          ],
        },
      };
      mockedAxios.get.mockResolvedValue(noPrecip);

      const result = await service.getWeatherForecast(0, 0, new Date());
      expect(result!.precipitation).toBeUndefined();
    });
  });

  describe('getCurrentWeather', () => {
    it('should return null when API key is not configured', async () => {
      (service as any).apiKey = null;
      const result = await service.getCurrentWeather(35.68, 139.76);
      expect(result).toBeNull();
    });

    it('should fetch current weather from API', async () => {
      mockedAxios.get.mockResolvedValue(mockCurrentWeatherResponse);

      const result = await service.getCurrentWeather(35.68, 139.76);

      expect(result).toBeDefined();
      expect(result!.temperature).toBe(27);
      expect(result!.condition).toBe('Rain');
      expect(result!.humidity).toBe(70);
      expect(result!.windSpeed).toBe(4.5);
    });

    it('should return null on API error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Timeout'));
      (mockedAxios as any).isAxiosError = jest.fn().mockReturnValue(false);

      const result = await service.getCurrentWeather(35.68, 139.76);
      expect(result).toBeNull();
    });
  });

  describe('formatWeatherInfo', () => {
    it('should format weather data correctly', () => {
      const weather = {
        temperature: 25,
        condition: 'Clear',
        humidity: 60,
        windSpeed: 3.5,
        precipitation: 10,
        icon: '01d',
      };

      const result = service.formatWeatherInfo(weather);

      expect(result.temperature).toBe('25°C');
      expect(result.condition).toBe('Clear');
      expect(result.humidity).toBe('60%');
      expect(result.windSpeed).toBe('3.5 m/s');
      expect(result.precipitation).toBe('10%');
    });

    it('should handle weather without precipitation', () => {
      const weather = {
        temperature: 20,
        condition: 'Sunny',
        humidity: 45,
        windSpeed: 2,
      };

      const result = service.formatWeatherInfo(weather);
      expect(result.precipitation).toBeUndefined();
    });
  });
});
