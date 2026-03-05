import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Client } from '@googlemaps/google-maps-services-js';
import { DateTime } from 'luxon';
import { t } from '../../common/i18n';
import { GeocodingService } from '../../common/services/geocoding.service';
import { AxiosError } from 'axios';

interface LocationInfo {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

interface TimezoneInfo {
  timezone: string;
  timezoneId: string;
  timezoneOffset: number;
  localTime: string;
}

@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name);
  private googleMapsClient: Client;
  private apiKey: string | null = null;

  /**
   * Sanitize user-controlled strings for safe logging (strip newlines/control chars, truncate).
   */
  private sanitizeForLog(input: string): string {
    return input.replace(/[\r\n\t]+/g, ' ').slice(0, 100);
  }

  /**
   * Sanitize axios/http errors to prevent API key leakage in logs.
   */
  private safeErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      return `${error.code || 'UNKNOWN'} ${error.response?.status || ''}`.trim();
    }
    return error instanceof Error ? error.message : String(error);
  }

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Optional() private geocodingService?: GeocodingService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (apiKey && apiKey !== '' && !apiKey.includes('your-')) {
      this.apiKey = apiKey;
      this.googleMapsClient = new Client({});
      this.logger.log('Google Maps service initialized');
    } else {
      this.logger.warn(
        'Google Maps API key not configured - timezone features will be disabled',
      );
    }
  }

  async getLocationInfo(destination: string): Promise<LocationInfo | null> {
    // Prefer GeocodingService (Redis → DB → LocationIQ free → Google fallback)
    if (this.geocodingService) {
      try {
        const result = await this.geocodingService.geocode(destination);
        if (result) {
          return {
            latitude: result.latitude,
            longitude: result.longitude,
            formattedAddress: destination,
          };
        }
        this.logger.warn(`No geocoding results via GeocodingService for: ${this.sanitizeForLog(destination)}`);
        return null;
      } catch (error) {
        this.logger.warn(
          `GeocodingService failed for "${this.sanitizeForLog(destination)}": ${this.safeErrorMessage(error)}, falling back to Google Maps`,
        );
      }
    }

    // Fallback: direct Google Maps API (backward compat if GeocodingService not injected)
    if (!this.apiKey) {
      this.logger.warn('Google Maps API not configured');
      return null;
    }

    try {
      const response = await this.googleMapsClient.geocode({
        params: {
          address: destination,
          key: this.apiKey,
        },
      });

      if (response.data.results.length === 0) {
        this.logger.warn(`No geocoding results for: ${this.sanitizeForLog(destination)}`);
        return null;
      }

      const result = response.data.results[0];
      const location = result.geometry.location;

      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
      };
    } catch (error) {
      this.logger.error(
        `Failed to geocode destination "${this.sanitizeForLog(destination)}": ${this.safeErrorMessage(error)}`,
      );
      return null;
    }
  }

  async getTimezoneInfo(
    latitude: number,
    longitude: number,
    timestamp?: Date,
  ): Promise<TimezoneInfo | null> {
    if (!this.apiKey) {
      this.logger.warn('Google Maps API not configured');
      return null;
    }

    // Redis cache: round coordinates to 2 decimals (~1.1km precision, same city)
    const cacheKey = `tz:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

    // Check cache (timezone data is very stable — 30 day TTL)
    const cached = await this.cacheManager.get<{ timeZoneId: string; timeZoneName: string; rawOffset: number; dstOffset: number }>(cacheKey);
    if (cached) {
      this.logger.debug(`Timezone cache hit: ${cacheKey}`);
      const targetTimestamp = timestamp || new Date();
      const totalOffset = cached.rawOffset + cached.dstOffset;
      const localDateTime = DateTime.fromJSDate(targetTimestamp, {
        zone: cached.timeZoneId,
      });
      return {
        timezone: cached.timeZoneName,
        timezoneId: cached.timeZoneId,
        timezoneOffset: totalOffset / 3600,
        localTime: localDateTime.toISO() ?? '',
      };
    }

    try {
      const targetTimestamp = timestamp || new Date();
      const unixTimestamp = Math.floor(targetTimestamp.getTime() / 1000);

      const response = await this.googleMapsClient.timezone({
        params: {
          location: { lat: latitude, lng: longitude },
          timestamp: unixTimestamp,
          key: this.apiKey,
        },
      });

      const { timeZoneId, timeZoneName, rawOffset, dstOffset } = response.data;

      // Cache timezone data for 30 days (timezones rarely change)
      await this.cacheManager.set(
        cacheKey,
        { timeZoneId, timeZoneName, rawOffset, dstOffset },
        30 * 24 * 60 * 60 * 1000,
      );

      // Calculate total offset in seconds
      const totalOffset = rawOffset + dstOffset;

      // Get local time using luxon
      const localDateTime = DateTime.fromJSDate(targetTimestamp, {
        zone: timeZoneId,
      });

      return {
        timezone: timeZoneName,
        timezoneId: timeZoneId,
        timezoneOffset: totalOffset / 3600, // Convert to hours
        localTime: localDateTime.toISO() ?? '',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get timezone for coordinates (${latitude}, ${longitude}): ${this.safeErrorMessage(error)}`,
      );
      return null;
    }
  }

  async getDestinationTimezone(
    destination: string,
    date?: Date,
  ): Promise<TimezoneInfo | null> {
    // Get location coordinates
    const locationInfo = await this.getLocationInfo(destination);
    if (!locationInfo) {
      return null;
    }

    // Get timezone information
    return this.getTimezoneInfo(
      locationInfo.latitude,
      locationInfo.longitude,
      date,
    );
  }

  /**
   * Geocode a list of activity locations within a destination context.
   * Delegates to GeocodingService (Redis → DB → LocationIQ → Google fallback chain).
   * Falls back to direct Google Maps API if GeocodingService is not available.
   */
  async geocodeActivities(
    activities: { location: string }[],
    destination: string,
  ): Promise<{ latitude: number; longitude: number }[]> {
    // Prefer GeocodingService (multi-provider fallback chain)
    if (this.geocodingService) {
      const queries = activities.map((a) => `${a.location}, ${destination}`);
      const results = await this.geocodingService.geocodeBatch(queries);
      return results.map((r) =>
        r ? { latitude: r.latitude, longitude: r.longitude } : { latitude: 0, longitude: 0 },
      );
    }

    // Fallback: direct Google Maps (backward compat if GeocodingService not injected)
    if (!this.apiKey) {
      return activities.map(() => ({ latitude: 0, longitude: 0 }));
    }

    const results: { latitude: number; longitude: number }[] = [];
    for (const activity of activities) {
      try {
        const query = `${activity.location}, ${destination}`;
        const response = await this.googleMapsClient.geocode({
          params: { address: query, key: this.apiKey },
        });
        if (response.data.results.length > 0) {
          const loc = response.data.results[0].geometry.location;
          results.push({ latitude: loc.lat, longitude: loc.lng });
        } else {
          results.push({ latitude: 0, longitude: 0 });
        }
      } catch {
        results.push({ latitude: 0, longitude: 0 });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return results;
  }

  /**
   * Calculate time difference between destination and user's timezone
   */
  calculateTimeDifference(
    destinationOffset: number,
    userTimezone: string = 'UTC',
    lang: 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'de' | 'fr' | 'th' | 'vi' | 'pt' | 'ar' | 'id' | 'hi' | 'it' | 'ru' | 'tr' | 'ms' = 'ko',
  ): string {
    const userDateTime = DateTime.now().setZone(userTimezone);
    const userOffset = userDateTime.offset / 60; // Convert minutes to hours

    const difference = destinationOffset - userOffset;

    if (difference === 0) {
      return t('timezone.noDifference', lang);
    }

    const absDiff = Math.abs(difference);
    const hours = Math.floor(absDiff);
    const minutes = Math.round((absDiff - hours) * 60);

    let timeStr = '';
    if (hours > 0) {
      timeStr += `${hours}${t('timezone.hours', lang)}`;
    }
    if (minutes > 0) {
      timeStr += ` ${minutes}${t('timezone.minutes', lang)}`;
    }

    return difference > 0
      ? `${timeStr} ${t('timezone.ahead', lang)}`
      : `${timeStr} ${t('timezone.behind', lang)}`;
  }

  /**
   * Format timezone info for display
   */
  formatTimezoneInfo(timezoneInfo: TimezoneInfo): {
    timezone: string;
    offset: string;
    localTime: string;
  } {
    const offsetHours = Math.floor(Math.abs(timezoneInfo.timezoneOffset));
    const offsetMinutes = Math.round(
      (Math.abs(timezoneInfo.timezoneOffset) - offsetHours) * 60,
    );

    const offsetSign = timezoneInfo.timezoneOffset >= 0 ? '+' : '-';
    const offsetStr =
      offsetMinutes > 0
        ? `UTC${offsetSign}${offsetHours}:${offsetMinutes.toString().padStart(2, '0')}`
        : `UTC${offsetSign}${offsetHours}`;

    const localTime = DateTime.fromISO(timezoneInfo.localTime).toFormat(
      'yyyy-MM-dd HH:mm',
    );

    return {
      timezone: `${timezoneInfo.timezone} (${timezoneInfo.timezoneId})`,
      offset: offsetStr,
      localTime: localTime,
    };
  }
}
