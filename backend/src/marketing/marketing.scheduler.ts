import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLogService } from '../common/services/error-log.service';
import { getErrorMessage } from '../common/types/request.types';
import {
  ViralPost,
  ViralPostChannel,
  ViralPostStatus,
} from './entities/viral-post.entity';
import {
  ContentResult,
  MarketingContentService,
  OpenAiNotConfiguredError,
} from './content.service';
import { NaverEmailPublisher } from './naver-email.publisher';
import { ScenarioService } from './scenario.service';
import { buildScenarioKey, Scenario } from './scenario.pool';
import { SelfBlogPublisher } from './self-blog.publisher';

export interface MarketingRunSummary {
  ran: boolean;
  reason?: string;
  scenarioKey?: string;
  selfBlog?: { status: ViralPostStatus; url?: string; error?: string };
  naver?: { status: ViralPostStatus; error?: string };
}

/**
 * Daily viral-marketing orchestrator. Mirrors trip-status.scheduler.ts (Logger,
 * try/catch, errorLogService?.record on failure).
 *
 * One run: pick a fresh scenario → generate channel-specific content → publish
 * the self-blog HTML AND email the Naver draft. The two channels are isolated:
 * a failure in one never blocks the other, and each writes its own ViralPost row
 * (sharing the scenarioKey) so the 30-day dedup window reserves the combo and
 * the audit trail is complete.
 *
 * Cron fires at 08:00 KST (explicit timeZone so it does not depend on container
 * TZ — see risks in the blueprint).
 */
@Injectable()
export class MarketingScheduler {
  private readonly logger = new Logger(MarketingScheduler.name);

