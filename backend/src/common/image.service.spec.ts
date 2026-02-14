import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { ImageService } from './image.service';

describe('ImageService', () => {
  let service: ImageService;
  const testDir = join(process.cwd(), 'test-uploads');
  const photosDir = join(testDir, 'uploads', 'photos');

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageService],
    }).compile();

    service = module.get<ImageService>(ImageService);

    // Create test directories
    mkdirSync(photosDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /** Helper: create a real PNG test image via sharp */
  async function createTestImage(
    filename: string,
    width = 100,
    height = 100,
  ): Promise<string> {
    const filePath = join(photosDir, filename);
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toFile(filePath);
    return filePath;
  }

  describe('validateImage', () => {
    it('should accept a valid PNG image', async () => {
      const filePath = await createTestImage('valid.png');
      await expect(service.validateImage(filePath)).resolves.toBeUndefined();
      unlinkSync(filePath);
    });

    it('should reject a non-image file', async () => {
      const filePath = join(photosDir, 'fake.txt');
      writeFileSync(filePath, 'this is not an image');
      await expect(service.validateImage(filePath)).rejects.toThrow(
        BadRequestException,
      );
      if (existsSync(filePath)) unlinkSync(filePath);
    });

    it('should reject a file that does not exist', async () => {
      await expect(
        service.validateImage('/nonexistent/file.png'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('processUpload', () => {
    it('should convert a PNG to WebP and return URL', async () => {
      const filePath = await createTestImage('process-test.png', 200, 200);
      const result = await service.processUpload(filePath, {
        maxWidth: 150,
        quality: 70,
      });

      expect(result.url).toContain('.webp');
      expect(result.url).toContain('/uploads/');
      expect(result.thumbnailUrl).toBeUndefined();

      // Original PNG should be removed
      expect(existsSync(filePath)).toBe(false);
    });

    it('should generate a thumbnail when requested', async () => {
      const filePath = await createTestImage('thumb-test.png', 300, 300);
      const result = await service.processUpload(filePath, {
        generateThumbnail: true,
        thumbnailSize: 100,
      });

      expect(result.url).toContain('.webp');
      expect(result.thumbnailUrl).toContain('/thumbs/');
      expect(result.thumbnailUrl).toContain('.webp');
    });

    it('should throw and clean up on invalid file', async () => {
      const filePath = join(photosDir, 'bad-upload.jpg');
      writeFileSync(filePath, 'not-a-real-image');

      await expect(service.processUpload(filePath)).rejects.toThrow(
        BadRequestException,
      );

      // Both input and would-be output should be cleaned up
      expect(existsSync(filePath)).toBe(false);
    });

    it('should use default options when none provided', async () => {
      const filePath = await createTestImage('defaults-test.png', 50, 50);
      const result = await service.processUpload(filePath);

      expect(result.url).toContain('.webp');
      // Small image should not be enlarged (withoutEnlargement: true)
      const outputPath = join(photosDir, 'defaults-test.webp');
      if (existsSync(outputPath)) {
        const meta = await sharp(outputPath).metadata();
        expect(meta.width).toBeLessThanOrEqual(50);
      }
    });
  });
});
