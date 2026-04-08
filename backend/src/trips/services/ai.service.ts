import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Cron } from '@nestjs/schedule';
import OpenAI from 'openai';
import { ActivityDto } from '../dto/update-itinerary.dto';
import { AnalyticsService } from './analytics.service';
import { TemplateService } from './template.service';
import { TimezoneService } from './timezone.service';
import { ApiUsageService } from '../../admin/api-usage.service';
import { getErrorMessage } from '../../common/types/request.types';
import { withRetry, CircuitBreaker } from '../../common/utils/resilience';

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
  zh: 'Chinese',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  th: 'Thai',
  vi: 'Vietnamese',
  pt: 'Portuguese',
  ar: 'Arabic',
  id: 'Indonesian',
  hi: 'Hindi',
  it: 'Italian',
  ru: 'Russian',
  tr: 'Turkish',
  ms: 'Malay',
};

/**
 * Shared system prompt for OpenAI Prompt Caching.
 * OpenAI automatically caches prompts with 1024+ token prefixes that are identical
 * across requests, providing 50% discount on cached input tokens.
 * This prompt contains stable travel planning knowledge, JSON schema, and guidelines
 * that remain constant across all requests. The language-specific instruction is
 * appended at the end so the shared prefix stays cacheable.
 *
 * Target: ~1200 tokens to exceed the 1024 minimum threshold.
 */
