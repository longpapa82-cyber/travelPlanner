import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EmbeddingService } from './embedding.service';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn(),
    },
  }));
});

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let embeddingsCreate: jest.Mock;

  beforeEach(async () => {
    cacheManager = { get: jest.fn(), set: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('sk-test-key') },
        },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    embeddingsCreate = (service as any).openai.embeddings.create;
  });

  describe('buildEmbeddingText', () => {
    it('should build descriptive text from trip params', () => {
      const text = service.buildEmbeddingText({
        destination: 'Tokyo, Japan',
        country: 'Japan',
        durationDays: 3,
        travelStyle: 'cultural',
        budgetLevel: 'moderate',
        language: 'ko',
      });

      expect(text).toContain('Tokyo, Japan');
      expect(text).toContain('3 days');
      expect(text).toContain('cultural style');
      expect(text).toContain('moderate budget');
    });

    it('should skip default values', () => {
      const text = service.buildEmbeddingText({
        destination: 'Paris',
        durationDays: 5,
        travelStyle: 'default',
        budgetLevel: 'default',
      });

      expect(text).not.toContain('default');
      expect(text).toContain('Paris');
      expect(text).toContain('5 days');
    });
  });

  describe('generateEmbedding', () => {
    const mockEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);

    it('should return cached embedding if available', async () => {
      cacheManager.get.mockResolvedValue(mockEmbedding);

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(embeddingsCreate).not.toHaveBeenCalled();
    });

    it('should call OpenAI API and cache result', async () => {
      cacheManager.get.mockResolvedValue(null);
      embeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(embeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
      });
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      cacheManager.get.mockResolvedValue(null);
      embeddingsCreate.mockRejectedValue(new Error('API down'));

      const result = await service.generateEmbedding('test text');

      expect(result).toBeNull();
    });

    it('should return null when OpenAI is not configured', async () => {
      const module = await Test.createTestingModule({
        providers: [
          EmbeddingService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();

      const noKeyService = module.get<EmbeddingService>(EmbeddingService);
      const result = await noKeyService.generateEmbedding('test');

      expect(result).toBeNull();
    });
  });

  describe('generateEmbeddingsBatch', () => {
    it('should process multiple texts in a single API call', async () => {
      const emb1 = Array.from({ length: 1536 }, () => 0.1);
      const emb2 = Array.from({ length: 1536 }, () => 0.2);

      cacheManager.get.mockResolvedValue(null);
      embeddingsCreate.mockResolvedValue({
        data: [
          { embedding: emb1, index: 0 },
          { embedding: emb2, index: 1 },
        ],
      });

      const results = await service.generateEmbeddingsBatch(['text1', 'text2']);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(emb1);
      expect(results[1]).toEqual(emb2);
      expect(embeddingsCreate).toHaveBeenCalledTimes(1);
    });

    it('should return nulls for empty input', async () => {
      const results = await service.generateEmbeddingsBatch([]);
      expect(results).toEqual([]);
    });

    it('should return nulls on API error', async () => {
      embeddingsCreate.mockRejectedValue(new Error('Rate limit'));

      const results = await service.generateEmbeddingsBatch(['a', 'b']);

      expect(results).toEqual([null, null]);
    });
  });
});
