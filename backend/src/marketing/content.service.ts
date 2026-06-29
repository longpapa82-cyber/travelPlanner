import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CircuitBreaker, withRetry } from '../common/utils/resilience';
import { getErrorMessage } from '../common/types/request.types';
import { Scenario } from './scenario.pool';
import { escapeHtml } from './html.templates';

/**
 * Thrown when OpenAI is not configured (no key). The scheduler treats this as a
 * graceful skip rather than an error, matching ai.service.ts's empty-key guard.
 */
export class OpenAiNotConfiguredError extends Error {
  constructor() {
    super('OPENAI_NOT_CONFIGURED');
    this.name = 'OpenAiNotConfiguredError';
  }
}

/**
 * Which channel the content is for. The self-blog post and the Naver draft are
 * generated from the SAME scenario but with different structure/length
 * instructions so the two channels are never near-duplicates (Naver 저품질 방지).
 */
export type ContentVariant = 'self_blog' | 'naver_draft';

export interface ContentResult {
  /** Post title (<= 100 chars enforced). */
  title: string;
  /** URL-safe slug for the self-blog (self_blog variant only; derived if absent). */
  slug: string;
  /** SEO meta description (~120-160 chars). */
  metaDescription: string;
  /** Short card excerpt for the blog index. */
  excerpt: string;
  /** Recommended hashtags/keywords for the Naver draft. */
  tags: string[];
  /** Rendered article body as safe HTML fragment (<h2>/<p>/<ul> only). */
  bodyHtml: string;
  /** Plain-text body for the copy-paste Naver block. */
  bodyPlain: string;
  /** Inline SVG icon markup for the blog card. */
  iconSvg: string;
  /** ISO date (YYYY-MM-DD) the post is published. */
  datePublished: string;
  lang: 'ko';
}

interface RawContent {
  title?: unknown;
  metaDescription?: unknown;
  excerpt?: unknown;
  tags?: unknown;
  sections?: unknown;
}

interface RawSection {
  heading?: unknown;
  paragraphs?: unknown;
}

const DEFAULT_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>';

const MAX_TITLE_LEN = 100;

