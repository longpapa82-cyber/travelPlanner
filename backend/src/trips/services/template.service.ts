import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ItineraryTemplate } from '../entities/itinerary-template.entity';
import { Activity } from '../entities/itinerary.entity';
import { ActivityDto } from '../dto/update-itinerary.dto';

/** Template lookup parameters */
export interface TemplateLookupParams {
  destination: string;
  durationDays: number;
  travelStyle?: string;
  budgetLevel?: string;
  language?: string;
}

/** Result returned from template lookup */
export interface TemplateResult {
  days: Array<{ dayNumber: number; activities: Activity[] }>;
  templateId: string;
  generatedAt: Date;
  isStale: boolean;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  /** Templates older than this are considered stale */
  private readonly STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    @InjectRepository(ItineraryTemplate)
    private readonly templateRepo: Repository<ItineraryTemplate>,
  ) {}

  /**
   * Normalize destination string for consistent lookups.
   * "Tokyo, Japan" → "tokyo"
   * "파리" → "파리"
   */
  private normalize(destination: string): string {
    return destination
      .split(',')[0] // Take city part before comma
      .trim()
      .toLowerCase();
  }

  /**
   * Find a matching template. Tries exact match first, then relaxed match.
   * Returns null if no suitable template exists.
   */
  async findTemplate(params: TemplateLookupParams): Promise<TemplateResult | null> {
    const normalized = this.normalize(params.destination);
    const style = params.travelStyle || 'default';
    const budget = params.budgetLevel || 'default';
    const lang = params.language || 'ko';

    // 1. Exact match: destination + duration + style + budget + language
    let template = await this.templateRepo.findOne({
      where: {
        destinationNormalized: normalized,
        durationDays: params.durationDays,
        travelStyle: style,
        budgetLevel: budget,
        language: lang,
      },
    });

    // 2. Relaxed match: destination + duration + language (ignore style/budget)
    if (!template) {
      template = await this.templateRepo.findOne({
        where: {
          destinationNormalized: normalized,
          durationDays: params.durationDays,
          language: lang,
        },
        order: { popularity: 'DESC' },
      });
    }

    // 3. Duration-flexible match: destination + language, closest duration
    if (!template) {
      template = await this.templateRepo
        .createQueryBuilder('t')
        .where('t.destinationNormalized = :normalized', { normalized })
        .andWhere('t.language = :lang', { lang })
        .orderBy(`ABS(t.durationDays - :duration)`, 'ASC')
        .setParameter('duration', params.durationDays)
        .addOrderBy('t.popularity', 'DESC')
        .getOne();
    }

    if (!template) {
      return null;
    }

    // Bump popularity counter (fire-and-forget)
    this.templateRepo
      .increment({ id: template.id }, 'popularity', 1)
      .catch(() => {});

    const isStale =
      Date.now() - new Date(template.lastVerifiedAt).getTime() >
      this.STALE_THRESHOLD_MS;

    this.logger.log(
      `Template hit: "${params.destination}" ${params.durationDays}d [${style}/${budget}/${lang}] → ${template.id} (stale: ${isStale})`,
    );

    return {
      days: template.days,
      templateId: template.id,
      generatedAt: template.generatedAt,
      isStale,
    };
  }

  /**
   * Save AI-generated itinerary as a template for future reuse.
   * Uses upsert to avoid duplicates.
   */
  async saveFromAI(
    params: {
      destination: string;
      country?: string;
      city?: string;
      durationDays: number;
      travelStyle?: string;
      budgetLevel?: string;
      language?: string;
    },
    days: Array<{ dayNumber: number; activities: ActivityDto[] }>,
  ): Promise<void> {
    // Skip saving if there are no meaningful activities
    const totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);
    if (totalActivities === 0) {
      return;
    }

    const normalized = this.normalize(params.destination);
    const style = params.travelStyle || 'default';
    const budget = params.budgetLevel || 'default';
    const lang = params.language || 'ko';
    const now = new Date();

    try {
      // Check if template already exists
      const existing = await this.templateRepo.findOne({
        where: {
          destinationNormalized: normalized,
          durationDays: params.durationDays,
          travelStyle: style,
          budgetLevel: budget,
          language: lang,
        },
      });

      if (existing) {
        // Update existing template
        existing.days = days as Array<{ dayNumber: number; activities: Activity[] }>;
        existing.generatedAt = now;
        existing.lastVerifiedAt = now;
        existing.metadata = {
          ...existing.metadata,
          lastUpdatedBy: 'ai-auto-save',
          model: 'gpt-4o-mini',
        };
        await this.templateRepo.save(existing);
        this.logger.debug(`Updated template: ${existing.id}`);
      } else {
        // Create new template
        const template = this.templateRepo.create({
          destination: params.destination,
          destinationNormalized: normalized,
          country: params.country,
          city: params.city,
          durationDays: params.durationDays,
          travelStyle: style,
          budgetLevel: budget,
          language: lang,
          days: days as Array<{ dayNumber: number; activities: Activity[] }>,
          generatedAt: now,
          lastVerifiedAt: now,
          popularity: 1,
          metadata: {
            source: 'ai-auto-save',
            model: 'gpt-4o-mini',
          },
        });
        await this.templateRepo.save(template);
        this.logger.log(
          `New template saved: "${params.destination}" ${params.durationDays}d [${style}/${budget}/${lang}]`,
        );
      }
    } catch (error) {
      // Non-critical: log but don't fail the user request
      this.logger.warn(
        `Failed to save template: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Mark a template as freshly verified (after AI re-generation confirms it).
   */
  async markVerified(templateId: string): Promise<void> {
    await this.templateRepo.update(templateId, {
      lastVerifiedAt: new Date(),
    });
  }

  /**
   * Get stale templates that need refreshing.
   */
  async getStaleTemplates(limit = 10): Promise<ItineraryTemplate[]> {
    const threshold = new Date(Date.now() - this.STALE_THRESHOLD_MS);
    return this.templateRepo.find({
      where: {
        lastVerifiedAt: LessThan(threshold),
      },
      order: { popularity: 'DESC' }, // Refresh popular ones first
      take: limit,
    });
  }

  /**
   * Get template stats for monitoring.
   */
  async getStats(): Promise<{
    totalTemplates: number;
    staleCount: number;
    topDestinations: Array<{ destination: string; count: number }>;
  }> {
    const totalTemplates = await this.templateRepo.count();
    const threshold = new Date(Date.now() - this.STALE_THRESHOLD_MS);
    const staleCount = await this.templateRepo.count({
      where: { lastVerifiedAt: LessThan(threshold) },
    });

    const topDestinations = await this.templateRepo
      .createQueryBuilder('t')
      .select('t.destination', 'destination')
      .addSelect('SUM(t.popularity)', 'count')
      .groupBy('t.destination')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return { totalTemplates, staleCount, topDestinations };
  }

  /**
   * Cron: Every day at 3 AM, refresh the top 5 most popular stale templates.
   * The actual AI regeneration is handled by AIService (avoids circular dep).
   * This method just identifies and flags templates for refresh.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleStaleRefresh(): Promise<void> {
    const staleTemplates = await this.getStaleTemplates(5);
    if (staleTemplates.length === 0) {
      return;
    }
    this.logger.log(
      `Found ${staleTemplates.length} stale templates for refresh`,
    );
    // Actual refresh is triggered via AIService.refreshStaleTemplates()
    // which is called from trip-status.scheduler or a dedicated refresh scheduler
  }
}
