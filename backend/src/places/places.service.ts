import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

  constructor(private configService: ConfigService) {
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
    // Reset counter on new month
    const now = new Date();
    if (now.getMonth() !== this.currentMonth) {
      this.currentMonth = now.getMonth();
      this.monthlyCount = 0;
    }

    // No API key or exceeded free limit → return empty (frontend falls back to text input)
    if (!this.apiKey || this.monthlyCount >= this.MONTHLY_LIMIT) {
      return { predictions: [], available: false };
    }

    if (!input || input.trim().length < 2) {
      return { predictions: [], available: true };
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

      return { predictions, available: true };
    } catch (error: any) {
      this.logger.error(`Places autocomplete error: ${error.message}`);
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