@Injectable()
export class MarketingContentService {
  private readonly logger = new Logger(MarketingContentService.name);
  private readonly openai?: OpenAI;
  private readonly model: string;
  private readonly breaker = new CircuitBreaker({
    name: 'MarketingOpenAI',
    failureThreshold: 4,
    resetTimeoutMs: 120_000,
  });

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
    if (apiKey && apiKey !== '' && !apiKey.includes('your-')) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log(
        `Marketing content service initialized (model: ${this.model})`,
      );
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not configured — marketing content generation disabled',
      );
    }
  }

  /** Whether OpenAI is available (lets the scheduler short-circuit cleanly). */
  isConfigured(): boolean {
    return this.openai !== undefined;
  }

  /**
   * Generate a believable first-person Korean travel diary for the given
   * scenario + channel variant. Throws OpenAiNotConfiguredError when no key.
   */
  async generate(
    scenario: Scenario,
    variant: ContentVariant,
  ): Promise<ContentResult> {
    if (!this.openai) {
      throw new OpenAiNotConfiguredError();
    }

    const openai = this.openai;
    const messages = this.buildMessages(scenario, variant);

    const content = await this.breaker.run(() =>
      withRetry(
        async () => {
          const completion = await openai.chat.completions.create({
            model: this.model,
            messages,
            temperature: 0.8,
            max_tokens: 1800,
            response_format: { type: 'json_object' },
          });
          const text = completion.choices[0]?.message?.content;
          if (!text || text.trim() === '') {
            throw new Error('OpenAI returned empty content');
          }
          return text;
        },
        2,
        1000,
        `MarketingContent ${variant}`,
      ),
    );

    return this.parseAndValidate(content, scenario);
  }

  private buildMessages(
    scenario: Scenario,
    variant: ContentVariant,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const lengthHint =
      variant === 'self_blog'
        ? '본문은 4~6개 섹션, 각 섹션 2~3개 문단으로 충분히 길고 자세하게 작성합니다.'
        : '본문은 3~4개 섹션, 각 섹션 1~2개 문단으로 간결하게 작성합니다(셀프 블로그 글과 중복되지 않도록 다른 표현·다른 도입부 사용).';

    const system = [
      '당신은 실제로 여행을 다녀온 평범한 사용자가 솔직하게 쓰는 1인칭 여행 후기 작성자입니다.',
      '"myTravel"(mytravel-planner.com)라는 AI 여행 플래너 앱을 사용해 여행 계획을 짜고, 여행 중에도 일정을 관리한 경험을 따뜻하고 구체적으로 적습니다.',
      '',
      '## 반드시 지킬 원칙',
      '- 과장 광고 문구(예: "최고", "혁명적", "무조건", "100%", "압도적")를 쓰지 않습니다. 차분하고 진솔한 후기 톤.',
      '- 사실과 다른 거짓 정보를 만들지 않습니다. 앱이 실제로 제공할 만한 기능(AI 일정 생성, 경비 정산, 공동 여행자 협업, 날씨 반영 동선, 오프라인 일정, 일자별 진행률, 추억 정리)만 자연스럽게 언급합니다.',
      '- 특정 식당/호텔의 가격·전화번호 같은 검증 불가능한 구체 수치를 단정하지 않습니다.',
      '- 구체적인 감정과 장면(설렘, 사소한 걱정, 예상보다 즐거웠던 순간)을 담아 봇이 쓴 것처럼 보이지 않게 합니다.',
      '- 한국어로만 작성합니다.',
      '',
      '## 출력 형식 (반드시 유효한 JSON 객체)',
      '{',
      '  "title": "후기 제목 (60자 이내, 자연스러운 구어체)",',
      '  "metaDescription": "검색용 요약 (120~160자)",',
      '  "excerpt": "블로그 카드용 짧은 소개 (80~120자)",',
      '  "tags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5"],',
      '  "sections": [ { "heading": "소제목", "paragraphs": ["문단1", "문단2"] } ]',
      '}',
    ].join('\n');

    const user = [
      '아래 설정으로 여행 후기를 작성해 주세요. 설정을 글에 그대로 나열하지 말고 자연스럽게 녹여내세요.',
      `- 여행지: ${scenario.destination}`,
      `- 동행: ${scenario.travelType}`,
      `- 기간: ${scenario.durationLabel}`,
      `- 글쓴이 페르소나: ${scenario.persona}`,
      `- 특히 도움이 된 앱 기능(이번 글의 핵심으로 강조): ${scenario.emphasis}`,
      `- 글의 구성 방식: ${scenario.structure}`,
      '',
      lengthHint,
      `이번 후기의 중심 소재는 "${scenario.emphasis}" 기능입니다. 이 기능이 어떻게 도움이 됐는지를 글의 주축으로 삼고, 다른 기능은 곁들이는 정도로만 1개 이하로 언급하세요(여러 기능을 나열식으로 늘어놓지 마세요).`,
      'myTravel의 핵심은 AI가 여행지·기간·취향을 입력하면 일자별 일정을 자동으로 짜주는 것입니다. 이 점이 자연스럽게 드러나면 좋습니다.',
      '제목과 본문 어딘가에 "myTravel"을 자연스럽게 1~2회 언급하세요.',
      '여행 계획 단계뿐 아니라 여행 중 관리가 편했던 점, 그리고 생각보다 더 즐거웠던 여행이었다는 마무리를 담아주세요.',
    ].join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  private parseAndValidate(rawText: string, scenario: Scenario): ContentResult {
    let parsed: RawContent;
    try {
      parsed = JSON.parse(rawText) as RawContent;
    } catch (error) {
      this.logger.error(
        `Failed to parse marketing content JSON: ${getErrorMessage(error)}`,
      );
      throw new Error('MARKETING_CONTENT_PARSE_FAILED');
    }

    const title = this.asNonEmptyString(parsed.title, 'title').slice(
      0,
      MAX_TITLE_LEN,
    );
    const metaDescription = this.asNonEmptyString(
      parsed.metaDescription,
      'metaDescription',
    ).slice(0, 200);
    const excerpt = this.asNonEmptyString(parsed.excerpt, 'excerpt').slice(
      0,
      300,
    );
    const tags = this.normalizeTags(parsed.tags, scenario);
    const sections = this.normalizeSections(parsed.sections);

    if (sections.length === 0) {
      throw new Error('MARKETING_CONTENT_EMPTY_BODY');
    }

    const bodyHtml = this.renderBodyHtml(sections);
    const bodyPlain = this.renderBodyPlain(title, sections, tags);
    const slug = this.buildSlug(scenario);
    const datePublished = this.todayIso();

    return {
      title,
      slug,
      metaDescription,
      excerpt,
      tags,
      bodyHtml,
      bodyPlain,
      iconSvg: DEFAULT_ICON_SVG,
      datePublished,
      lang: 'ko',
    };
  }

  private asNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`MARKETING_CONTENT_INVALID_FIELD:${field}`);
    }
    return value.trim();
  }

  private normalizeTags(value: unknown, scenario: Scenario): string[] {
    const fallback = [
      `#${scenario.destination}여행`,
      '#여행앱',
      '#AI여행일정',
      '#myTravel',
    ];
    if (!Array.isArray(value)) return fallback;
    const tags = value
      .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
      .map((t) => {
        const trimmed = t.trim();
        return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
      })
      .slice(0, 8);
    return tags.length > 0 ? tags : fallback;
  }

  private normalizeSections(
    value: unknown,
  ): { heading: string; paragraphs: string[] }[] {
    if (!Array.isArray(value)) return [];
    const sections: { heading: string; paragraphs: string[] }[] = [];
    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const section = raw as RawSection;
      const heading =
        typeof section.heading === 'string' ? section.heading.trim() : '';
      const paragraphs = Array.isArray(section.paragraphs)
        ? section.paragraphs
            .filter(
              (p): p is string => typeof p === 'string' && p.trim() !== '',
            )
            .map((p) => p.trim())
        : [];
      if (heading === '' && paragraphs.length === 0) continue;
      sections.push({ heading, paragraphs });
    }
    return sections;
  }

  private renderBodyHtml(
    sections: { heading: string; paragraphs: string[] }[],
  ): string {
    // Model text is untrusted external data, so we escape each heading/paragraph
    // directly here with the same escapeHtml the renderer uses. The structural
    // tags are the only raw HTML emitted; the inner text is fully escaped, so
    // model-produced angle brackets/quotes/braces can never break the document.
    const parts: string[] = [];
    for (const section of sections) {
      if (section.heading) {
        parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
      }
      for (const paragraph of section.paragraphs) {
        parts.push(`<p>${escapeHtml(paragraph)}</p>`);
      }
    }
    return parts.join('\n');
  }

  private renderBodyPlain(
    title: string,
    sections: { heading: string; paragraphs: string[] }[],
    tags: string[],
  ): string {
    const lines: string[] = [title, ''];
    for (const section of sections) {
      if (section.heading) {
        lines.push(`■ ${section.heading}`);
      }
      for (const paragraph of section.paragraphs) {
        lines.push(paragraph);
        lines.push('');
      }
    }
    lines.push(tags.join(' '));
    return lines.join('\n').trim();
  }

  /**
   * Deterministic slug: `review-<destinationSlug>-<Nd>-<YYYYMMDD>`.
   *
   * URL-safe and stable for a given (destination, duration, day): re-running the
   * same day produces the SAME slug, so the self-blog publisher's duplicate-slug
   * guard actually deduplicates instead of writing a second copy under a new
   * random URL. The date suffix keeps slugs unique across days even when the same
   * destination recurs (the 30-day dedup window prevents same-day collisions).
   */
  private buildSlug(scenario: Scenario): string {
    const dateKey = this.todayIso().replace(/-/g, '');
    return [
      'review',
      scenario.destinationSlug,
      `${scenario.durationDays}d`,
      dateKey,
    ].join('-');
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
