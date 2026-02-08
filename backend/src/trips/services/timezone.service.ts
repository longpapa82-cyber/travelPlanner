import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@googlemaps/google-maps-services-js';
import { DateTime } from 'luxon';

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

  constructor(private configService: ConfigService) {
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
        this.logger.warn(`No geocoding results for: ${destination}`);
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
        `Failed to geocode destination ${destination}: ${error.message}`,
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
        `Failed to get timezone for coordinates (${latitude}, ${longitude}): ${error.message}`,
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
   * Calculate time difference between destination and user's timezone
   */
  calculateTimeDifference(
    destinationOffset: number,
    userTimezone: string = 'UTC',
  ): string {
    const userDateTime = DateTime.now().setZone(userTimezone);
    const userOffset = userDateTime.offset / 60; // Convert minutes to hours

    const difference = destinationOffset - userOffset;

    if (difference === 0) {
      return '시차 없음';
    }

    const absDiff = Math.abs(difference);
    const hours = Math.floor(absDiff);
    const minutes = Math.round((absDiff - hours) * 60);

    let timeStr = '';
    if (hours > 0) {
      timeStr += `${hours}시간`;
    }
    if (minutes > 0) {
      timeStr += ` ${minutes}분`;
    }

    return difference > 0 ? `${timeStr} 빠름` : `${timeStr} 느림`;
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
