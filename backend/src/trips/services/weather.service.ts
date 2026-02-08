import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

  constructor(private configService: ConfigService) {
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

    try {
      // OpenWeatherMap 5 day forecast API
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat: latitude,
          lon: longitude,
          appid: this.apiKey,
          units: 'metric', // Celsius
        },
      });

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

      return {
        temperature: Math.round(closestForecast.main.temp),
        condition: closestForecast.weather[0].main,
        humidity: closestForecast.main.humidity,
        windSpeed: Math.round(closestForecast.wind.speed * 10) / 10,
        precipitation: closestForecast.pop
          ? Math.round(closestForecast.pop * 100)
          : undefined,
        icon: closestForecast.weather[0].icon,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to get weather forecast: ${error.response?.status} - ${error.response?.data?.message || error.message}`,
        );
      } else {
        this.logger.error(
          `Failed to get weather forecast: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
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
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: latitude,
          lon: longitude,
          appid: this.apiKey,
          units: 'metric',
        },
      });

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
          `Failed to get current weather: ${error.response?.status} - ${error.response?.data?.message || error.message}`,
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
