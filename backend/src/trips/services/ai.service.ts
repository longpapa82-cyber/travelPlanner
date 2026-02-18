import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import OpenAI from 'openai';
import { ActivityDto } from '../dto/update-itinerary.dto';
import { AnalyticsService } from './analytics.service';
import { TemplateService } from './template.service';
import { TimezoneService } from './timezone.service';
import { getErrorMessage } from '../../common/types/request.types';
import {
  withTimeout,
  withRetry,
  CircuitBreaker,
} from '../../common/utils/resilience';

interface RawAiActivity {
  time?: string;
  title?: string;
  name?: string;
  description?: string;
  location?: string;
  place?: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number;
  duration?: number;
  estimatedCost?: number;
  cost?: number;
  type?: string;
  category?: string;
}

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
  private readonly openaiBreaker = new CircuitBreaker({
    name: 'OpenAI',
    failureThreshold: 5,
    resetTimeoutMs: 60_000,
  });

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(forwardRef(() => AnalyticsService))
    private analyticsService: AnalyticsService,
    private templateService: TemplateService,
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
      const completion = await this.openaiBreaker.run(() =>
        withRetry(
          () =>
            withTimeout(
              this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: `You are an expert travel planner. Generate detailed, realistic daily itineraries in JSON format. Consider travel time, opening hours, and local customs. Activities should be practical and well-timed. IMPORTANT: All text content (title, description, location) MUST be written in ${langName}. Do NOT use English for these fields.`,
                  },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' },
              }),
              30_000,
              'OpenAI daily itinerary',
            ),
          2,
          1000,
          'OpenAI daily itinerary',
        ),
      );

      const content = completion.choices[0].message.content;
      if (!content) {
        this.logger.warn('OpenAI returned empty content');
        return [];
      }
      const parsed = JSON.parse(content) as {
        activities?: RawAiActivity[];
        itinerary?: RawAiActivity[];
      };

      // Extract activities array from the response
      const activities: RawAiActivity[] =
        parsed.activities || parsed.itinerary || [];

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
        this.logger.warn(
          `Geocoding failed for activities: ${getErrorMessage(error)}`,
        );
      }

      // Cache AI response for 24 hours
      await this.cacheManager.set(cacheKey, result, 86400000);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate itinerary for day ${dayNumber}: ${getErrorMessage(error)}`,
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

  private formatActivities(rawActivities: RawAiActivity[]): ActivityDto[] {
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

    // Phase 1: Check Template Cache DB first (instant, no AI cost)
    try {
      const templateResult = await this.templateService.findTemplate({
        destination: tripContext.destination,
        durationDays: totalDays,
        travelStyle: tripContext.preferences?.travelStyle,
        budgetLevel: tripContext.preferences?.budget,
        language: tripContext.language,
      });

      if (templateResult && !templateResult.isStale) {
        this.logger.log(
          `Template cache HIT for "${tripContext.destination}" ${totalDays}d — skipping AI`,
        );
        // Map template days to dated itineraries
        return templateResult.days.map((day, i) => {
          const date = new Date(tripContext.startDate);
          date.setDate(date.getDate() + i);
          return {
            dayNumber: day.dayNumber,
            date,
            activities: day.activities as ActivityDto[],
          };
        });
      }

      if (templateResult?.isStale) {
        this.logger.log(
          `Template found but stale (>30d) for "${tripContext.destination}" — refreshing via AI`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Template lookup failed, proceeding to AI: ${getErrorMessage(error)}`,
      );
    }

    // Phase C/A: AI generation (fallback)
    let itineraries: { dayNumber: number; date: Date; activities: ActivityDto[] }[];

    if (totalDays <= 10) {
      itineraries = await this.generateFullTripItinerary(tripContext, totalDays);
    } else {
      itineraries = await this.generateParallelItineraries(tripContext, totalDays);
    }

    // Auto-save AI result as template for future reuse (fire-and-forget)
    this.templateService
      .saveFromAI(
        {
          destination: tripContext.destination,
          country: tripContext.country,
          city: tripContext.city,
          durationDays: totalDays,
          travelStyle: tripContext.preferences?.travelStyle,
          budgetLevel: tripContext.preferences?.budget,
          language: tripContext.language,
        },
        itineraries.map((it) => ({
          dayNumber: it.dayNumber,
          activities: it.activities,
        })),
      )
      .catch((err) =>
        this.logger.warn(`Template auto-save failed: ${getErrorMessage(err)}`),
      );

    return itineraries;
  }

  /**
   * Phase C: Generate the entire trip itinerary in a single API call.
   * Much faster than N sequential calls — typically 3-5s vs 15-50s.
   */
  private async generateFullTripItinerary(
    tripContext: TripContext,
    totalDays: number,
  ): Promise<{ dayNumber: number; date: Date; activities: ActivityDto[] }[]> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, returning empty itineraries');
      return this.buildEmptyItineraries(tripContext, totalDays);
    }

    // Check cache for the full trip
    const lang = tripContext.language || 'ko';
    const startStr = tripContext.startDate.toISOString().split('T')[0];
    const endStr = tripContext.endDate.toISOString().split('T')[0];
    const cacheKey = `ai:fulltrip:${tripContext.destination}:${startStr}:${endStr}:${tripContext.preferences?.travelStyle || 'default'}:${lang}`;
    const cached = await this.cacheManager.get<
      { dayNumber: number; date: Date; activities: ActivityDto[] }[]
    >(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for full trip itinerary: ${cacheKey}`);
      return cached;
    }

    try {
      const recommendations =
        await this.analyticsService.getDestinationRecommendations(
          tripContext.destination,
        );

      const prompt = this.buildFullTripPrompt(
        tripContext,
        totalDays,
        recommendations,
      );

      const langName = LANGUAGE_NAMES[lang] || 'Korean';
      const completion = await this.openaiBreaker.run(() =>
        withRetry(
          () =>
            withTimeout(
              this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: `You are an expert travel planner. Generate a complete multi-day trip itinerary in JSON format. Consider travel time, opening hours, local customs, and logical geographic flow between days. IMPORTANT: All text content (title, description, location) MUST be written in ${langName}. Do NOT use English for these fields.`,
                  },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 4096,
                response_format: { type: 'json_object' },
              }),
              30_000,
              'OpenAI full trip',
            ),
          2,
          1000,
          'OpenAI full trip',
        ),
      );

      const content = completion.choices[0].message.content;
      if (!content) {
        this.logger.warn('OpenAI returned empty content for full trip');
        return this.buildEmptyItineraries(tripContext, totalDays);
      }

      const parsed = JSON.parse(content) as {
        days?: Array<{
          day?: number;
          dayNumber?: number;
          activities?: RawAiActivity[];
          itinerary?: RawAiActivity[];
        }>;
        itinerary?: Array<{
          day?: number;
          dayNumber?: number;
          activities?: RawAiActivity[];
          itinerary?: RawAiActivity[];
        }>;
      };

      const daysData = parsed.days || parsed.itinerary || [];

      const itineraries: {
        dayNumber: number;
        date: Date;
        activities: ActivityDto[];
      }[] = [];

      for (let i = 0; i < totalDays; i++) {
        const date = new Date(tripContext.startDate);
        date.setDate(date.getDate() + i);
        const dayData = daysData[i];
        const rawActivities = dayData
          ? dayData.activities || dayData.itinerary || []
          : [];
        const activities = this.formatActivities(rawActivities);

        itineraries.push({ dayNumber: i + 1, date, activities });
      }

      // Geocode all activities in parallel (batch per day)
      await Promise.allSettled(
        itineraries.map(async (it) => {
          try {
            const coords = await this.timezoneService.geocodeActivities(
              it.activities,
              tripContext.destination,
            );
            for (let j = 0; j < it.activities.length; j++) {
              if (coords[j] && coords[j].latitude !== 0) {
                it.activities[j].latitude = coords[j].latitude;
                it.activities[j].longitude = coords[j].longitude;
              }
            }
          } catch (error) {
            this.logger.warn(
              `Geocoding failed for day ${it.dayNumber}: ${getErrorMessage(error)}`,
            );
          }
        }),
      );

      // Cache for 24 hours
      await this.cacheManager.set(cacheKey, itineraries, 86400000);
      this.logger.log(
        `Generated full ${totalDays}-day itinerary in single API call`,
      );
      return itineraries;
    } catch (error) {
      this.logger.error(
        `Full trip generation failed, falling back to parallel: ${getErrorMessage(error)}`,
      );
      return this.generateParallelItineraries(tripContext, totalDays);
    }
  }

  /**
   * Phase A: Generate itineraries in parallel batches (for long trips or as fallback).
   */
  private async generateParallelItineraries(
    tripContext: TripContext,
    totalDays: number,
  ): Promise<{ dayNumber: number; date: Date; activities: ActivityDto[] }[]> {
    const BATCH_SIZE = 5;
    const itineraries: {
      dayNumber: number;
      date: Date;
      activities: ActivityDto[];
    }[] = [];

    for (let batchStart = 0; batchStart < totalDays; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalDays);
      const batchPromises: Promise<{
        dayNumber: number;
        date: Date;
        activities: ActivityDto[];
      }>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const date = new Date(tripContext.startDate);
        date.setDate(date.getDate() + i);
        const dayNumber = i + 1;

        batchPromises.push(
          this.generateDailyItinerary(tripContext, dayNumber, date).then(
            (activities) => ({ dayNumber, date, activities }),
          ),
        );
      }

      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          itineraries.push(result.value);
        } else {
          this.logger.warn(
            `Parallel day generation failed: ${result.reason}`,
          );
        }
      }
    }

    // Sort by day number (parallel results may arrive out of order)
    itineraries.sort((a, b) => a.dayNumber - b.dayNumber);

    // Fill missing days with empty itineraries
    const result: { dayNumber: number; date: Date; activities: ActivityDto[] }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const existing = itineraries.find((it) => it.dayNumber === i + 1);
      if (existing) {
        result.push(existing);
      } else {
        const date = new Date(tripContext.startDate);
        date.setDate(date.getDate() + i);
        result.push({ dayNumber: i + 1, date, activities: [] });
      }
    }

    this.logger.log(
      `Generated ${totalDays}-day itinerary via parallel batches (batch size: ${BATCH_SIZE})`,
    );
    return result;
  }

  /**
   * Build a single prompt for the entire multi-day trip.
   */
  private buildFullTripPrompt(
    context: TripContext,
    totalDays: number,
    recommendations?: {
      recommendedDuration: number;
      recommendedTravelers: number;
      bestMonths: number[];
      budget?: string;
      travelStyle?: string;
      topActivities: string[];
    },
  ): string {
    const dates: string[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(context.startDate);
      d.setDate(d.getDate() + i);
      dates.push(
        d.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      );
    }

    let prompt = `Generate a complete ${totalDays}-day trip itinerary for ${context.destination}.

Trip Details:
- Destination: ${context.destination}${context.city ? ` (${context.city})` : ''}${context.country ? `, ${context.country}` : ''}
- Dates: ${dates[0]} to ${dates[dates.length - 1]}
- Number of travelers: ${context.numberOfTravelers}
- Total days: ${totalDays}`;

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

    if (recommendations && recommendations.topActivities.length > 0) {
      prompt += `\n\nInsights from Recent Travelers:`;
      if (recommendations.budget) {
        prompt += `\n- Popular budget range: ${recommendations.budget}`;
      }
      if (recommendations.travelStyle) {
        prompt += `\n- Common travel style: ${recommendations.travelStyle}`;
      }
      if (recommendations.topActivities.length > 0) {
        prompt += `\n- Popular activities: ${recommendations.topActivities.slice(0, 10).join(', ')}`;
      }
    }

    prompt += `\n\nIMPORTANT Guidelines:
- Day 1: Include arrival and settling in
- Day ${totalDays}: Include departure preparations
- 4-6 activities per day
- Use 24-hour time format (HH:MM)
- Include realistic travel time between locations
- estimatedDuration in minutes, estimatedCost in USD
- Start around 08:00-09:00, end around 20:00-21:00
- Consider meal times and varied activity types
- Ensure logical geographic flow (don't zigzag across the city)
- Each day should explore a different area/theme

Return JSON:
{
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "time": "09:00",
          "title": "Activity name",
          "description": "Detailed description",
          "location": "Specific location with address",
          "estimatedDuration": 120,
          "estimatedCost": 25,
          "type": "sightseeing|food|shopping|transportation|accommodation|culture|entertainment|nature"
        }
      ]
    }
  ]
}`;

    return prompt;
  }

  private buildEmptyItineraries(
    tripContext: TripContext,
    totalDays: number,
  ): { dayNumber: number; date: Date; activities: ActivityDto[] }[] {
    const itineraries: {
      dayNumber: number;
      date: Date;
      activities: ActivityDto[];
    }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(tripContext.startDate);
      date.setDate(date.getDate() + i);
      itineraries.push({ dayNumber: i + 1, date, activities: [] });
    }
    return itineraries;
  }

  /**
   * Refresh stale templates by re-generating via AI.
   * Called by the scheduled cron job (TemplateService.handleStaleRefresh).
   */
  async refreshStaleTemplates(): Promise<number> {
    const staleTemplates = await this.templateService.getSmartRefreshQueue(5);
    if (staleTemplates.length === 0) return 0;

    let refreshed = 0;
    for (const template of staleTemplates) {
      try {
        const tripContext: TripContext = {
          destination: template.destination,
          country: template.country,
          city: template.city,
          startDate: new Date(),
          endDate: new Date(Date.now() + (template.durationDays - 1) * 86400000),
          numberOfTravelers: 2,
          preferences: {
            budget: template.budgetLevel !== 'default' ? template.budgetLevel : undefined,
            travelStyle: template.travelStyle !== 'default' ? template.travelStyle : undefined,
          },
          language: template.language,
        };

        const totalDays = template.durationDays;
        let itineraries: { dayNumber: number; date: Date; activities: ActivityDto[] }[];

        if (totalDays <= 10) {
          itineraries = await this.generateFullTripItinerary(tripContext, totalDays);
        } else {
          itineraries = await this.generateParallelItineraries(tripContext, totalDays);
        }

        // Update template with fresh data
        if (itineraries.some((it) => it.activities.length > 0)) {
          await this.templateService.saveFromAI(
            {
              destination: template.destination,
              country: template.country,
              city: template.city,
              durationDays: template.durationDays,
              travelStyle: template.travelStyle,
              budgetLevel: template.budgetLevel,
              language: template.language,
            },
            itineraries.map((it) => ({
              dayNumber: it.dayNumber,
              activities: it.activities,
            })),
          );
          refreshed++;
          this.logger.log(`Refreshed stale template: "${template.destination}" ${template.durationDays}d`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to refresh template ${template.id}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(`Refreshed ${refreshed}/${staleTemplates.length} stale templates`);
    return refreshed;
  }
}
