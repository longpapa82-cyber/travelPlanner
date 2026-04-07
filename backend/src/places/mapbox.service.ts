import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PlacePrediction } from './places.service';

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);
  private readonly accessToken: string | null = null;
  private readonly MONTHLY_LIMIT = 95000; // Stay under 100,000 free tier
  private monthlyCount = 0;
  private currentMonth = new Date().getMonth();

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('MAPBOX_ACCESS_TOKEN');
    if (token && token !== '' && !token.includes('your-')) {
      this.accessToken = token;
      this.logger.log('Mapbox service initialized');
    } else {
      this.logger.warn(
        'Mapbox access token not configured — Mapbox geocoding disabled',
      );
    }
  }

  async geocodeForward(
    query: string,
    language = 'en',
  ): Promise<{ predictions: PlacePrediction[]; available: boolean }> {
    // Reset counter on new month
    const now = new Date();
    if (now.getMonth() !== this.currentMonth) {
      this.currentMonth = now.getMonth();
      this.monthlyCount = 0;
    }

    // No access token or exceeded free limit → return empty
    if (!this.accessToken || this.monthlyCount >= this.MONTHLY_LIMIT) {
      return { predictions: [], available: false };
    }

    if (!query || query.trim().length < 2) {
      return { predictions: [], available: true };
    }

    try {
      this.monthlyCount++;

      const params = {
        access_token: this.accessToken,
        language,
        limit: 5,
        types: 'place,address,poi',
      };

      const { data } = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        { params, timeout: 5000 },
      );

      if (!data.features || data.features.length === 0) {
        return { predictions: [], available: true };
      }

      const predictions: PlacePrediction[] = data.features.map(
        (feature: any) => {
          // Extract main text (place name)
          const mainText = feature.text || feature.place_name;

          // Extract secondary text (context - city, country)
          const context = feature.context || [];
          const secondaryParts: string[] = [];

          // Add place_type as secondary info
          if (feature.place_type && feature.place_type.length > 0) {
            const placeType = feature.place_type[0];
            if (placeType !== 'address' && placeType !== 'poi') {
              secondaryParts.push(feature.properties?.short_code || placeType);
            }
          }

          // Add context (region, country)
          context.forEach((ctx: any) => {
            if (ctx.id.startsWith('place') || ctx.id.startsWith('region')) {
              secondaryParts.push(ctx.text);
            } else if (ctx.id.startsWith('country')) {
              secondaryParts.push(ctx.short_code?.toUpperCase() || ctx.text);
            }
          });

          const secondaryText = secondaryParts.join(', ');

          return {
            placeId: feature.id,
            description: feature.place_name,
            mainText,
            secondaryText,
            latitude: feature.center?.[1],
            longitude: feature.center?.[0],
          };
        },
      );

      return { predictions, available: true };
    } catch (error: any) {
      this.logger.error(`Mapbox geocoding error: ${error.message}`);

      // Check for API errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        return { predictions: [], available: false };
      }

      return { predictions: [], available: true };
    }
  }

  getUsageStats() {
    return {
      monthlyCount: this.monthlyCount,
      monthlyLimit: this.MONTHLY_LIMIT,
      available: !!this.accessToken && this.monthlyCount < this.MONTHLY_LIMIT,
    };
  }
}
