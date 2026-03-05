import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TemplateWarmupService } from './template-warmup.service';
import { TemplateService } from './template.service';
import { SeedTemplatesCommand } from '../commands/seed-templates.command';

describe('TemplateWarmupService', () => {
  let service: TemplateWarmupService;
  let configService: { get: jest.Mock };
  let templateService: {
    getStats: jest.Mock;
    countByFilters: jest.Mock;
  };
  let seedCommand: {
    seed: jest.Mock;
    getTopDestinations: jest.Mock;
  };

  beforeEach(async () => {
    configService = { get: jest.fn().mockReturnValue('false') };
    templateService = {
      getStats: jest.fn().mockResolvedValue({
        totalTemplates: 0,
        staleCount: 0,
        topDestinations: [],
      }),
      countByFilters: jest.fn().mockResolvedValue(0),
    };
    seedCommand = {
      seed: jest
        .fn()
        .mockResolvedValue({ generated: 5, skipped: 0, failed: 0 }),
      getTopDestinations: jest.fn().mockReturnValue(
        Array.from({ length: 50 }, (_, i) => ({
          destination: `City ${i}`,
          country: `Country ${i}`,
          city: `City ${i}`,
        })),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateWarmupService,
        { provide: ConfigService, useValue: configService },
        { provide: TemplateService, useValue: templateService },
        { provide: SeedTemplatesCommand, useValue: seedCommand },
      ],
    }).compile();

    service = module.get<TemplateWarmupService>(TemplateWarmupService);
  });

  describe('onApplicationBootstrap', () => {
    it('should not seed when TEMPLATE_AUTO_SEED is false', () => {
      configService.get.mockReturnValue('false');
      service.onApplicationBootstrap();
      expect(seedCommand.seed).not.toHaveBeenCalled();
    });

    it('should trigger warmup when TEMPLATE_AUTO_SEED is true', async () => {
      configService.get.mockReturnValue('true');
      // Mock getCoverage to avoid full execution
      templateService.countByFilters.mockResolvedValue(0);

      service.onApplicationBootstrap();
      // Warmup is fire-and-forget, give it a tick to start
      await new Promise((r) => setTimeout(r, 50));

      expect(seedCommand.seed).toHaveBeenCalled();
    });
  });

  describe('getCoverage', () => {
    it('should calculate coverage across tiers', async () => {
      templateService.getStats.mockResolvedValue({
        totalTemplates: 100,
        staleCount: 5,
        topDestinations: [],
      });
      templateService.countByFilters
        .mockResolvedValueOnce(15) // tier1
        .mockResolvedValueOnce(80); // tier2

      const coverage = await service.getCoverage();

      expect(coverage.cachedCount).toBe(100);
      expect(coverage.tier1Cached).toBe(15);
      expect(coverage.tier1Total).toBe(20); // 10 × 2 × 1
      expect(coverage.tier1Percent).toBe(75);
      expect(coverage.tier2Cached).toBe(80);
      expect(coverage.tier2Total).toBe(150); // 10 × 5 × 3
      expect(coverage.tier2Percent).toBe(53);
      expect(coverage.tier3Total).toBe(750); // 50 × 5 × 3
      expect(coverage.coveragePercent).toBe(13); // 100/750
    });

    it('should handle empty database', async () => {
      const coverage = await service.getCoverage();

      expect(coverage.cachedCount).toBe(0);
      expect(coverage.tier1Percent).toBe(0);
      expect(coverage.tier2Percent).toBe(0);
      expect(coverage.coveragePercent).toBe(0);
    });
  });

  describe('warmup', () => {
    it('should seed tier1 when coverage is low', async () => {
      templateService.countByFilters.mockResolvedValue(0);

      await service.warmup();

      // Should have seeded both tier1 and tier2 (both below 80%)
      expect(seedCommand.seed).toHaveBeenCalledTimes(2);
      expect(seedCommand.seed).toHaveBeenCalledWith(
        expect.objectContaining({
          durations: [3, 5],
          languages: ['ko'],
          skipExisting: true,
        }),
      );
    });

    it('should skip tier1 when coverage is high', async () => {
      templateService.countByFilters
        .mockResolvedValueOnce(18) // tier1: 18/20 = 90%
        .mockResolvedValueOnce(50); // tier2: 50/150 = 33%

      await service.warmup();

      // Should skip tier1, only seed tier2
      expect(seedCommand.seed).toHaveBeenCalledTimes(1);
      expect(seedCommand.seed).toHaveBeenCalledWith(
        expect.objectContaining({
          durations: [2, 3, 4, 5, 7],
          languages: ['ko', 'en', 'ja'],
        }),
      );
    });

    it('should skip all tiers when fully covered', async () => {
      templateService.countByFilters
        .mockResolvedValueOnce(20) // tier1: 100%
        .mockResolvedValueOnce(150); // tier2: 100%

      await service.warmup();

      expect(seedCommand.seed).not.toHaveBeenCalled();
    });

    it('should not run concurrent warmups', async () => {
      templateService.countByFilters.mockResolvedValue(0);
      // Slow seed to ensure overlap
      seedCommand.seed.mockImplementation(
        () =>
          new Promise((r) =>
            setTimeout(() => r({ generated: 1, skipped: 0, failed: 0 }), 100),
          ),
      );

      const p1 = service.warmup();
      const p2 = service.warmup();
      await Promise.all([p1, p2]);

      // Second call should have been skipped
      // Only tier1 + tier2 from first call = 2
      expect(seedCommand.seed).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      const status = service.getStatus();
      expect(status.seedInProgress).toBe(false);
      expect(status.lastSeedResult).toBeNull();
    });

    it('should track last seed result after warmup', async () => {
      templateService.countByFilters.mockResolvedValue(0);
      seedCommand.seed.mockResolvedValue({
        generated: 3,
        skipped: 2,
        failed: 0,
      });

      await service.warmup();

      const status = service.getStatus();
      expect(status.seedInProgress).toBe(false);
      expect(status.lastSeedResult).not.toBeNull();
      expect(status.lastSeedResult!.generated).toBe(3);
      expect(status.lastSeedResult!.completedAt).toBeInstanceOf(Date);
    });
  });
});