const SYSTEM_PROMPT_BASE = `You are an expert travel planner AI with deep knowledge of global destinations, local customs, transportation, dining, and activities. Your role is to create detailed, practical, and enjoyable travel itineraries.

## Core Principles
1. **Realistic Scheduling**: Account for travel time between locations, opening hours, and local customs (siesta, prayer times, etc.).
2. **Geographic Flow**: Organize activities by proximity to minimize unnecessary travel. Group nearby attractions on the same day.
3. **Local Authenticity**: Prioritize authentic local experiences over tourist traps. Include local restaurants, hidden gems, and cultural experiences.
4. **Practical Details**: Include accurate estimated costs in local currency, realistic time estimates, and transportation recommendations.
5. **Safety & Comfort**: Consider weather, seasonal factors, and traveler comfort. Avoid scheduling strenuous activities back-to-back.
6. **Cultural Sensitivity**: Respect local customs, dress codes for religious sites, and cultural norms.

## Activity Types
Use these exact type values: "sightseeing", "dining", "shopping", "entertainment", "nature", "culture", "sports", "relaxation", "nightlife", "transport", "accommodation", "other".

## JSON Response Schema
Return a valid JSON object. Each activity MUST include:
- "time": string in "HH:MM" format (24-hour), activities should start no earlier than 07:00 and end by 23:00
- "type": one of the activity types listed above
- "title": concise activity name (max 100 characters)
- "location": full address or well-known location name with area/district
- "latitude": number (decimal degrees, e.g., 35.6762)
- "longitude": number (decimal degrees, e.g., 139.6503)
- "description": 2-3 sentences explaining the activity, why it's recommended, and practical tips
- "estimatedCost": number in USD (0 for free activities)
- "estimatedDuration": number in minutes (minimum 30, maximum 480)

## Scheduling Guidelines
- Breakfast: 07:00-09:00 (allow 45-60 min)
- Morning activities: 09:00-12:00
- Lunch: 12:00-13:30 (allow 60-90 min)
- Afternoon activities: 13:30-18:00
- Dinner: 18:00-20:00 (allow 60-120 min)
- Evening activities: 20:00-23:00
- Include 15-30 min transport time between locations
- Plan 4-6 activities per day (not too packed, not too sparse)
- First day: lighter schedule (jet lag consideration)
- Last day: morning activities only (check-out, airport)

## Cost Estimation Guidelines
- Budget meals: $5-15
- Mid-range meals: $15-40
- Fine dining: $40-100+
- Museum/attraction entry: $5-25
- Transport (per trip): $2-15
- Shopping: estimate reasonable amounts
- Free activities: parks, temples (exterior), walking tours = $0

## Multi-Day Trip Guidelines
- Day 1: Arrival day, lighter schedule, nearby attractions
- Middle days: Full exploration, mix of iconic and hidden gems
- Last day: Morning activities, souvenir shopping, departure preparation
- Vary activity types across days (don't cluster all dining or all sightseeing)
- Include at least one unique/memorable experience per day
- Consider day-trip opportunities for nearby cities/towns

## Weather Considerations
- Rainy day alternatives: museums, indoor markets, cooking classes
- Hot weather: morning/evening outdoor activities, midday indoor rest
- Cold weather: warm indoor activities, hot spring visits, cozy cafes

## Budget Level Adjustments
- "budget": Focus on street food, free attractions, public transport, hostels
- "midRange": Mix of local and popular restaurants, some paid attractions, comfortable transport
- "luxury": Fine dining, premium experiences, private tours, first-class transport

## Travel Style Adjustments
- "relaxed": Fewer activities, more free time, spa/wellness, scenic walks
- "balanced": Standard 4-5 activities per day, mix of sightseeing and leisure
- "active": 6+ activities per day, adventure sports, hiking, early starts
- "cultural": Museums, temples, historical sites, traditional experiences, workshops
- "foodie": Food tours, cooking classes, local markets, restaurant recommendations

IMPORTANT: All text content (title, description, location) must be written in the specified language only. Do not mix languages.`;

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;
  private readonly model: string;
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
    private apiUsageService: ApiUsageService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    if (apiKey && apiKey !== '' && !apiKey.includes('your-')) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log(`OpenAI service initialized (model: ${this.model})`);
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
      const content = await this.openaiBreaker.run(() =>
        withRetry(
          () =>
            this.streamCompletion(
              `${SYSTEM_PROMPT_BASE}\n\nLanguage: ${langName}. Return a JSON daily itinerary.`,
              prompt,
              { maxTokens: 4096, label: 'daily itinerary' },
            ),
          2,
          1000,
          'OpenAI daily itinerary',
        ),
      );
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

      // Only geocode activities that lack valid AI-returned coordinates
      const needsGeocoding = result.filter(
        (a) =>
          !a.latitude || !a.longitude || a.latitude === 0 || a.longitude === 0,
      );
      if (needsGeocoding.length > 0) {
        try {
          const coords = await this.timezoneService.geocodeActivities(
            needsGeocoding,
            tripContext.destination,
          );
          let ci = 0;
          for (const activity of result) {
            if (
              !activity.latitude ||
              !activity.longitude ||
              activity.latitude === 0 ||
              activity.longitude === 0
            ) {
              if (coords[ci] && coords[ci].latitude !== 0) {
                activity.latitude = coords[ci].latitude;
                activity.longitude = coords[ci].longitude;
              }
              ci++;
            }
          }
        } catch (error) {
          this.logger.warn(
            `Geocoding failed for activities: ${getErrorMessage(error)}`,
          );
        }
      }

      // Cache AI response for 24 hours
      await this.cacheManager.set(cacheKey, result, 86400000);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to generate itinerary for day ${dayNumber}: ${getErrorMessage(error)}`,
      );
      // Fire-and-forget: log error for dashboard
      this.apiUsageService
        .logApiUsage({
          provider: 'openai',
          feature: 'ai_trip',
          status: 'error',
          errorCode: getErrorMessage(error).slice(0, 100),
          latencyMs: 0,
        })
        .catch(() => {});
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
      const isInternational = !!context.country;
      if (isInternational) {
        prompt += `\n\nThis is the first day of an international trip to ${context.country}.
- Travelers likely arrive by flight; start activities from early afternoon (13:00-14:00) to account for airport transfer and hotel check-in.
- Plan only 2-3 light activities for the first day (nearby sightseeing, local dining).
- Consider jet lag: keep the first day relaxed.
- Include a suggested arrival/transfer activity (e.g., "Airport to hotel") as the first item around 10:00-12:00.`;
      } else {
        prompt +=
          '\n\nThis is the first day - include arrival and settling in.';
      }
    } else if (dayNumber === totalDays) {
      const isInternational = !!context.country;
      if (isInternational) {
        prompt += `\n\nThis is the last day of an international trip.
