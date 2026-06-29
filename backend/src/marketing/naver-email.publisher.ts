import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { ContentResult } from './content.service';
import { Scenario } from './scenario.pool';
import { escapeHtml } from './html.templates';

/**
 * Semi-automatic Naver path (compliance: avoid 저품질/ban — never auto-POST).
 *
 * Builds a single inline-HTML email containing a copy-paste-ready post (title,
 * tags, plain-text body) plus manual-posting reminders, and sends it to
 * MARKETING_EMAIL_TO each morning so the operator pastes it into Naver by hand.
 *
 * The draft content is generated from the SAME scenario as the self-blog post
 * but with a different structure/length (see MarketingContentService variant),
 * so the two channels are never near-duplicates.
 */
@Injectable()
export class NaverEmailPublisher {
  private readonly logger = new Logger(NaverEmailPublisher.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private get recipient(): string {
    return (
      this.configService.get<string>('marketing.emailTo') ||
      this.configService.get<string>('email.from') ||
      'longpapa82@gmail.com'
    );
  }

  /**
   * Send the daily Naver draft email. Throws on send failure so the scheduler
   * records a failed naver_draft ViralPost row.
   */
  async sendDraft(scenario: Scenario, content: ContentResult): Promise<void> {
    const to = this.recipient;
    const subject = `📝 오늘의 myTravel 블로그 초안 — ${scenario.destination} ${scenario.travelType}`;
    const html = this.buildEmailHtml(scenario, content);
    await this.emailService.sendRawHtml(to, subject, html);
    this.logger.log(
      `Naver draft email dispatched for scenario ${scenario.destination}/${scenario.travelType}`,
    );
  }

  private buildEmailHtml(scenario: Scenario, content: ContentResult): string {
    const title = escapeHtml(content.title);
    const tagsLine = escapeHtml(content.tags.join(' '));
    const bodyPlain = escapeHtml(content.bodyPlain);
    const scenarioLine = escapeHtml(
      `${scenario.destination} · ${scenario.travelType} · ${scenario.durationLabel} · ` +
        `${scenario.persona} · 강조: ${scenario.emphasis} · 구성: ${scenario.structure}`,
    );
    const dateLabel = escapeHtml(content.datePublished.replace(/-/g, '.'));

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">myTravel 마케팅 · ${dateLabel}</p>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;color:#1e293b;">오늘의 네이버 블로그 초안</h1>

      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;">제목</p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#f1f5f9;border-radius:8px;font-size:15px;font-weight:600;color:#1e293b;">${title}</p>

      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;">추천 태그</p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#f1f5f9;border-radius:8px;font-size:14px;color:#4A90D9;">${tagsLine}</p>

      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;">본문 (복사해서 네이버 에디터에 붙여넣으세요)</p>
      <pre style="margin:0 0 20px;padding:16px;background:#0f172a;color:#e2e8f0;border-radius:8px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;font-family:'Noto Sans KR',monospace;">${bodyPlain}</pre>

      <div style="margin:0 0 16px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;line-height:1.7;color:#9a3412;">
        <strong>발행 전 체크 (네이버 저품질·어뷰징 방지)</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">
          <li>이 초안은 <strong>직접 손으로</strong> 네이버 에디터에 붙여넣어 발행하세요 (자동 발행 금지).</li>
          <li>매일 같은 시간보다 <strong>발행 시간을 조금씩 다르게</strong> 하세요.</li>
          <li>직접 찍은 <strong>사진 1~2장</strong>을 추가하면 품질 점수에 도움이 됩니다.</li>
          <li>셀프 블로그(mytravel-planner.com/blog)에 이미 올라간 글과 <strong>같은 문장을 그대로 복붙하지 마세요.</strong> 이 초안은 일부러 다르게 작성되어 있습니다.</li>
        </ul>
      </div>

      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        시나리오: ${scenarioLine}<br/>
        같은 시나리오의 자동 포스트는 셀프 블로그에 이미 게시되었습니다.
      </p>
    </div>
    <p style="text-align:center;margin:16px 0 0;font-size:12px;color:#cbd5e1;">myTravel · mytravel-planner.com</p>
  </div>
</body>
</html>`;
  }
}
