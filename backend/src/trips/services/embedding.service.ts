import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import OpenAI from 'openai';
import { getErrorMessage } from '../../common/types/request.types';

/** Dimension of text-embedding-3-small vectors */
export const EMBEDDING_DIMENSIONS = 1536;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai?: OpenAI;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey !== '' && !apiKey.includes('your-')) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Build a descriptive text string from trip context for embedding.
   * Designed to capture semantic meaning for similarity matching.
   */
  buildEmbeddingText(params: {
    destination: string;
    country?: string;
    durationDays: number;
    travelStyle?: string;
    budgetLevel?: string;
    language?: string;
  }): string {
    const parts = [
      `Travel to ${params.destination}`,
      params.country ? `in ${params.country}` : '',
      `for ${params.durationDays} days`,
      params.travelStyle && params.travelStyle !== 'default'
        ? `${params.travelStyle} style`
        : '',
      params.budgetLevel && params.budgetLevel !== 'default'
        ? `${params.budgetLevel} budget`
        : '',
      params.language ? `language: ${params.language}` : '',
    ];
    return parts.filter(Boolean).join(', ');
  }

  /**
   * Generate an embedding vector for the given text.
   * Returns null if OpenAI is not configured or API call fails.
   * Results are cached for 7 days.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, skipping embedding generation');
      return null;
    }

    // Check cache
    const cacheKey = `emb:${this.hashText(text)}`;
    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache for 7 days
      await this.cacheManager.set(cacheKey, embedding, 7 * 24 * 60 * 60 * 1000);
      return embedding;
    } catch (error) {
      this.logger.error(
        `Embedding generation failed: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in a single API call (batch).
   * More efficient than individual calls.
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.openai || texts.length === 0) {
      return texts.map(() => null);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      const results: (number[] | null)[] = texts.map(() => null);
      for (const item of response.data) {
        results[item.index] = item.embedding;
        // Cache each result
        const cacheKey = `emb:${this.hashText(texts[item.index])}`;
        this.cacheManager
          .set(cacheKey, item.embedding, 7 * 24 * 60 * 60 * 1000)
          .catch(() => {});
      }
      return results;
    } catch (error) {
      this.logger.error(
        `Batch embedding generation failed: ${getErrorMessage(error)}`,
      );
      return texts.map(() => null);
    }
  }

  /** Simple hash for cache key */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}