- Travelers need to catch a flight home; plan only morning activities (before 12:00).
- Include hotel checkout and airport transfer as the last activity.
- Keep it to 1-2 activities maximum.`;
      } else {
        prompt += '\n\nThis is the last day - include departure preparations.';
      }
    }

    prompt += `\n\nRules: 4-6 activities, 24h format (HH:MM), realistic travel time, include meals, varied types, specific locations with lat/lng.

Return JSON:
{"activities":[{"time":"09:00","title":"...","description":"...","location":"...","latitude":0.0,"longitude":0.0,"estimatedDuration":120,"estimatedCost":25,"type":"sightseeing|food|shopping|transportation|accommodation|culture|entertainment|nature"}]}`;

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
          `Template cache HIT [${templateResult.matchType}] for "${tripContext.destination}" ${totalDays}d — skipping AI` +
            (templateResult.similarity
              ? ` (similarity: ${templateResult.similarity.toFixed(3)})`
              : ''),
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

    // Phase C/A: AI generation (fallback — template cache MISS)
    this.logger.log(
      `Template cache MISS for "${tripContext.destination}" ${totalDays}d — calling AI (model: ${this.model})`,
    );
    let itineraries: {
      dayNumber: number;
      date: Date;
      activities: ActivityDto[];
    }[];

    if (totalDays <= 10) {
      itineraries = await this.generateFullTripItinerary(
        tripContext,
        totalDays,
      );
    } else {
      itineraries = await this.generateParallelItineraries(
        tripContext,
        totalDays,
      );
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
    const cached =
      await this.cacheManager.get<
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
      // Dynamic max_tokens based on trip duration
      const maxTokens = totalDays <= 3 ? 4096 : totalDays <= 7 ? 8192 : 12288;

      const content = await this.openaiBreaker.run(() =>
        withRetry(
          () =>
            this.streamCompletion(
              `${SYSTEM_PROMPT_BASE}\n\nLanguage: ${langName}. Return a JSON multi-day itinerary with logical geographic flow.`,
              prompt,
              { maxTokens, label: `full ${totalDays}d trip` },
            ),
          2,
          1000,
          'OpenAI full trip',
        ),
      );
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

      // Only geocode activities that lack valid AI-returned coordinates
      await Promise.allSettled(
        itineraries.map(async (it) => {
          const needsGeocoding = it.activities.filter(
            (a) =>
              !a.latitude ||
              !a.longitude ||
              a.latitude === 0 ||
              a.longitude === 0,
          );
          if (needsGeocoding.length === 0) return;
          try {
            const coords = await this.timezoneService.geocodeActivities(
              needsGeocoding,
              tripContext.destination,
            );
            let ci = 0;
            for (const activity of it.activities) {
              if (
                !activity.latitude ||
                !activity.longitude ||
                activity.latitude === 0 ||
                activity.longitude === 0
              ) {
                if (coords[ci] && coords[ci].latitude !== 0) {
                  activity.latitude = coords[ci].latitude;
                  activity.longitude = coords[ci].longitude;
                }
                ci++;
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
          this.logger.warn(`Parallel day generation failed: ${result.reason}`);
        }
      }
    }

    // Sort by day number (parallel results may arrive out of order)
    itineraries.sort((a, b) => a.dayNumber - b.dayNumber);

    // Fill missing days with empty itineraries
    const result: {
      dayNumber: number;
      date: Date;
      activities: ActivityDto[];
    }[] = [];
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

    prompt += `\n\nRules: Day 1=arrival, Day ${totalDays}=departure. 4-6 activities/day, 24h format, geographic flow, different area/theme per day. Include lat/lng.

