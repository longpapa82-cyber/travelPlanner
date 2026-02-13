import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { join, parse } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

interface ProcessedImage {
  /** Relative URL path (e.g. /uploads/photos/abc-optimized.webp) */
  url: string;
  /** Thumbnail URL if generated */
  thumbnailUrl?: string;
}

interface ProcessOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

const DEFAULTS: Required<ProcessOptions> = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 80,
  generateThumbnail: false,
  thumbnailSize: 200,
};

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * Process an uploaded image: resize, convert to WebP, optionally generate thumbnail.
   * Removes the original file after processing.
   */
  async processUpload(
    filePath: string,
    opts: ProcessOptions = {},
  ): Promise<ProcessedImage> {
    const options = { ...DEFAULTS, ...opts };
    const { dir, name } = parse(filePath);
    const outputName = `${name}.webp`;
    const outputPath = join(dir, outputName);

    try {
      await sharp(filePath)
        .resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: options.quality })
        .toFile(outputPath);

      // Remove original file if different from output
      if (filePath !== outputPath && existsSync(filePath)) {
        unlinkSync(filePath);
      }

      const result: ProcessedImage = {
        url: this.toUrlPath(outputPath),
      };

      if (options.generateThumbnail) {
        const thumbDir = join(dir, 'thumbs');
        if (!existsSync(thumbDir)) mkdirSync(thumbDir, { recursive: true });

        const thumbPath = join(thumbDir, outputName);
        await sharp(outputPath)
          .resize(options.thumbnailSize, options.thumbnailSize, {
            fit: 'cover',
          })
          .webp({ quality: 70 })
          .toFile(thumbPath);

        result.thumbnailUrl = this.toUrlPath(thumbPath);
      }

      this.logger.log(`Processed: ${outputName}`);
      return result;
    } catch (error) {
      this.logger.error(`Image processing failed: ${error}`);
      // Fallback: return original file URL
      return { url: this.toUrlPath(filePath) };
    }
  }

  /** Convert absolute file path to relative URL */
  private toUrlPath(absolutePath: string): string {
    const uploadsIdx = absolutePath.indexOf('/uploads/');
    return uploadsIdx >= 0 ? absolutePath.slice(uploadsIdx) : absolutePath;
  }
}
