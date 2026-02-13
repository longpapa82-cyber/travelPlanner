import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import OpenAI from 'openai';
import { ActivityDto } from '../dto/update-itinerary.dto';
import { AnalyticsService } from './analytics.service';
import { TimezoneService } from './timezone.service';

interface TripContext {
  destination: string;
  country?: string;
  city?: string;
  startDate: Date;
  endDate: Date;
  numberOfTravelers: number;
  preferences?: {
    budget?: string;
    travelStyle?: string;
    interests?: string[];
  };
  language?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
};

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(forwardRef(() => AnalyticsService))
    private analyticsService: AnalyticsService,
    private timezoneService: TimezoneService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey !== '' && !apiKey.includes('your-')) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI service initialized');
    } else {
      this.logger.warn(
        'OpenAI API key not configured - AI features will be disabled',
      );
    }
  }

  async generateDailyItinerary(
    tripContext: TripContext,
    dayNumber: number,
    date: Date,
  ): Promise<ActivityDto[]> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, returning empty itinerary');
      return [];
    }

    // Check cache for identical trip context + day
    const lang = tripContext.language || 'ko';
    const cacheKey = `ai:itinerary:${tripContext.destination}:${date.toISOString().split('T')[0]}:${tripContext.preferences?.travelStyle || 'default'}:${lang}`;
    const cached = await this.cacheManager.get<ActivityDto[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for AI itinerary: ${cacheKey}`);
      return cached;
    }

    try {
      // 사용자 데이터 기반 추천 정보 가져오기
      const recommendations =
        await this.analyticsService.getDestinationRecommendations(
          tripContext.destination,
        );

      const prompt = this.buildPrompt(
        tripContext,
        dayNumber,
        date,
        recommendations,
      );

      const langName = LANGUAGE_NAMES[tripContext.language || 'ko'] || 'Korean';
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert travel planner. Generate detailed, realistic daily itineraries in JSON format. Consider travel time, opening hours, and local customs. Activities should be practical and well-timed. IMPORTANT: All text content (title, description, location) MUST be written in ${langName}. Do NOT use English for these fields.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        this.logger.warn('OpenAI returned empty content');
        return [];
      }
      const parsed = JSON.parse(content);

      // Extract activities array from the response
      const activities = parsed.activities || parsed.itinerary || [];

      // Validate and format activities
      const result = this.formatActivities(activities);

      // Geocode activity locations
      try {
        const coords = await this.timezoneService.geocodeActivities(
          result,
          tripContext.destination,
        );
        for (let i = 0; i < result.length; i++) {
          if (coords[i] && coords[i].latitude !== 0) {
            result[i].latitude = coords[i].latitude;
            result[i].longitude = coords[i].longitude;
          }
        }
      } catch (error) {
        this.logger.warn(`Geocoding failed for activities: ${error.message}`);
      }

      // Cache AI response for 24 hours
      await this.cacheManager.set(cacheKey, result, 86400000);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate itinerary for day ${dayNumber}: ${error.message}`,
      );
      return [];
    }
  }

  private buildPrompt(
    context: TripContext,
    dayNumber: number,
    date: Date,
    recommendations?: {
      recommendedDuration: number;
      recommendedTravelers: number;
      bestMonths: number[];
      budget?: string;
      travelStyle?: string;
      topActivities: string[];
    },
  ): string {
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const totalDays =
      Math.ceil(
        (context.endDate.getTime() - context.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    let prompt = `Generate a detailed daily itinerary for day ${dayNumber} of ${totalDays} in ${context.destination}.

Trip Details:
- Destination: ${context.destination}${context.city ? ` (${context.city})` : ''}${context.country ? `, ${context.country}` : ''}
- Date: ${dateStr}
- Number of travelers: ${context.numberOfTravelers}
- Day: ${dayNumber} of ${totalDays}`;

    if (context.preferences) {
      if (context.preferences.budget) {
        prompt += `\n- Budget: ${context.preferences.budget}`;
      }
      if (context.preferences.travelStyle) {
        prompt += `\n- Travel style: ${context.preferences.travelStyle}`;
      }
      if (
        context.preferences.interests &&
        context.preferences.interests.length > 0
      ) {
        prompt += `\n- Interests: ${context.preferences.interests.join(', ')}`;
      }
    }

    // 실제 사용자 데이터 기반 추천 정보 추가
    if (recommendations && recommendations.topActivities.length > 0) {
      prompt += `\n\nInsights from Recent Travelers (Last 3 Months):`;

      if (
        recommendations.recommendedDuration &&
        totalDays !== recommendations.recommendedDuration
      ) {
        prompt += `\n- Most travelers spend ${recommendations.recommendedDuration} days here (you have ${totalDays} days)`;
      }

      if (recommendations.budget) {
        prompt += `\n- Popular budget range: ${recommendations.budget}`;
      }

      if (recommendations.travelStyle) {
        prompt += `\n- Common travel style: ${recommendations.travelStyle}`;
      }

      if (recommendations.bestMonths && recommendations.bestMonths.length > 0) {
        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const bestMonthNames = recommendations.bestMonths.map(
          (m) => monthNames[m - 1],
        );
        const currentMonth = date.getMonth() + 1;
        const isBestMonth = recommendations.bestMonths.includes(currentMonth);
        prompt += `\n- Best months to visit: ${bestMonthNames.join(', ')}${isBestMonth ? " (You're visiting during a popular month!)" : ''}`;
      }

      if (recommendations.topActivities.length > 0) {
        prompt += `\n- Popular activities by recent travelers: ${recommendations.topActivities.slice(0, 10).join(', ')}`;
      }
    }

    if (dayNumber === 1) {
      prompt += '\n\nThis is the first day - include arrival and settling in.';
    } else if (dayNumber === totalDays) {
      prompt += '\n\nThis is the last day - include departure preparations.';
    }

    prompt += `\n\nReturn JSON with this structure:
{
  "activities": [
    {
      "time": "09:00",
      "title": "Activity name",
      "description": "Detailed description including what to do and why",
      "location": "Specific location name and address",
      "estimatedDuration": 120,
      "estimatedCost": 25,
      "type": "sightseeing|food|shopping|transportation|accommodation|culture|entertainment|nature"
    }
  ]
}

Guidelines:
- Create 4-6 activities per day
- Use 24-hour time format (HH:MM)
- Include realistic travel time between locations
- estimatedDuration in minutes
- estimatedCost in USD
- Start around 08:00-09:00, end around 20:00-21:00
- Consider meal times (breakfast, lunch, dinner)
- Include varied activity types
- Be specific about locations (include neighborhoods/districts)`;

    return prompt;
  }

  private formatActivities(rawActivities: any[]): ActivityDto[] {
    return rawActivities
      .filter((activity) => activity && typeof activity === 'object')
      .map((activity) => ({
        time: activity.time || '09:00',
        title: activity.title || activity.name || 'Activity',
        description: activity.description || '',
        location: activity.location || activity.place || '',
        latitude: activity.latitude ? Number(activity.latitude) : undefined,
        longitude: activity.longitude ? Number(activity.longitude) : undefined,
        estimatedDuration: Number(
          activity.estimatedDuration || activity.duration || 60,
        ),
        estimatedCost: Number(activity.estimatedCost || activity.cost || 0),
        type: activity.type || activity.category || 'sightseeing',
      }))
      .filter((activity) => activity.title && activity.location);
  }

  async generateAllItineraries(
    tripContext: TripContext,
  ): Promise<{ dayNumber: number; date: Date; activities: ActivityDto[] }[]> {
    const totalDays =
      Math.ceil(
        (tripContext.endDate.getTime() - tripContext.startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    const itineraries: {
      dayNumber: number;
      date: Date;
      activities: ActivityDto[];
    }[] = [];

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(tripContext.startDate);
      date.setDate(date.getDate() + i);

      const activities = await this.generateDailyItinerary(
        tripContext,
        i + 1,
        date,
      );

      itineraries.push({
        dayNumber: i + 1,
        date,
        activities,
      });

      // Add a small delay to avoid rate limiting
      if (i < totalDays - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return itineraries;
  }
}