Return JSON:
{"days":[{"day":1,"activities":[{"time":"09:00","title":"...","description":"...","location":"...","latitude":0.0,"longitude":0.0,"estimatedDuration":120,"estimatedCost":25,"type":"sightseeing|food|shopping|transportation|accommodation|culture|entertainment|nature"}]}]}`;

    return prompt;
  }

  /**
   * Stream an OpenAI chat completion, accumulate chunks, and return the final content.
   * Uses streaming for lower TTFB while ensuring JSON completeness.
   */
  private async streamCompletion(
    systemPrompt: string,
    userPrompt: string,
    opts: { maxTokens?: number; label?: string } = {},
  ): Promise<string | null> {
    const { maxTokens = 8192, label = 'completion' } = opts;
    const startTime = Date.now();

    const stream = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = '';
    let usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    } | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        content += delta;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    const elapsed = Date.now() - startTime;
    if (usage) {
      this.logger.log(
        `AI ${label} tokens — in: ${usage.prompt_tokens}, out: ${usage.completion_tokens}, total: ${usage.total_tokens} (${elapsed}ms, streamed)`,
      );
      // Fire-and-forget: log API usage for dashboard
      // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
      const costUsd =
        (usage.prompt_tokens * 0.15) / 1_000_000 +
        (usage.completion_tokens * 0.60) / 1_000_000;
      this.apiUsageService
        .logApiUsage({
          provider: 'openai',
          feature: 'ai_trip',
          status: 'success',
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          costUsd,
          latencyMs: elapsed,
        })
        .catch(() => {});
    }

    return content || null;
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
          endDate: new Date(
            Date.now() + (template.durationDays - 1) * 86400000,
          ),
          numberOfTravelers: 2,
          preferences: {
            budget:
              template.budgetLevel !== 'default'
                ? template.budgetLevel
                : undefined,
            travelStyle:
              template.travelStyle !== 'default'
                ? template.travelStyle
                : undefined,
          },
          language: template.language,
        };

        const totalDays = template.durationDays;
        let itineraries: {
          dayNumber: number;
          date: Date;
          activities: ActivityDto[];
        }[];

        if (totalDays <= 10) {
          itineraries = await this.generateFullTripItinerary(
            tripContext,
            totalDays,
          );
        } else {
          itineraries = await this.generateParallelItineraries(
            tripContext,
            totalDays,
          );
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
          this.logger.log(
            `Refreshed stale template: "${template.destination}" ${template.durationDays}d`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to refresh template ${template.id}: ${getErrorMessage(error)}`,
        );
      }
    }

    this.logger.log(
      `Refreshed ${refreshed}/${staleTemplates.length} stale templates`,
    );
    return refreshed;
  }

  /**
   * Cron: Every Sunday at 2 AM, pre-generate templates for top 50 popular destinations.
   * Covers 2/3/4/5/7-day variants in ko, en, ja languages.
   * This dramatically increases template cache hit rate for common searches.
   * Expanded from 20×3×2=120 to 50×5×3=750 combinations for 85%+ cache hit rate.
   */
  @Cron('0 2 * * 0') // Every Sunday at 2 AM
  async handleTemplateWarmup(): Promise<void> {
    if (!this.openai) return;

    try {
      const queue = await this.templateService.getWarmupQueue(
        50,
        [2, 3, 4, 5, 7],
        ['ko', 'en', 'ja'],
      );
      if (queue.length === 0) {
        this.logger.log(
          'Template warmup: all popular destinations already covered',
        );
        return;
      }

      // Process max 10 per run to avoid API overload
      const batch = queue.slice(0, 10);
      let generated = 0;

      for (const item of batch) {
        try {
          const tripContext: TripContext = {
            destination: item.destination,
            country: item.country,
            city: item.city,
            startDate: new Date(),
            endDate: new Date(Date.now() + (item.durationDays - 1) * 86400000),
            numberOfTravelers: 2,
            language: item.language,
          };

          const itineraries = await this.generateFullTripItinerary(
            tripContext,
            item.durationDays,
          );

          if (itineraries.some((it) => it.activities.length > 0)) {
            await this.templateService.saveFromAI(
              {
                destination: item.destination,
                country: item.country,
                city: item.city,
                durationDays: item.durationDays,
                language: item.language,
              },
              itineraries.map((it) => ({
                dayNumber: it.dayNumber,
                activities: it.activities,
              })),
            );
            generated++;
          }

          // Rate limit: wait 2s between AI calls
          await new Promise((r) => setTimeout(r, 2000));
        } catch (error) {
          this.logger.warn(
            `Warmup failed for "${item.destination}" ${item.durationDays}d/${item.language}: ${getErrorMessage(error)}`,
          );
        }
      }

      this.logger.log(
        `Template warmup: generated ${generated}/${batch.length} templates (${queue.length - batch.length} remaining)`,
      );
    } catch (error) {
      this.logger.warn(
        `Template warmup cron failed: ${getErrorMessage(error)}`,
      );
    }
  }
}
