import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MapboxService } from './mapbox.service';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly apiKey: string | null = null;
  private readonly MONTHLY_LIMIT = 9500; // Stay under 10,000 free tier
  private monthlyCount = 0;
  private currentMonth = new Date().getMonth();

  constructor(
    private configService: ConfigService,
    private mapboxService: MapboxService,
  ) {
    const key = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (key && key !== '' && !key.includes('your-')) {
      this.apiKey = key;
      this.logger.log('Places service initialized');
    } else {
      this.logger.warn(
        'Google Maps API key not configured — Places autocomplete disabled',
      );
    }
  }

  async autocomplete(
    input: string,
    sessionToken?: string,
    language = 'en',
  ): Promise<{ predictions: PlacePrediction[]; available: boolean }> {
    if (!input || input.trim().length < 2) {
      return { predictions: [], available: true };
    }

    // ===== PHASE 2: Mapbox Fallback Chain =====
    // 1. Try Mapbox first (100K/month free)
    try {
      const mapboxResult = await this.mapboxService.geocodeForward(input, language);
      if (mapboxResult.available && mapboxResult.predictions.length > 0) {
        this.logger.log(`Mapbox success: ${mapboxResult.predictions.length} results`);
        return mapboxResult;
      }
      // Mapbox returned empty or unavailable → fallback to Google
      this.logger.log('Mapbox empty or unavailable, falling back to Google Places');
    } catch (error: any) {
      this.logger.warn(`Mapbox error: ${error.message}, falling back to Google Places`);
    }

    // ===== 2. Fallback to Google Places =====
    // Reset counter on new month
    const now = new Date();
    if (now.getMonth() !== this.currentMonth) {
      this.currentMonth = now.getMonth();
      this.monthlyCount = 0;
    }

    // No API key or exceeded free limit → return unavailable
    if (!this.apiKey || this.monthlyCount >= this.MONTHLY_LIMIT) {
      this.logger.warn('Google Places unavailable (no key or limit exceeded)');
      return { predictions: [], available: false };
    }

    try {
      this.monthlyCount++;
      const params: Record<string, string> = {
        input: input.trim(),
        key: this.apiKey,
        language,
        types: 'establishment|geocode',
      };
      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        { params, timeout: 5000 },
      );

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        this.logger.warn(
          `Places API status: ${data.status} — ${data.error_message || ''}`,
        );
        // Return available:false when API is denied or has errors
        if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
          return { predictions: [], available: false };
        }
        return { predictions: [], available: true };
      }

      const predictions: PlacePrediction[] = (data.predictions || []).map(
        (p: any) => ({
          placeId: p.place_id,
          description: p.description,
          mainText: p.structured_formatting?.main_text || p.description,
          secondaryText: p.structured_formatting?.secondary_text || '',
        }),
      );

      this.logger.log(`Google Places success: ${predictions.length} results`);
      return { predictions, available: true };
    } catch (error: any) {
      this.logger.error(`Google Places error: ${error.message}`);
      return { predictions: [], available: true };
    }
  }

  getUsageStats() {
    return {
      monthlyCount: this.monthlyCount,
      monthlyLimit: this.MONTHLY_LIMIT,
      available: !!this.apiKey && this.monthlyCount < this.MONTHLY_LIMIT,
    };
  }
}
