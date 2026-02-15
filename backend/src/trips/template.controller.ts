import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TemplateService } from './services/template.service';
import { TemplateWarmupService } from './services/template-warmup.service';
import { SeedTemplatesCommand } from './commands/seed-templates.command';

@Controller('templates')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly warmupService: TemplateWarmupService,
    private readonly seedCommand: SeedTemplatesCommand,
  ) {}

  /**
   * GET /api/templates/stats
   * Template cache statistics
   */
  @Get('stats')
  async getStats() {
    return this.templateService.getStats();
  }

  /**
   * GET /api/templates/destinations
   * List of top destinations used for seeding
   */
  @Get('destinations')
  getDestinations() {
    return this.seedCommand.getTopDestinations();
  }

  /**
   * POST /api/templates/seed
   * Trigger template seeding (admin only).
   * Query params:
   *   - destinations: comma-separated city names (optional, defaults to all 50)
   *   - durations: comma-separated day counts (optional, defaults to 2,3,4,5,7)
   *   - languages: comma-separated lang codes (optional, defaults to ko,en,ja)
   */
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  async seedTemplates(
    @Query('destinations') destinations?: string,
    @Query('durations') durations?: string,
    @Query('languages') languages?: string,
  ) {
    const opts: Parameters<SeedTemplatesCommand['seed']>[0] = {
      skipExisting: true,
    };

    if (destinations) {
      opts.destinations = destinations.split(',').map((s) => s.trim());
    }
    if (durations) {
      opts.durations = durations.split(',').map((s) => parseInt(s.trim(), 10));
    }
    if (languages) {
      opts.languages = languages.split(',').map((s) => s.trim());
    }

    return this.seedCommand.seed(opts);
  }

  /**
   * POST /api/templates/refresh
   * Force refresh stale templates (admin only).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshStale(@Query('limit') limit?: string) {
    const stale = await this.templateService.getSmartRefreshQueue(
      limit ? parseInt(limit, 10) : 5,
    );
    return {
      staleCount: stale.length,
      templates: stale.map((t) => ({
        id: t.id,
        destination: t.destination,
        durationDays: t.durationDays,
        lastVerifiedAt: t.lastVerifiedAt,
        popularity: t.popularity,
        qualityScore: t.qualityScore,
      })),
    };
  }

  /**
   * GET /api/templates/health
   * Detailed health dashboard with quality metrics, embedding coverage, refresh queue.
   */
  @Get('health')
  async getHealthDashboard() {
    return this.templateService.getHealthDashboard();
  }

  /**
   * GET /api/templates/coverage
   * Cache coverage report across priority tiers.
   */
  @Get('coverage')
  async getCoverage() {
    const coverage = await this.warmupService.getCoverage();
    const status = this.warmupService.getStatus();
    return { ...coverage, ...status };
  }

  /**
   * POST /api/templates/warmup
   * Manually trigger warmup seeding (admin only).
   */
  @Post('warmup')
  @HttpCode(HttpStatus.OK)
  async triggerWarmup() {
    const status = this.warmupService.getStatus();
    if (status.seedInProgress) {
      return { message: 'Seed already in progress', ...status };
    }
    // Fire-and-forget warmup
    this.warmupService.warmup().catch(() => {});
    return { message: 'Warmup started in background' };
  }

  /**
   * POST /api/templates/backfill-embeddings
   * Generate vector embeddings for templates that don't have them yet.
   */
  @Post('backfill-embeddings')
  @HttpCode(HttpStatus.OK)
  async backfillEmbeddings(@Query('batch') batch?: string) {
    const batchSize = batch ? parseInt(batch, 10) : 50;
    const count = await this.templateService.backfillEmbeddings(batchSize);
    return { backfilled: count };
  }
}
