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
  private readonly STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  /** Minimum cosine similarity to consider a vector match valid */
  private readonly VECTOR_SIMILARITY_THRESHOLD = 0.82;

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
  async findTemplate(params: TemplateLookupParams): Promise<TemplateResult | null> {
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

      const queryEmbedding = await this.embeddingService.generateEmbedding(text);
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
      const template = await this.templateRepo.findOne({ where: { id: row.id } });
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
    // Bump popularity counter (fire-and-forget)
    this.templateRepo
      .increment({ id: template.id }, 'popularity', 1)
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
            model: 'gpt-4o-mini',
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
    const templatesWithoutEmbedding: ItineraryTemplate[] = await this.templateRepo.query(
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

    const embeddings = await this.embeddingService.generateEmbeddingsBatch(texts);

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
