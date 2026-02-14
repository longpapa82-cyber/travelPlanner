import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

/** Allowed image formats verified via magic bytes */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp']);

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * Validate that the file is a genuine image by reading its magic bytes
   * via sharp metadata. Throws BadRequestException if invalid.
   */
  async validateImage(filePath: string): Promise<void> {
    try {
      const metadata = await sharp(filePath).metadata();
      if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
        throw new BadRequestException(
          `Unsupported image format: ${metadata.format || 'unknown'}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('File is not a valid image');
    }
  }

  /**
   * Process an uploaded image: validate, resize, convert to WebP, optionally
   * generate thumbnail. Always removes the original file after processing.
   */
  async processUpload(
    filePath: string,
    opts: ProcessOptions = {},
  ): Promise<ProcessedImage> {
    const options = { ...DEFAULTS, ...opts };
    const { dir, name } = parse(filePath);
    const outputName = `${name}.webp`;
    const outputPath = join(dir, outputName);

    // Validate magic bytes before processing
    await this.validateImage(filePath);

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
      // Clean up uploaded file on failure — never serve unprocessed uploads
      this.safeDelete(filePath);
      this.safeDelete(outputPath);
      throw new BadRequestException('Image processing failed');
    }
  }

  /** Convert absolute file path to relative URL */
  private toUrlPath(absolutePath: string): string {
    const uploadsIdx = absolutePath.indexOf('/uploads/');
    return uploadsIdx >= 0 ? absolutePath.slice(uploadsIdx) : absolutePath;
  }

  /** Delete a file without throwing */
  private safeDelete(filePath: string): void {
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // best-effort cleanup
    }
  }
}
