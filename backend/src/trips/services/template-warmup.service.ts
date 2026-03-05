import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TemplateService } from './template.service';
import { SeedTemplatesCommand } from '../commands/seed-templates.command';

/**
 * Priority tiers for template seeding.
 *
 * Tier 1: Top 10 destinations × most common durations (3,5d) × primary language (ko)
 *         → 20 templates, covers ~60% of real user requests
 * Tier 2: Top 10 × all durations (2,3,4,5,7) × all languages (ko,en,ja)
 *         → 150 templates, covers ~85% of user requests
 * Tier 3: All 50 destinations × all combos
 *         → 750 templates, full cache coverage
 */
const PRIORITY_TIERS = {
  tier1: {
    label: 'High-priority (top 10 × 2 durations × ko)',
    destinations: [
      'Tokyo',
      'Seoul',
      'Osaka',
      'Bangkok',
      'Paris',
      'London',
      'Rome',
      'Jeju',
      'Bali',
      'New York',
    ],
    durations: [3, 5],
    languages: ['ko'],
  },
  tier2: {
    label: 'Medium-priority (top 10 × all durations × all langs)',
    destinations: [
      'Tokyo',
      'Seoul',
      'Osaka',
      'Bangkok',
      'Paris',
      'London',
      'Rome',
      'Jeju',
      'Bali',
      'New York',
    ],
    durations: [2, 3, 4, 5, 7],
    languages: ['ko', 'en', 'ja'],
  },
  tier3: {
    label: 'Full coverage (all destinations)',
    destinations: undefined as string[] | undefined, // all
    durations: [2, 3, 4, 5, 7],
    languages: ['ko', 'en', 'ja'],
  },
};

@Injectable()
export class TemplateWarmupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplateWarmupService.name);
  private seedInProgress = false;
  private lastSeedResult: {
    tier: string;
    generated: number;
    skipped: number;
    failed: number;
    completedAt: Date;
  } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    private readonly seedCommand: SeedTemplatesCommand,
  ) {}

  onApplicationBootstrap(): void {
    const autoSeed = this.configService.get<string>(
      'TEMPLATE_AUTO_SEED',
      'false',
    );
    if (autoSeed !== 'true') {
      this.logger.log(
        'Auto-seed disabled (set TEMPLATE_AUTO_SEED=true to enable)',
      );
      return;
    }

    // Run coverage check, then seed in background (non-blocking)
    this.warmup().catch((err) =>
      this.logger.error(
        'Warmup failed',
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  /**
   * Run warmup: check coverage, seed missing templates by priority tier.
   * Non-blocking — called from onApplicationBootstrap as fire-and-forget.
   */
  async warmup(): Promise<void> {
    if (this.seedInProgress) {
      this.logger.warn('Seed already in progress, skipping');
      return;
    }

    this.seedInProgress = true;

    try {
      const coverage = await this.getCoverage();
      this.logger.log(
        `Template cache coverage: ${coverage.cachedCount}/${coverage.totalExpected} ` +
          `(${coverage.coveragePercent}%) — ` +
          `Tier1: ${coverage.tier1Percent}%, Tier2: ${coverage.tier2Percent}%`,
      );

      // Determine which tier to seed
      if (coverage.tier1Percent < 80) {
        this.logger.log(`Seeding Tier 1: ${PRIORITY_TIERS.tier1.label}`);
        const result = await this.seedCommand.seed({
          destinations: PRIORITY_TIERS.tier1.destinations,
          durations: PRIORITY_TIERS.tier1.durations,
          languages: PRIORITY_TIERS.tier1.languages,
          skipExisting: true,
        });
        this.lastSeedResult = {
          tier: 'tier1',
          ...result,
          completedAt: new Date(),
        };
        this.logger.log(
          `Tier 1 complete: ${result.generated} generated, ${result.skipped} skipped, ${result.failed} failed`,
        );
      }

      if (coverage.tier2Percent < 80) {
        this.logger.log(`Seeding Tier 2: ${PRIORITY_TIERS.tier2.label}`);
        const result = await this.seedCommand.seed({
          destinations: PRIORITY_TIERS.tier2.destinations,
          durations: PRIORITY_TIERS.tier2.durations,
          languages: PRIORITY_TIERS.tier2.languages,
          skipExisting: true,
        });
        this.lastSeedResult = {
          tier: 'tier2',
          ...result,
          completedAt: new Date(),
        };
        this.logger.log(
          `Tier 2 complete: ${result.generated} generated, ${result.skipped} skipped, ${result.failed} failed`,
        );
      }

      // Tier 3 only runs if explicitly requested (too expensive for auto-seed)
      this.logger.log('Warmup complete');
    } finally {
      this.seedInProgress = false;
    }
  }

  /**
   * Calculate template cache coverage across all priority tiers.
   */
  async getCoverage(): Promise<{
    cachedCount: number;
    totalExpected: number;
    coveragePercent: number;
    tier1Cached: number;
    tier1Total: number;
    tier1Percent: number;
    tier2Cached: number;
    tier2Total: number;
    tier2Percent: number;
    tier3Total: number;
  }> {
    const stats = await this.templateService.getStats();
    const cachedCount = stats.totalTemplates;

    // Tier totals
    const tier1Total =
      PRIORITY_TIERS.tier1.destinations.length *
      PRIORITY_TIERS.tier1.durations.length *
      PRIORITY_TIERS.tier1.languages.length;
    const tier2Total =
      PRIORITY_TIERS.tier2.destinations.length *
      PRIORITY_TIERS.tier2.durations.length *
      PRIORITY_TIERS.tier2.languages.length;
    const allDestinations = this.seedCommand.getTopDestinations();
    const tier3Total = allDestinations.length * 5 * 3; // 50 × 5 durations × 3 langs

    // Count tier1 coverage via DB
    const tier1Cached = await this.countCachedForTier(PRIORITY_TIERS.tier1);
    const tier2Cached = await this.countCachedForTier(PRIORITY_TIERS.tier2);

    return {
      cachedCount,
      totalExpected: tier3Total,
      coveragePercent:
        tier3Total > 0 ? Math.round((cachedCount / tier3Total) * 100) : 0,
      tier1Cached,
      tier1Total,
      tier1Percent:
        tier1Total > 0 ? Math.round((tier1Cached / tier1Total) * 100) : 0,
      tier2Cached,
      tier2Total,
      tier2Percent:
        tier2Total > 0 ? Math.round((tier2Cached / tier2Total) * 100) : 0,
      tier3Total,
    };
  }

  /**
   * Count how many templates exist for a given tier's destination/duration/language combos.
   */
  private async countCachedForTier(tier: {
    destinations: string[];
    durations: number[];
    languages: string[];
  }): Promise<number> {
    // Normalize destination names to match DB format (lowercase first word)
    const normalizedDests = tier.destinations.map((d) => d.toLowerCase());

    const result = await this.templateService.countByFilters(
      normalizedDests,
      tier.durations,
      tier.languages,
    );
    return result;
  }

  /** Get status of current/last seed operation. */
  getStatus(): {
    seedInProgress: boolean;
    lastSeedResult: typeof this.lastSeedResult;
  } {
    return {
      seedInProgress: this.seedInProgress,
      lastSeedResult: this.lastSeedResult,
    };
  }
}
