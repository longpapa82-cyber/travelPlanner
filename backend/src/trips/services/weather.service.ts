import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import axios from 'axios';
import {
  withTimeout,
  withRetry,
  CircuitBreaker,
} from '../../common/utils/resilience';
import { ApiUsageService } from '../../admin/api-usage.service';

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitation?: number;
  icon?: string;
}

interface WeatherForecast {
  dt: number;
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  pop?: number; // Probability of precipitation
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private apiKey: string | null = null;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly weatherBreaker = new CircuitBreaker({
    name: 'OpenWeather',
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
  });

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Optional() private apiUsageService?: ApiUsageService,
  ) {
    const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
    if (apiKey && apiKey !== '' && !apiKey.includes('your-')) {
      this.apiKey = apiKey;
      this.logger.log('OpenWeather service initialized');
    } else {
      this.logger.warn(
        'OpenWeather API key not configured - weather features will be disabled',
      );
    }
  }

  /**
   * Get weather forecast for a specific date at given coordinates
   */
  async getWeatherForecast(
    latitude: number,
    longitude: number,
    date: Date,
  ): Promise<WeatherData | null> {
    if (!this.apiKey) {
      this.logger.warn('OpenWeather API not configured');
      return null;
    }

    // Check cache (key: lat/lon rounded to 2 decimals + date)
    const dateStr = date.toISOString().split('T')[0];
    const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${dateStr}`;
    const cached = await this.cacheManager.get<WeatherData>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for weather: ${cacheKey}`);
      return cached;
    }

    try {
      // OpenWeatherMap 5 day forecast API — with timeout, retry, circuit breaker
      const response = await this.weatherBreaker.run(() =>
        withRetry(
          () =>
            withTimeout(
              axios.get<{ list: WeatherForecast[] }>(
                `${this.baseUrl}/forecast`,
                {
                  params: {
                    lat: latitude,
                    lon: longitude,
                    appid: this.apiKey,
                    units: 'metric',
                  },
                  timeout: 5000,
                },
              ),
              5000,
              'Weather forecast',
            ),
          1,
          1000,
          'Weather forecast',
        ),
      );

      const forecasts: WeatherForecast[] = response.data.list;

      // Find the forecast closest to the target date (at noon)
      const targetDate = new Date(date);
      targetDate.setHours(12, 0, 0, 0);
      const targetTimestamp = targetDate.getTime() / 1000;

      // Find closest forecast to noon on target date
      let closestForecast = forecasts[0];
      let minDiff = Math.abs(forecasts[0].dt - targetTimestamp);

      for (const forecast of forecasts) {
        const diff = Math.abs(forecast.dt - targetTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestForecast = forecast;
        }
      }

      const result: WeatherData = {
        temperature: Math.round(closestForecast.main.temp),
        condition: closestForecast.weather[0].main,
        humidity: closestForecast.main.humidity,
        windSpeed: Math.round(closestForecast.wind.speed * 10) / 10,
        precipitation: closestForecast.pop
          ? Math.round(closestForecast.pop * 100)
          : undefined,
        icon: closestForecast.weather[0].icon,
      };

      // Cache for 6 hours (weather forecasts are stable enough)
      await this.cacheManager.set(cacheKey, result, 6 * 60 * 60 * 1000);
      // Fire-and-forget: log API usage
      this.apiUsageService
        ?.logApiUsage({
          provider: 'openweather',
          feature: 'weather',
          status: 'success',
        })
        .catch(() => {});
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to get weather forecast: ${error.response?.status} - ${(error.response?.data as { message?: string })?.message || error.message}`,
        );
      } else {
        this.logger.error(
          `Failed to get weather forecast: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
      // Fire-and-forget: log error
      this.apiUsageService
        ?.logApiUsage({
          provider: 'openweather',
          feature: 'weather',
          status: 'error',
          errorCode: axios.isAxiosError(error) ? `HTTP ${error.response?.status || 'unknown'}` : (error instanceof Error ? error.message.slice(0, 100) : 'Unknown'),
        })
        .catch(() => {});
      return null;
    }
  }

  /**
   * Get current weather for given coordinates
   */
  async getCurrentWeather(
    latitude: number,
    longitude: number,
  ): Promise<WeatherData | null> {
    if (!this.apiKey) {
      this.logger.warn('OpenWeather API not configured');
      return null;
    }

    try {
      const response = await this.weatherBreaker.run(() =>
        withTimeout(
          axios.get<{
            main: { temp: number; humidity: number };
            weather: Array<{ main: string; icon: string }>;
            wind: { speed: number };
          }>(`${this.baseUrl}/weather`, {
            params: {
              lat: latitude,
              lon: longitude,
              appid: this.apiKey,
              units: 'metric',
            },
            timeout: 5000,
          }),
          5000,
          'Current weather',
        ),
      );

      return {
        temperature: Math.round(response.data.main.temp),
        condition: response.data.weather[0].main,
        humidity: response.data.main.humidity,
        windSpeed: Math.round(response.data.wind.speed * 10) / 10,
        icon: response.data.weather[0].icon,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to get current weather: ${error.response?.status} - ${(error.response?.data as { message?: string })?.message || error.message}`,
        );
      } else {
        this.logger.error(
          `Failed to get current weather: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
      return null;
    }
  }

  /**
   * Get weather forecasts for a date range in a single API call.
   * OpenWeather /forecast returns 5 days of data — dates beyond 5 days return null.
   * Each day's result is individually cached for reuse by getWeatherForecast().
   */
  async getWeatherForDateRange(
    latitude: number,
    longitude: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Map<number, WeatherData>> {
    const result = new Map<number, WeatherData>();
    if (!this.apiKey) return result;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // OpenWeather free tier only provides 5-day forecasts
    const forecastableDays = Math.min(totalDays, 5);

    // Check cache for all dates first
    const uncachedDays: number[] = [];
    for (let i = 0; i < forecastableDays; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${dateStr}`;
      const cached = await this.cacheManager.get<WeatherData>(cacheKey);
      if (cached) {
        result.set(i + 1, cached);
      } else {
        uncachedDays.push(i);
      }
    }

    // If all days cached, return immediately
    if (uncachedDays.length === 0) {
      this.logger.debug(`Weather range: all ${forecastableDays} days cached`);
      return result;
    }

    // Single API call for all uncached days
    try {
      const response = await this.weatherBreaker.run(() =>
        withRetry(
          () =>
            withTimeout(
              axios.get<{ list: WeatherForecast[] }>(
                `${this.baseUrl}/forecast`,
                {
                  params: {
                    lat: latitude,
                    lon: longitude,
                    appid: this.apiKey,
                    units: 'metric',
                  },
                  timeout: 5000,
                },
              ),
              5000,
              'Weather forecast range',
            ),
          1,
          1000,
          'Weather forecast range',
        ),
      );

      const forecasts: WeatherForecast[] = response.data.list;

      // Parse forecasts for each uncached day
      for (const dayIndex of uncachedDays) {
        const date = new Date(start);
        date.setDate(date.getDate() + dayIndex);
        const targetDate = new Date(date);
        targetDate.setHours(12, 0, 0, 0);
        const targetTimestamp = targetDate.getTime() / 1000;

        // Find closest forecast to noon on target date
        let closestForecast = forecasts[0];
        let minDiff = Math.abs(forecasts[0].dt - targetTimestamp);

        for (const forecast of forecasts) {
          const diff = Math.abs(forecast.dt - targetTimestamp);
          if (diff < minDiff) {
            minDiff = diff;
            closestForecast = forecast;
          }
        }

        const weatherData: WeatherData = {
          temperature: Math.round(closestForecast.main.temp),
          condition: closestForecast.weather[0].main,
          humidity: closestForecast.main.humidity,
          windSpeed: Math.round(closestForecast.wind.speed * 10) / 10,
          precipitation: closestForecast.pop
            ? Math.round(closestForecast.pop * 100)
            : undefined,
          icon: closestForecast.weather[0].icon,
        };

        // Cache each day individually (6 hour TTL)
        const dateStr = date.toISOString().split('T')[0];
        const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${dateStr}`;
        await this.cacheManager.set(cacheKey, weatherData, 6 * 60 * 60 * 1000);

        result.set(dayIndex + 1, weatherData);
      }

      this.logger.log(
        `Weather range: fetched ${uncachedDays.length} days in 1 API call (${forecastableDays} forecastable of ${totalDays} total)`,
      );
      // Fire-and-forget: log API usage (single API call for the range)
      this.apiUsageService
        ?.logApiUsage({
          provider: 'openweather',
          feature: 'weather',
          status: 'success',
        })
        .catch(() => {});
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to get weather range: ${error.response?.status} - ${(error.response?.data as { message?: string })?.message || error.message}`,
        );
      } else {
        this.logger.error(
          `Failed to get weather range: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
      // Fire-and-forget: log error
      this.apiUsageService
        ?.logApiUsage({
          provider: 'openweather',
          feature: 'weather',
          status: 'error',
          errorCode: axios.isAxiosError(error) ? `HTTP ${error.response?.status || 'unknown'}` : (error instanceof Error ? error.message.slice(0, 100) : 'Unknown'),
        })
        .catch(() => {});
    }

    return result;
  }

  /**
   * Format weather data for display
   */
  formatWeatherInfo(weather: WeatherData): {
    temperature: string;
    condition: string;
    humidity: string;
    windSpeed: string;
    precipitation?: string;
  } {
    return {
      temperature: `${weather.temperature}°C`,
      condition: weather.condition,
      humidity: `${weather.humidity}%`,
      windSpeed: `${weather.windSpeed} m/s`,
      precipitation: weather.precipitation
        ? `${weather.precipitation}%`
        : undefined,
    };
  }
}
