import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ViralPost } from './entities/viral-post.entity';
import { buildScenarioKey, Scenario, selectScenario } from './scenario.pool';

const DEFAULT_DEDUP_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Selects one fresh Scenario per daily run, enforcing the 30-day no-reuse rule.
 *
 * Dedup is keyed on scenarioKey regardless of channel/status, so even a FAILED
 * attempt reserves the combination for 30 days (prevents a retry-storm from
 * re-picking the same combo). The combination space is huge relative to the
 * 30-day window, so the bounded retry inside selectScenario almost never needs
 * its fallback.
 */
@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);

  constructor(
    @InjectRepository(ViralPost)
    private readonly viralPostRepository: Repository<ViralPost>,
  ) {}

  /**
   * Distinct scenarioKeys used within the last `days` days. Mapped into a Set
   * for O(1) membership checks during selection.
   */
  async recentlyUsedKeys(days = DEFAULT_DEDUP_DAYS): Promise<Set<string>> {
    const since = new Date(Date.now() - days * MS_PER_DAY);
    const rows = await this.viralPostRepository.find({
      where: { createdAt: MoreThanOrEqual(since) },
      select: ['scenarioKey'],
    });
    return new Set(rows.map((row) => row.scenarioKey));
  }

  /**
   * Pick a fresh, immutable Scenario not used within the dedup window.
   */
  async pickFreshScenario(days = DEFAULT_DEDUP_DAYS): Promise<Scenario> {
    const recentKeys = await this.recentlyUsedKeys(days);
    const scenario = selectScenario(recentKeys);
    this.logger.log(
      `Picked scenario: ${buildScenarioKey(scenario)} ` +
        `(recent keys in last ${days}d: ${recentKeys.size})`,
    );
    return scenario;
  }
}
