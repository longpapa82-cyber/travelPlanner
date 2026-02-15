import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateService } from './template.service';
import { EmbeddingService } from './embedding.service';
import { ItineraryTemplate } from '../entities/itinerary-template.entity';
import { Activity } from '../entities/itinerary.entity';

describe('TemplateService', () => {
  let service: TemplateService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let embeddingService: { buildEmbeddingText: jest.Mock; generateEmbedding: jest.Mock };

  const mockTemplate = (): Partial<ItineraryTemplate> => ({
    id: 'tmpl-1',
    destination: 'Tokyo, Japan',
    destinationNormalized: 'tokyo',
    country: 'Japan',
    city: 'Tokyo',
    durationDays: 3,
    travelStyle: 'default',
    budgetLevel: 'default',
    language: 'ko',
    days: [
      {
        dayNumber: 1,
        activities: [
          { title: 'Senso-ji Temple', location: 'Asakusa', time: '09:00' } as Activity,
          { title: 'Shibuya Crossing', location: 'Shibuya', time: '14:00' } as Activity,
        ],
      },
    ],
    generatedAt: new Date(),
    lastVerifiedAt: new Date(),
    popularity: 10,
    servedCount: 20,
    userModifiedCount: 5,
    qualityScore: 0.75,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      increment: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    embeddingService = {
      buildEmbeddingText: jest.fn().mockReturnValue('Tokyo, Japan 3 days'),
      generateEmbedding: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        { provide: getRepositoryToken(ItineraryTemplate), useValue: repo },
        { provide: EmbeddingService, useValue: embeddingService },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
  });

  describe('calculateModificationRatio', () => {
    it('should return 0 for identical activity lists', () => {
      const activities = [
        { title: 'Temple Visit', location: 'Asakusa' },
        { title: 'Lunch', location: 'Shinjuku' },
      ] as Activity[];

      expect(service.calculateModificationRatio(activities, activities)).toBe(0);
    });

    it('should return 1 for completely different activities', () => {
      const original = [{ title: 'A', location: 'X' }] as Activity[];
      const user = [{ title: 'B', location: 'Y' }] as Activity[];

      expect(service.calculateModificationRatio(original, user)).toBe(1);
    });

    it('should return 0 when both arrays are empty', () => {
      expect(service.calculateModificationRatio([], [])).toBe(0);
    });

    it('should return 1 when original is empty and user has items', () => {
      const user = [{ title: 'A', location: 'X' }] as Activity[];
      expect(service.calculateModificationRatio([], user)).toBe(1);
    });

    it('should return 1 when user removed all activities', () => {
      const original = [{ title: 'A', location: 'X' }] as Activity[];
      expect(service.calculateModificationRatio(original, [])).toBe(1);
    });

    it('should return partial ratio for some overlap', () => {
      const original = [
        { title: 'A', location: 'X' },
        { title: 'B', location: 'Y' },
        { title: 'C', location: 'Z' },
      ] as Activity[];
      const user = [
        { title: 'A', location: 'X' },
        { title: 'D', location: 'W' },
        { title: 'E', location: 'V' },
      ] as Activity[];

      // 1 surviving out of max(3,3)=3 → 1 - 1/3 = 0.667
      const ratio = service.calculateModificationRatio(original, user);
      expect(ratio).toBeCloseTo(0.667, 2);
    });
  });

  describe('validateTemplate', () => {
    it('should return no issues for a valid template', () => {
      const template = mockTemplate() as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toEqual([]);
    });

    it('should flag empty days', () => {
      const template = { ...mockTemplate(), days: [] } as unknown as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toContain('No days in template');
    });

    it('should flag day with no activities', () => {
      const template = {
        ...mockTemplate(),
        days: [{ dayNumber: 1, activities: [] }],
      } as unknown as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toContain('Day 1: no activities');
    });

    it('should flag activity missing title', () => {
      const template = {
        ...mockTemplate(),
        days: [
          {
            dayNumber: 1,
            activities: [{ title: '', location: 'X', time: '10:00' }],
          },
        ],
      } as unknown as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toContain('Day 1: activity missing title');
    });

    it('should flag invalid time format', () => {
      const template = {
        ...mockTemplate(),
        days: [
          {
            dayNumber: 1,
            activities: [{ title: 'Visit', location: 'X', time: '10am' }],
          },
        ],
      } as unknown as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toContain('Day 1: "Visit" invalid time format');
    });

    it('should flag negative cost', () => {
      const template = {
        ...mockTemplate(),
        days: [
          {
            dayNumber: 1,
            activities: [
              { title: 'Visit', location: 'X', time: '10:00', estimatedCost: -5 },
            ],
          },
        ],
      } as unknown as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toContain('Day 1: "Visit" negative cost');
    });

    it('should flag unreasonable duration', () => {
      const template = {
        ...mockTemplate(),
        days: [
          {
            dayNumber: 1,
            activities: [
              { title: 'Visit', location: 'X', time: '10:00', estimatedDuration: 800 },
            ],
          },
        ],
      } as unknown as ItineraryTemplate;
      const issues = service.validateTemplate(template);
      expect(issues).toContain('Day 1: "Visit" unreasonable duration');
    });
  });

  describe('recordUserModification', () => {
    it('should increment userModifiedCount and recalculate quality', async () => {
      repo.increment.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue({
        id: 'tmpl-1',
        servedCount: 20,
        userModifiedCount: 6, // after increment
      });

      await service.recordUserModification('tmpl-1');

      expect(repo.increment).toHaveBeenCalledWith(
        { id: 'tmpl-1' },
        'userModifiedCount',
        1,
      );
      expect(repo.update).toHaveBeenCalledWith('tmpl-1', {
        qualityScore: 0.7, // 1 - 6/20 = 0.7
      });
    });

    it('should not update quality if servedCount is 0', async () => {
      repo.increment.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue({
        id: 'tmpl-1',
        servedCount: 0,
        userModifiedCount: 1,
      });

      await service.recordUserModification('tmpl-1');

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should not throw on error', async () => {
      repo.increment.mockRejectedValue(new Error('DB error'));

      await expect(service.recordUserModification('tmpl-1')).resolves.toBeUndefined();
    });
  });

  describe('getSmartRefreshQueue', () => {
    it('should call raw SQL with threshold and limit', async () => {
      const mockTemplates = [mockTemplate()];
      repo.query.mockResolvedValue(mockTemplates);

      const result = await service.getSmartRefreshQueue(5);

      expect(repo.query).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST(popularity, 1)'),
        expect.arrayContaining([expect.any(Date), 5]),
      );
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('getHealthDashboard', () => {
    it('should aggregate all health metrics', async () => {
      repo.count
        .mockResolvedValueOnce(100) // totalTemplates
        .mockResolvedValueOnce(15); // staleCount

      repo.query
        .mockResolvedValueOnce([{ withEmbeddings: '80', withoutEmbeddings: '20' }]) // embedding stats
        .mockResolvedValueOnce([{ averageQuality: '0.72', lowQualityCount: '8' }]) // quality stats
        .mockResolvedValueOnce([ // top destinations
          { destination: 'Tokyo', count: 50, avgQuality: 0.85 },
        ])
        .mockResolvedValueOnce([ // refresh queue
          {
            id: 'tmpl-1',
            destination: 'Tokyo',
            durationDays: 3,
            qualityScore: 0.5,
            popularity: 10,
            refreshPriority: 25.5,
          },
        ]);

      const dashboard = await service.getHealthDashboard();

      expect(dashboard.totalTemplates).toBe(100);
      expect(dashboard.staleCount).toBe(15);
      expect(dashboard.withEmbeddings).toBe(80);
      expect(dashboard.withoutEmbeddings).toBe(20);
      expect(dashboard.averageQuality).toBe(0.72);
      expect(dashboard.lowQualityCount).toBe(8);
      expect(dashboard.topDestinations).toHaveLength(1);
      expect(dashboard.refreshQueue).toHaveLength(1);
    });

    it('should handle empty database', async () => {
      repo.count.mockResolvedValue(0);
      repo.query
        .mockResolvedValueOnce([{ withEmbeddings: '0', withoutEmbeddings: '0' }])
        .mockResolvedValueOnce([{ averageQuality: null, lowQualityCount: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const dashboard = await service.getHealthDashboard();

      expect(dashboard.totalTemplates).toBe(0);
      expect(dashboard.averageQuality).toBeNull();
      expect(dashboard.topDestinations).toEqual([]);
      expect(dashboard.refreshQueue).toEqual([]);
    });
  });

  describe('findTemplate', () => {
    it('should return exact match and increment counters', async () => {
      const template = mockTemplate() as ItineraryTemplate;
      repo.findOne.mockResolvedValue(template);

      const result = await service.findTemplate({
        destination: 'Tokyo, Japan',
        durationDays: 3,
      });

      expect(result).not.toBeNull();
      expect(result!.matchType).toBe('exact');
      expect(result!.templateId).toBe('tmpl-1');
      expect(repo.increment).toHaveBeenCalledWith(
        { id: 'tmpl-1' },
        'servedCount',
        1,
      );
    });

    it('should return null when no match found', async () => {
      repo.findOne.mockResolvedValue(null);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      repo.createQueryBuilder.mockReturnValue(qb);
      embeddingService.generateEmbedding.mockResolvedValue(null);

      const result = await service.findTemplate({
        destination: 'Unknown City',
        durationDays: 3,
      });

      expect(result).toBeNull();
    });
  });
});
