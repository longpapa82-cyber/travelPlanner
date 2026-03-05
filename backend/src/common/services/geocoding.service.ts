import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import axios, { AxiosError } from 'axios';
import { createHash } from 'crypto';
import { GeocodingCache } from '../entities/geocoding-cache.entity';
import { withTimeout } from '../utils/resilience';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  source: string;
  confidence: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private static readonly REDIS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
  private static readonly LOCATIONIQ_RATE_MS = 500; // 2 req/sec
  private static readonly MAX_BATCH_SIZE = 30;
  private static readonly MAX_QUERY_LENGTH = 500;
  private lastLocationIQCall = 0;
  private readonly locationIQKey: string | null;
  private readonly googleMapsKey: string | null;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(GeocodingCache)
    private geocodingCacheRepo: Repository<GeocodingCache>,
  ) {
    this.locationIQKey = this.configService.get<string>('LOCATIONIQ_API_KEY') || null;
    this.googleMapsKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY') || null;

    if (this.locationIQKey) {
      this.logger.log('LocationIQ geocoding initialized');
    }
    if (!this.locationIQKey && !this.googleMapsKey) {
      this.logger.warn('No geocoding API keys configured');
    }
  }

  private hashQuery(query: string): string {
    return createHash('sha256').update(query.toLowerCase().trim()).digest('hex').slice(0, 32);
  }

  /**
   * Sanitize query for safe logging (strip newlines, truncate).
   */
  private sanitizeForLog(input: string): string {
    return input.replace(/[\r\n]+/g, ' ').slice(0, 100);
  }

  /**
   * Sanitize axios error to prevent API key leakage in logs.
   */
  private safeErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      return `${error.code || 'UNKNOWN'} ${error.response?.status || ''}`.trim();
    }
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Geocode a single query string.
   * Fallback chain: Redis cache → DB cache → LocationIQ → Google Maps
   */
  async geocode(query: string): Promise<GeocodingResult | null> {
    const q = query.trim();
    if (!q || q.length > GeocodingService.MAX_QUERY_LENGTH) {
      return null;
    }

    const hash = this.hashQuery(q);
    const cacheKey = `geo:${hash}`;

    // 1. Redis cache
    const cached = await this.cacheManager.get<GeocodingResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. DB cache
    try {
      const dbCached = await this.geocodingCacheRepo.findOne({ where: { queryHash: hash } });
      if (dbCached) {
        const result: GeocodingResult = {
          latitude: dbCached.latitude,
          longitude: dbCached.longitude,
          source: dbCached.source,
          confidence: dbCached.confidence,
        };
        // Warm Redis cache from DB
        await this.cacheManager.set(cacheKey, result, GeocodingService.REDIS_TTL);
        // Increment hit count (fire-and-forget)
        this.geocodingCacheRepo
          .increment({ queryHash: hash }, 'hitCount', 1)
          .catch(() => {});
        return result;
      }
    } catch (error) {
      this.logger.warn(`DB cache lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 3. LocationIQ (free tier: 5000/day, 2 req/sec)
    if (this.locationIQKey) {
      const result = await this.geocodeViaLocationIQ(q);
      if (result) {
        await this.persistResult(hash, q, result);
        return result;
      }
    }

    // 4. Google Maps (paid, last resort)
    if (this.googleMapsKey) {
      const result = await this.geocodeViaGoogleMaps(q);
      if (result) {
        await this.persistResult(hash, q, result);
        return result;
      }
    }

    return null;
  }

  /**
   * Geocode multiple queries with controlled concurrency.
   * Capped at MAX_BATCH_SIZE to prevent API quota exhaustion.
   * Uses a semaphore (max 2 concurrent) to overlap network latency
   * while respecting LocationIQ's per-request rate limiter.
   * Cache hits bypass the semaphore entirely (no rate limit needed).
   */
  async geocodeBatch(
    queries: string[],
  ): Promise<(GeocodingResult | null)[]> {
    const capped = queries.slice(0, GeocodingService.MAX_BATCH_SIZE);
    const CONCURRENCY = 2;

    // Partition: check cache first (instant), then batch uncached with concurrency
    const results: (GeocodingResult | null)[] = new Array(capped.length).fill(null);
    const uncachedIndices: number[] = [];

    // Phase 1: resolve cache hits (no rate limit needed)
    for (let i = 0; i < capped.length; i++) {
      const q = capped[i].trim();
      if (!q || q.length > GeocodingService.MAX_QUERY_LENGTH) continue;
      const hash = this.hashQuery(q);
      const cacheKey = `geo:${hash}`;
      const cached = await this.cacheManager.get<GeocodingResult>(cacheKey);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
      }
    }

    if (uncachedIndices.length === 0) return results;

    // Phase 2: process uncached queries with controlled concurrency
    let cursor = 0;
    const processNext = async (): Promise<void> => {
      while (cursor < uncachedIndices.length) {
        const idx = uncachedIndices[cursor++];
        results[idx] = await this.geocode(capped[idx]);
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, uncachedIndices.length) },
      () => processNext(),
    );
    await Promise.allSettled(workers);

    return results;
  }

  private async geocodeViaLocationIQ(query: string): Promise<GeocodingResult | null> {
    // Rate limiting
    const now = Date.now();
    const waitMs = GeocodingService.LOCATIONIQ_RATE_MS - (now - this.lastLocationIQCall);
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    this.lastLocationIQCall = Date.now();

    try {
      const response = await withTimeout(
        axios.get('https://us1.locationiq.com/v1/search', {
          params: {
            key: this.locationIQKey,
            q: query,
            format: 'json',
            limit: 1,
          },
          timeout: 5000,
        }),
        8000,
        'LocationIQ geocode',
      );

      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        return {
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          source: 'locationiq',
          confidence: 0.9,
        };
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `LocationIQ geocoding failed for "${this.sanitizeForLog(query)}": ${this.safeErrorMessage(error)}`,
      );
      return null;
    }
  }

  private async geocodeViaGoogleMaps(query: string): Promise<GeocodingResult | null> {
    try {
      const response = await withTimeout(
        axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: query,
            key: this.googleMapsKey,
          },
          timeout: 5000,
        }),
        8000,
        'Google Maps geocode',
      );

      if (response.data?.results?.length > 0) {
        const loc = response.data.results[0].geometry.location;
        return {
          latitude: loc.lat,
          longitude: loc.lng,
          source: 'google',
          confidence: 1.0,
        };
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Google Maps geocoding failed for "${this.sanitizeForLog(query)}": ${this.safeErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Save result to both Redis and DB.
   */
  private async persistResult(
    hash: string,
    query: string,
    result: GeocodingResult,
  ): Promise<void> {
    const cacheKey = `geo:${hash}`;

    // Redis (fire-and-forget)
    this.cacheManager
      .set(cacheKey, result, GeocodingService.REDIS_TTL)
      .catch(() => {});

    // DB (fire-and-forget, truncate query for storage safety)
    this.geocodingCacheRepo
      .upsert(
        {
          queryHash: hash,
          query: query.slice(0, GeocodingService.MAX_QUERY_LENGTH),
          latitude: result.latitude,
          longitude: result.longitude,
          source: result.source,
          confidence: result.confidence,
          hitCount: 1,
        },
        ['queryHash'],
      )
      .catch((err) => {
        this.logger.warn(`DB cache persist failed: ${err instanceof Error ? err.message : String(err)}`);
      });
  }
}
