import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ItineraryTemplate } from '../entities/itinerary-template.entity';
import { Activity } from '../entities/itinerary.entity';
import { ActivityDto } from '../dto/update-itinerary.dto';
import { EmbeddingService } from './embedding.service';

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
  matchType: 'exact' | 'relaxed' | 'duration-flex' | 'vector';
  similarity?: number;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  /** Templates older than this are considered stale */
  private readonly STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
  /** Minimum cosine similarity to consider a vector match valid (lowered from 0.82 → 0.75 → 0.70 to broaden cache hits) */
  private readonly VECTOR_SIMILARITY_THRESHOLD = 0.70;

  constructor(
    @InjectRepository(ItineraryTemplate)
    private readonly templateRepo: Repository<ItineraryTemplate>,
    private readonly embeddingService: EmbeddingService,
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
  async findTemplate(
    params: TemplateLookupParams,
  ): Promise<TemplateResult | null> {
    const normalized = this.normalize(params.destination);
    const style = params.travelStyle || 'default';
    const budget = params.budgetLevel || 'default';
    const lang = params.language || 'ko';

    // 1. Exact match: destination + duration + style + budget + language
    let matchType: 'exact' | 'relaxed' | 'duration-flex' | 'vector' = 'exact';
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
      matchType = 'relaxed';
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
      matchType = 'duration-flex';
      template = await this.templateRepo
        .createQueryBuilder('t')
        .where('t.destinationNormalized = :normalized', { normalized })
        .andWhere('t.language = :lang', { lang })
        .orderBy(`ABS(t.durationDays - :duration)`, 'ASC')
        .setParameter('duration', params.durationDays)
        .addOrderBy('t.popularity', 'DESC')
        .getOne();
    }

    if (template) {
      return this.buildResult(template, matchType, params);
    }

    // 4. Vector similarity search: semantic matching via embeddings
    const vectorResult = await this.findByVectorSimilarity(params);
    if (vectorResult) {
      return vectorResult;
    }

    return null;
  }

  /**
   * Find a template using vector cosine similarity search.
   * Falls back to null if pgvector is not available or no match above threshold.
   */
  private async findByVectorSimilarity(
    params: TemplateLookupParams,
  ): Promise<TemplateResult | null> {
    try {
      const text = this.embeddingService.buildEmbeddingText({
        destination: params.destination,
        durationDays: params.durationDays,
        travelStyle: params.travelStyle,
        budgetLevel: params.budgetLevel,
        language: params.language,
      });

      const queryEmbedding =
        await this.embeddingService.generateEmbedding(text);
      if (!queryEmbedding) {
        return null;
      }

      // Raw SQL for pgvector cosine similarity
      // 1 - cosine_distance = cosine_similarity (higher = more similar)
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      const results = await this.templateRepo.query(
        `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
         FROM itinerary_templates
         WHERE embedding IS NOT NULL
           AND language = $2
         ORDER BY embedding <=> $1::vector ASC
         LIMIT 1`,
        [vectorStr, params.language || 'ko'],
      );

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      const similarity = parseFloat(row.similarity);

      if (similarity < this.VECTOR_SIMILARITY_THRESHOLD) {
        this.logger.debug(
          `Vector match below threshold: ${similarity.toFixed(3)} < ${this.VECTOR_SIMILARITY_THRESHOLD}`,
        );
        return null;
      }

      // Load the full entity
      const template = await this.templateRepo.findOne({
        where: { id: row.id },
      });
      if (!template) return null;

      this.logger.log(
        `Vector match: "${params.destination}" → "${template.destination}" (similarity: ${similarity.toFixed(3)})`,
      );

      return this.buildResult(template, 'vector', params, similarity);
    } catch (error) {
      // pgvector not installed or query failed — silently fall through
      this.logger.debug(
        `Vector search unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Build a TemplateResult from a template entity.
   */
  private buildResult(
    template: ItineraryTemplate,
    matchType: 'exact' | 'relaxed' | 'duration-flex' | 'vector',
    params: TemplateLookupParams,
    similarity?: number,
  ): TemplateResult {
    // Bump popularity + served counters (fire-and-forget)
    this.templateRepo
      .increment({ id: template.id }, 'popularity', 1)
      .catch(() => {});
    this.templateRepo
      .increment({ id: template.id }, 'servedCount', 1)
      .catch(() => {});

    const isStale =
      Date.now() - new Date(template.lastVerifiedAt).getTime() >
      this.STALE_THRESHOLD_MS;

    const style = params.travelStyle || 'default';
    const budget = params.budgetLevel || 'default';
    const lang = params.language || 'ko';

    this.logger.log(
      `Template hit [${matchType}]: "${params.destination}" ${params.durationDays}d [${style}/${budget}/${lang}] → ${template.id} (stale: ${isStale})`,
    );

    return {
      days: template.days,
      templateId: template.id,
      generatedAt: template.generatedAt,
      isStale,
      matchType,
      similarity,
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
    const totalActivities = days.reduce(
      (sum, d) => sum + d.activities.length,
      0,
    );
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
        existing.days = days as Array<{
          dayNumber: number;
          activities: Activity[];
        }>;
        existing.generatedAt = now;
        existing.lastVerifiedAt = now;
        existing.metadata = {
          ...existing.metadata,
          lastUpdatedBy: 'ai-auto-save',
          model: 'ai-generated',
        };
        await this.templateRepo.save(existing);
        // Update embedding (fire-and-forget)
        this.updateEmbedding(existing.id, params).catch(() => {});
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
            model: 'ai-generated',
          },
        });
        const saved = await this.templateRepo.save(template);
        // Generate embedding for the new template (fire-and-forget)
        this.updateEmbedding(saved.id, params).catch(() => {});
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
   * Record that a user significantly modified a template-based itinerary.
   * This degrades the template's quality score, prioritizing it for refresh.
   *
   * "Significant modification" = user changed ≥50% of activities in any day.
   */
  async recordUserModification(templateId: string): Promise<void> {
    try {
      await this.templateRepo.increment(
        { id: templateId },
        'userModifiedCount',
        1,
      );
      // Recompute quality score
      const template = await this.templateRepo.findOne({
        where: { id: templateId },
      });
      if (template && template.servedCount > 0) {
        const score = Math.max(
          0,
          1 - template.userModifiedCount / template.servedCount,
        );
        await this.templateRepo.update(templateId, {
          qualityScore: Math.round(score * 100) / 100,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to record modification for template ${templateId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Calculate the modification ratio between original template and user's version.
   * Returns 0.0 (identical) to 1.0 (completely different).
   */
  calculateModificationRatio(
    originalActivities: Activity[],
    userActivities: Activity[],
  ): number {
    if (originalActivities.length === 0 && userActivities.length === 0)
      return 0;
    if (originalActivities.length === 0 || userActivities.length === 0)
      return 1;

    // Count how many original titles survive in the user version
    const originalTitles = new Set(originalActivities.map((a) => a.title));
    const surviving = userActivities.filter((a) =>
      originalTitles.has(a.title),
    ).length;
    const maxLen = Math.max(originalActivities.length, userActivities.length);

    return 1 - surviving / maxLen;
  }

  /**
   * Validate template data quality. Returns issues found.
   */
  validateTemplate(template: ItineraryTemplate): string[] {
    const issues: string[] = [];

    if (!template.days || template.days.length === 0) {
      issues.push('No days in template');
      return issues;
    }

    for (const day of template.days) {
      if (!day.activities || day.activities.length === 0) {
        issues.push(`Day ${day.dayNumber}: no activities`);
        continue;
      }

      for (const activity of day.activities) {
        if (!activity.title) {
          issues.push(`Day ${day.dayNumber}: activity missing title`);
        }
        if (!activity.location) {
          issues.push(
            `Day ${day.dayNumber}: "${activity.title}" missing location`,
          );
        }
        if (!activity.time || !/^\d{2}:\d{2}$/.test(activity.time)) {
          issues.push(
            `Day ${day.dayNumber}: "${activity.title}" invalid time format`,
          );
        }
        if (
          activity.estimatedDuration !== undefined &&
          (activity.estimatedDuration <= 0 || activity.estimatedDuration > 720)
        ) {
          issues.push(
            `Day ${day.dayNumber}: "${activity.title}" unreasonable duration`,
          );
        }
        if (
          activity.estimatedCost !== undefined &&
          activity.estimatedCost < 0
        ) {
          issues.push(
            `Day ${day.dayNumber}: "${activity.title}" negative cost`,
          );
        }
      }
    }

    return issues;
  }

  /**
   * Get detailed health dashboard data.
   */
  async getHealthDashboard(): Promise<{
    totalTemplates: number;
    staleCount: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
    averageQuality: number | null;
    lowQualityCount: number;
    matchTypeDistribution: Record<string, number>;
    topDestinations: Array<{
      destination: string;
      count: number;
      avgQuality: number;
    }>;
    refreshQueue: Array<{
      id: string;
      destination: string;
      durationDays: number;
      qualityScore: number | null;
      popularity: number;
      refreshPriority: number;
    }>;
  }> {
    const totalTemplates = await this.templateRepo.count();
    const threshold = new Date(Date.now() - this.STALE_THRESHOLD_MS);
    const staleCount = await this.templateRepo.count({
      where: { lastVerifiedAt: LessThan(threshold) },
    });

    // Embedding coverage
    const [embeddingStats] = await this.templateRepo.query(
      `SELECT
         COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS "withEmbeddings",
         COUNT(*) FILTER (WHERE embedding IS NULL) AS "withoutEmbeddings"
       FROM itinerary_templates`,
    );

    // Quality distribution
    const [qualityStats] = await this.templateRepo.query(
      `SELECT
         AVG("qualityScore") AS "averageQuality",
         COUNT(*) FILTER (WHERE "qualityScore" IS NOT NULL AND "qualityScore" < 0.5) AS "lowQualityCount"
       FROM itinerary_templates`,
    );

    // Top destinations with quality
    const topDestinations = await this.templateRepo.query(
      `SELECT
         destination,
         SUM(popularity)::int AS count,
         ROUND(AVG("qualityScore")::numeric, 2) AS "avgQuality"
       FROM itinerary_templates
       GROUP BY destination
       ORDER BY count DESC
       LIMIT 10`,
    );

    // Smart refresh queue: priority = popularity × staleness_days × (2 - qualityScore)
    const refreshQueue = await this.templateRepo.query(
      `SELECT
         id, destination, "durationDays", "qualityScore", popularity,
         ROUND((
           GREATEST(popularity, 1) *
           EXTRACT(EPOCH FROM (NOW() - "lastVerifiedAt")) / 86400.0 *
           (2 - COALESCE("qualityScore", 0.5))
         )::numeric, 1) AS "refreshPriority"
       FROM itinerary_templates
       WHERE "lastVerifiedAt" < $1
       ORDER BY "refreshPriority" DESC
       LIMIT 10`,
      [threshold],
    );

    return {
      totalTemplates,
      staleCount,
      withEmbeddings: parseInt(embeddingStats?.withEmbeddings || '0', 10),
      withoutEmbeddings: parseInt(embeddingStats?.withoutEmbeddings || '0', 10),
      averageQuality: qualityStats?.averageQuality
        ? parseFloat(qualityStats.averageQuality)
        : null,
      lowQualityCount: parseInt(qualityStats?.lowQualityCount || '0', 10),
      matchTypeDistribution: {}, // Populated at runtime by tracking hits
      topDestinations,
      refreshQueue,
    };
  }

  /**
   * Get templates ordered by smart refresh priority.
   * Priority = popularity × staleness_days × (2 - qualityScore)
   */
  async getSmartRefreshQueue(limit = 10): Promise<ItineraryTemplate[]> {
    const threshold = new Date(Date.now() - this.STALE_THRESHOLD_MS);
    return this.templateRepo.query(
      `SELECT *
       FROM itinerary_templates
       WHERE "lastVerifiedAt" < $1
       ORDER BY
         GREATEST(popularity, 1) *
         EXTRACT(EPOCH FROM (NOW() - "lastVerifiedAt")) / 86400.0 *
         (2 - COALESCE("qualityScore", 0.5))
       DESC
       LIMIT $2`,
      [threshold, limit],
    );
  }

  /**
   * Count templates matching specific destination/duration/language filter sets.
   * Used by warmup service to measure cache coverage per tier.
   */
  async countByFilters(
    normalizedDestinations: string[],
    durations: number[],
    languages: string[],
  ): Promise<number> {
    if (
      normalizedDestinations.length === 0 ||
      durations.length === 0 ||
      languages.length === 0
    ) {
      return 0;
    }

    const result = await this.templateRepo.query(
      `SELECT COUNT(*)::int AS count
       FROM itinerary_templates
       WHERE "destinationNormalized" = ANY($1)
         AND "durationDays" = ANY($2)
         AND language = ANY($3)`,
      [normalizedDestinations, durations, languages],
    );
    return result[0]?.count ?? 0;
  }

  /**
   * Generate and store embedding for a specific template.
   * Uses raw SQL since TypeORM doesn't natively support vector type.
   */
  async updateEmbedding(
    templateId: string,
    params: {
      destination: string;
      country?: string;
      durationDays: number;
      travelStyle?: string;
      budgetLevel?: string;
      language?: string;
    },
  ): Promise<void> {
    const text = this.embeddingService.buildEmbeddingText(params);
    const embedding = await this.embeddingService.generateEmbedding(text);
    if (!embedding) return;

    const vectorStr = `[${embedding.join(',')}]`;
    await this.templateRepo.query(
      `UPDATE itinerary_templates SET embedding = $1::vector WHERE id = $2`,
      [vectorStr, templateId],
    );
  }

  /**
   * Backfill embeddings for all templates that don't have one yet.
   * Processes in batches to avoid overwhelming the API.
   */
  async backfillEmbeddings(batchSize = 20): Promise<number> {
    const templatesWithoutEmbedding: ItineraryTemplate[] =
      await this.templateRepo.query(
        `SELECT id, destination, country, "durationDays", "travelStyle", "budgetLevel", language
       FROM itinerary_templates WHERE embedding IS NULL
       ORDER BY popularity DESC
       LIMIT $1`,
        [batchSize],
      );

    if (templatesWithoutEmbedding.length === 0) {
      return 0;
    }

    const texts = templatesWithoutEmbedding.map((t) =>
      this.embeddingService.buildEmbeddingText({
        destination: t.destination,
        country: t.country,
        durationDays: t.durationDays,
        travelStyle: t.travelStyle,
        budgetLevel: t.budgetLevel,
        language: t.language,
      }),
    );

    const embeddings =
      await this.embeddingService.generateEmbeddingsBatch(texts);

    let updated = 0;
    for (let i = 0; i < templatesWithoutEmbedding.length; i++) {
      if (embeddings[i]) {
        const vectorStr = `[${embeddings[i]!.join(',')}]`;
        await this.templateRepo.query(
          `UPDATE itinerary_templates SET embedding = $1::vector WHERE id = $2`,
          [vectorStr, templatesWithoutEmbedding[i].id],
        );
        updated++;
      }
    }

    this.logger.log(`Backfilled ${updated} template embeddings`);
    return updated;
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
  }

  /**
   * Get the top N popular destinations from real trip data.
   * Used by the warmup cron to pre-generate templates for popular routes.
   */
  async getPopularDestinations(limit = 20): Promise<
    Array<{
      destination: string;
      country?: string;
      city?: string;
      tripCount: number;
    }>
  > {
    try {
      const results = await this.templateRepo.query(
        `SELECT destination, country, city, COUNT(*)::int AS "tripCount"
         FROM trips
         GROUP BY destination, country, city
         ORDER BY "tripCount" DESC
         LIMIT $1`,
        [limit],
      );
      return results;
    } catch (error) {
      this.logger.warn(
        `Failed to query popular destinations: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Get destinations that need template pre-generation.
   * Returns popular destinations missing templates for standard durations (3/5/7 days).
   */
  async getWarmupQueue(
    topN = 20,
    durations = [3, 5, 7],
    languages = ['ko', 'en'],
  ): Promise<
    Array<{
      destination: string;
      country?: string;
      city?: string;
      durationDays: number;
      language: string;
    }>
  > {
    const popular = await this.getPopularDestinations(topN);
    const queue: Array<{
      destination: string;
      country?: string;
      city?: string;
      durationDays: number;
      language: string;
    }> = [];

    for (const dest of popular) {
      const normalized = this.normalize(dest.destination);
      for (const duration of durations) {
        for (const lang of languages) {
          // Check if template already exists and is fresh
          const existing = await this.templateRepo.findOne({
            where: {
              destinationNormalized: normalized,
              durationDays: duration,
              language: lang,
            },
          });

          if (
            !existing ||
            Date.now() - new Date(existing.lastVerifiedAt).getTime() >
              this.STALE_THRESHOLD_MS
          ) {
            queue.push({
              destination: dest.destination,
              country: dest.country,
              city: dest.city,
              durationDays: duration,
              language: lang,
            });
          }
        }
      }
    }

    this.logger.log(
      `Warmup queue: ${queue.length} templates needed for top ${popular.length} destinations`,
    );
    return queue;
  }

  /**
   * Cron: Every day at 4 AM, backfill embeddings for templates missing them.
   */
  @Cron('0 4 * * *')
  async handleEmbeddingBackfill(): Promise<void> {
    try {
      const count = await this.backfillEmbeddings(50);
      if (count > 0) {
        this.logger.log(`Embedding backfill completed: ${count} templates`);
      }
    } catch (error) {
      this.logger.warn(
        `Embedding backfill failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
