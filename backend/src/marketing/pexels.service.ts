import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../common/types/request.types';
import { MarketingImage } from './image.types';

/**
 * Pexels stock-image integration for the daily marketing run.
 *
 * DESIGN DECISION (locked): Pexels (not Unsplash) because Pexels permits
 * download / re-hosting / commercial use with no hotlink requirement, which fits
 * the "download → attach to email → operator re-posts to Naver" workflow.
 *
 * FAIL-OPEN CONTRACT (critical): images are an enhancement, never a dependency.
 * `fetchImages` is written so EVERY path returns an array and it can NEVER throw:
 *   - no API key / count<=0 / no global fetch  → [] (warn)
 *   - non-2xx / 401 / 429 / timeout / abort     → [] (warn)
 *   - zero results / malformed JSON             → []
 * When `{ withBuffers: true }`, each chosen image is downloaded to a Buffer with
 * its own per-image try/catch — a failed download drops only that image, the
 * rest still proceed (a partial set is fine). The scheduler therefore does NOT
 * need to wrap these calls in try/catch for control flow.
 *
 * No API key is ever logged. Uses Node 20 global fetch + AbortController (no new
 * dependency).
 */

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const SEARCH_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 10000;
const PLACEHOLDER_KEY_HINT = 'your-';

interface FetchOptions {
  readonly withBuffers?: boolean;
}

/** Subset of the Pexels photo `src` object we care about (largest → smallest). */
interface PexelsSrc {
  large?: string;
  medium?: string;
  landscape?: string;
  original?: string;
}

interface PexelsPhoto {
  src: PexelsSrc;
  photographer: string;
  photographer_url: string;
  alt: string;
  width: number;
  height: number;
}

@Injectable()
export class PexelsService {
  private readonly logger = new Logger(PexelsService.name);
  private warnedMissingKey = false;

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    return this.configService.get<string>('marketing.pexelsApiKey') ?? '';
  }

  /**
   * Search Pexels for up to `count` landscape photos matching `query`.
   *
   * NEVER throws — returns [] on any failure (fail-open). When opts.withBuffers
   * is set, each returned image also carries its downloaded `buffer` for use as
   * an email attachment; images whose download fails are dropped.
   */
  async fetchImages(
    query: string,
    count: number,
    opts: FetchOptions = {},
  ): Promise<MarketingImage[]> {
    if (count <= 0) {
      return [];
    }
    const key = this.apiKey;
    if (!key || key.includes(PLACEHOLDER_KEY_HINT)) {
      if (!this.warnedMissingKey) {
        this.logger.warn(
          'PEXELS_API_KEY not configured — marketing runs text-only',
        );
        this.warnedMissingKey = true;
      }
      return [];
    }
    if (typeof fetch !== 'function') {
      this.logger.warn(
        'global fetch unavailable (Node < 18) — marketing runs text-only',
      );
      return [];
    }

    const normalizedQuery = query.trim() || 'travel';
    const images = await this.searchImages(normalizedQuery, count, key);
    if (images.length === 0) {
      return [];
    }
    if (!opts.withBuffers) {
      return images;
    }
    return this.attachBuffers(images);
  }

  /** Perform the search request + parse. Returns [] on any failure. */
  private async searchImages(
    query: string,
    count: number,
    key: string,
  ): Promise<MarketingImage[]> {
    const url =
      `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}` +
      `&per_page=${count}&orientation=landscape`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Authorization: key },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Pexels search failed: HTTP ${res.status}`);
        return [];
      }
      const json: unknown = await res.json();
      return this.mapPhotos(json, count, query);
    } catch (error) {
      this.logger.warn(`Pexels search error: ${getErrorMessage(error)}`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /** Narrow the unknown response and map up to `count` valid photos. */
  private mapPhotos(
    json: unknown,
    count: number,
    query: string,
  ): MarketingImage[] {
    if (typeof json !== 'object' || json === null) {
      return [];
    }
    const photosRaw = (json as { photos?: unknown }).photos;
    if (!Array.isArray(photosRaw)) {
      return [];
    }
    const images: MarketingImage[] = [];
    for (const candidate of photosRaw) {
      if (images.length >= count) break;
      const photo = this.toPexelsPhoto(candidate);
      if (!photo) continue;
      const srcUrl = this.pickSrc(photo.src);
      if (!srcUrl) continue;
      images.push(this.toMarketingImage(photo, srcUrl, query));
    }
    return images;
  }

  /** Safely narrow one array element to a PexelsPhoto (or null). */
  private toPexelsPhoto(value: unknown): PexelsPhoto | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const obj = value as Record<string, unknown>;
    const src = obj.src;
    if (typeof src !== 'object' || src === null) {
      return null;
    }
    return {
      src: src as PexelsSrc,
      photographer:
        typeof obj.photographer === 'string' ? obj.photographer : '',
      photographer_url:
        typeof obj.photographer_url === 'string' ? obj.photographer_url : '',
      alt: typeof obj.alt === 'string' ? obj.alt : '',
      width: typeof obj.width === 'number' ? obj.width : 0,
      height: typeof obj.height === 'number' ? obj.height : 0,
    };
  }

  /** Choose the best available src URL (large → medium → landscape → original). */
  private pickSrc(src: PexelsSrc): string {
    const candidates = [src.large, src.medium, src.landscape, src.original];
    for (const url of candidates) {
      if (typeof url === 'string' && url.startsWith('http')) {
        return url;
      }
    }
    return '';
  }

  private toMarketingImage(
    photo: PexelsPhoto,
    srcUrl: string,
    query: string,
  ): MarketingImage {
    const photographerUrl = photo.photographer_url.startsWith('http')
      ? photo.photographer_url
      : '';
    const alt = photo.alt.trim() !== '' ? photo.alt : `${query} 여행 사진`;
    return {
      srcUrl,
      photographer:
        photo.photographer.trim() !== '' ? photo.photographer : 'Pexels',
      photographerUrl,
      alt,
      width: photo.width,
      height: photo.height,
      ext: this.extFromUrl(srcUrl),
    };
  }

  /**
   * Download each image's bytes to a Buffer. Per-image try/catch so one failure
   * drops only that image. Returns the successfully-downloaded subset (may be []).
   */
  private async attachBuffers(
    images: readonly MarketingImage[],
  ): Promise<MarketingImage[]> {
    const result: MarketingImage[] = [];
    for (const image of images) {
      const downloaded = await this.downloadOne(image);
      if (downloaded) {
        result.push(downloaded);
      }
    }
    return result;
  }

  /** Download one image; returns a new immutable copy with buffer/ext, or null. */
  private async downloadOne(
    image: MarketingImage,
  ): Promise<MarketingImage | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(image.srcUrl, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`Pexels image download failed: HTTP ${res.status}`);
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length === 0) {
        return null;
      }
      const contentType = res.headers.get('content-type') ?? '';
      const ext = this.extFromContentType(contentType) || image.ext;
      return { ...image, buffer, ext };
    } catch (error) {
      this.logger.warn(
        `Pexels image download error: ${getErrorMessage(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private extFromContentType(contentType: string): string {
    const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
    switch (type) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      default:
        return '';
    }
  }

  private extFromUrl(url: string): string {
    const match = /\.(jpe?g|png|webp|gif)(?:\?|$)/i.exec(url);
    if (!match) {
      return 'jpg';
    }
    const raw = match[1].toLowerCase();
    return raw === 'jpeg' ? 'jpg' : raw;
  }
}