  constructor(
    @InjectRepository(ViralPost)
    private readonly viralPostRepository: Repository<ViralPost>,
    private readonly configService: ConfigService,
    private readonly scenarioService: ScenarioService,
    private readonly contentService: MarketingContentService,
    private readonly selfBlogPublisher: SelfBlogPublisher,
    private readonly naverEmailPublisher: NaverEmailPublisher,
    @Optional()
    @Inject(ErrorLogService)
    private readonly errorLogService?: ErrorLogService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyMarketing(): Promise<MarketingRunSummary> {
    return this.run();
  }

  /** Manual trigger for testing / admin invocation — same path as the cron. */
  async generateNow(): Promise<MarketingRunSummary> {
    this.logger.log('Manual marketing run triggered');
    return this.run();
  }

  private async run(): Promise<MarketingRunSummary> {
    // 1. Master switch — default off until ops configures env.
    const enabled = this.configService.get<boolean>('marketing.enabled');
    if (!enabled) {
      this.logger.log(
        'Marketing automation disabled (marketing.enabled=false)',
      );
      return { ran: false, reason: 'disabled' };
    }

    if (!this.contentService.isConfigured()) {
      this.logger.warn('OpenAI not configured — skipping marketing run');
      void this.errorLogService?.record({
        error: new Error('OPENAI_NOT_CONFIGURED'),
        source: 'Cron dailyMarketing',
        routeName: 'cron:daily-marketing',
        severity: 'warning',
      });
      return { ran: false, reason: 'openai_not_configured' };
    }

    try {
      const scenario = await this.scenarioService.pickFreshScenario();
      const scenarioKey = buildScenarioKey(scenario);

      const selfBlog = await this.runSelfBlog(scenario, scenarioKey);
      const naver = await this.runNaverDraft(scenario, scenarioKey);

      this.logger.log(
        `Marketing run complete: self-blog=${selfBlog.status} naver=${naver.status}`,
      );
      return { ran: true, scenarioKey, selfBlog, naver };
    } catch (error) {
      this.logger.error(
        `Marketing run failed: ${getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      void this.errorLogService?.record({
        error,
        source: 'Cron dailyMarketing',
        routeName: 'cron:daily-marketing',
        severity: 'error',
      });
      return { ran: true, reason: getErrorMessage(error) };
    }
  }

  /** Self-blog channel — isolated so its failure never blocks the Naver draft. */
  private async runSelfBlog(
    scenario: Scenario,
    scenarioKey: string,
  ): Promise<{ status: ViralPostStatus; url?: string; error?: string }> {
    let content: ContentResult | undefined;
    try {
      content = await this.contentService.generate(scenario, 'self_blog');
      const result = await this.selfBlogPublisher.publish(content);
      await this.persist({
        scenario,
        scenarioKey,
        channel: ViralPostChannel.SELF_BLOG,
        status: ViralPostStatus.PUBLISHED,
        title: content.title,
        slug: content.slug,
        url: result.url,
        selfBlogPublished: true,
      });
      return { status: ViralPostStatus.PUBLISHED, url: result.url };
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Self-blog channel failed: ${message}`);
      void this.errorLogService?.record({
        error,
        source: 'Cron dailyMarketing:selfBlog',
        routeName: 'cron:daily-marketing',
        severity:
          error instanceof OpenAiNotConfiguredError ? 'warning' : 'error',
      });
      await this.persist({
        scenario,
        scenarioKey,
        channel: ViralPostChannel.SELF_BLOG,
        status: ViralPostStatus.FAILED,
        title: content?.title ?? `${scenario.destination} 여행 후기`,
        slug: content?.slug ?? null,
        url: null,
        errorMessage: message,
      });
      return { status: ViralPostStatus.FAILED, error: message };
    }
  }

  /** Naver draft channel — isolated; uses a separately-flavored content variant. */
  private async runNaverDraft(
    scenario: Scenario,
    scenarioKey: string,
  ): Promise<{ status: ViralPostStatus; error?: string }> {
    let content: ContentResult | undefined;
    try {
      content = await this.contentService.generate(scenario, 'naver_draft');
      await this.naverEmailPublisher.sendDraft(scenario, content);
      await this.persist({
        scenario,
        scenarioKey,
        channel: ViralPostChannel.NAVER_DRAFT,
        status: ViralPostStatus.DRAFTED,
        title: content.title,
        slug: null,
        url: null,
        naverEmailSent: true,
      });
      return { status: ViralPostStatus.DRAFTED };
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Naver draft channel failed: ${message}`);
      void this.errorLogService?.record({
        error,
        source: 'Cron dailyMarketing:naverDraft',
        routeName: 'cron:daily-marketing',
        severity:
          error instanceof OpenAiNotConfiguredError ? 'warning' : 'error',
      });
      await this.persist({
        scenario,
        scenarioKey,
        channel: ViralPostChannel.NAVER_DRAFT,
        status: ViralPostStatus.FAILED,
        title: content?.title ?? `${scenario.destination} 여행 후기`,
        slug: null,
        url: null,
        errorMessage: message,
      });
      return { status: ViralPostStatus.FAILED, error: message };
    }
  }

  /** Persist one audit/dedup row. Best-effort: never throws into the caller. */
  private async persist(params: {
    scenario: Scenario;
    scenarioKey: string;
    channel: ViralPostChannel;
    status: ViralPostStatus;
    title: string;
    slug: string | null;
    url: string | null;
    selfBlogPublished?: boolean;
    naverEmailSent?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const row = this.viralPostRepository.create({
        scenarioKey: params.scenarioKey,
        destination: params.scenario.destination,
        travelType: params.scenario.travelType,
        durationDays: params.scenario.durationDays,
        persona: params.scenario.persona,
        emphasis: params.scenario.emphasis,
        structure: params.scenario.structure,
        channel: params.channel,
        status: params.status,
        title: params.title.slice(0, 200),
        slug: params.slug ? params.slug.slice(0, 200) : null,
        url: params.url,
        selfBlogPublished: params.selfBlogPublished ?? false,
        naverEmailSent: params.naverEmailSent ?? false,
        language: 'ko',
        errorMessage: params.errorMessage ?? null,
      });
      await this.viralPostRepository.save(row);
    } catch (error) {
      this.logger.error(
        `Failed to persist ViralPost row (${params.channel}): ${getErrorMessage(error)}`,
      );
      void this.errorLogService?.record({
        error,
        source: 'Cron dailyMarketing:persist',
        routeName: 'cron:daily-marketing',
        severity: 'error',
      });
    }
  }
}
