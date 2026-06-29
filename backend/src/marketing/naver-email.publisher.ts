import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { ContentResult } from './content.service';
import { MarketingImage } from './image.types';
import { Scenario } from './scenario.pool';
import { escapeHtml } from './html.templates';

/** A Pexels image that was successfully downloaded (carries its buffer). */
interface AttachableImage extends MarketingImage {
  readonly buffer: Buffer;
}

interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
}

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
   *
   * `images` are the SAME Pexels photos fetched once per run (with buffers for
   * the ones that downloaded). When at least one carries a buffer, they are
   * attached to the email and the body shows a "[본문 N번 위치에 ...]" marker plus
   * a "사진 출처" credit section. When none are attachable, the email falls back
   * to the existing text-only send with a note to add the operator's own photos.
   */
  async sendDraft(
    scenario: Scenario,
    content: ContentResult,
    images: readonly MarketingImage[] = [],
  ): Promise<void> {
    const to = this.recipient;
    const subject = `📝 오늘의 myTravel 블로그 초안 — ${scenario.destination} ${scenario.travelType}`;

    const attachables = images.filter((img): img is AttachableImage =>
      Buffer.isBuffer(img.buffer),
    );
    const attachments = this.buildAttachments(attachables);
    const html = this.buildEmailHtml(scenario, content, attachables);

    if (attachments.length > 0) {
      await this.emailService.sendRawHtmlWithAttachments(
        to,
        subject,
        html,
        attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      );
    } else {
      await this.emailService.sendRawHtml(to, subject, html);
    }
    this.logger.log(
      `Naver draft email dispatched for scenario ${scenario.destination}/${scenario.travelType} ` +
        `(attachments: ${attachments.length})`,
    );
  }

  /** Derive nodemailer attachments from the downloaded images. */
  private buildAttachments(
    images: readonly AttachableImage[],
  ): EmailAttachment[] {
    return images.map((img, i) => ({
      filename: `mytravel-photo-${i + 1}.${img.ext || 'jpg'}`,
      content: img.buffer,
      contentType: this.contentTypeFromExt(img.ext),
    }));
  }

  private contentTypeFromExt(ext: string): string {
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }

  private buildEmailHtml(
    scenario: Scenario,
    content: ContentResult,
    images: readonly AttachableImage[],
  ): string {
    const title = escapeHtml(content.title);
    const tagsLine = escapeHtml(content.tags.join(' '));
    const bodyPlain = escapeHtml(content.bodyPlain);
    const scenarioLine = escapeHtml(
      `${scenario.destination} · ${scenario.travelType} · ${scenario.durationLabel} · ` +
        `${scenario.persona} · 강조: ${scenario.emphasis} · 구성: ${scenario.structure}`,
    );
    const dateLabel = escapeHtml(content.datePublished.replace(/-/g, '.'));
    const photoBlock = this.buildPhotoBlock(images);
    const checklistPhotoLine =
      images.length > 0
        ? '<li>첨부된 <strong>Pexels 무료 사진</strong>을 다운로드해 본문 표시 위치(아래 안내)에 넣고, 각 사진 아래에 <strong>출처(Photo by … on Pexels)</strong>를 함께 적어주세요.</li>'
        : '<li>이번 초안에는 자동 첨부 사진이 없습니다. 직접 찍은 <strong>사진 1~2장</strong>을 추가하면 품질 점수에 도움이 됩니다.</li>';

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
${photoBlock}
      <div style="margin:0 0 16px;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;line-height:1.7;color:#9a3412;">
        <strong>발행 전 체크 (네이버 저품질·어뷰징 방지)</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">
          <li>이 초안은 <strong>직접 손으로</strong> 네이버 에디터에 붙여넣어 발행하세요 (자동 발행 금지).</li>
          <li>매일 같은 시간보다 <strong>발행 시간을 조금씩 다르게</strong> 하세요.</li>
          ${checklistPhotoLine}
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

  /**
   * Build the in-body photo guidance: per-image placement markers (where the
   * operator should drop each attached photo) plus a "사진 출처" credit section
   * (Pexels asks crediting photographers when possible). Returns '' when there
   * are no attachable images so the text-only email is unchanged. All dynamic
   * text (photographer names/URLs) is escaped; the URL is only linked when it
   * validated to an http(s) URL upstream, else rendered as plain text.
   */
  private buildPhotoBlock(images: readonly AttachableImage[]): string {
    if (images.length === 0) {
      return '';
    }

    const markers = images
      .map((img, i) => {
        const photographer = escapeHtml(img.photographer);
        const filename = escapeHtml(
          `mytravel-photo-${i + 1}.${img.ext || 'jpg'}`,
        );
        return `        <div style="margin:0 0 8px;padding:10px 12px;border:1px dashed #cbd5e1;border-radius:6px;font-size:13px;color:#475569;">[여기 ${i + 1}번 사진 — ${filename} — Photo by ${photographer} on Pexels]</div>`;
      })
      .join('\n');

    const credits = images
      .map((img, i) => {
        const photographer = escapeHtml(img.photographer);
        const filename = escapeHtml(
          `mytravel-photo-${i + 1}.${img.ext || 'jpg'}`,
        );
        const credit = img.photographerUrl.startsWith('http')
          ? `Photo by <a href="${escapeHtml(img.photographerUrl)}" style="color:#4A90D9;">${photographer}</a> on <a href="https://www.pexels.com" style="color:#4A90D9;">Pexels</a>`
          : `Photo by ${photographer} on <a href="https://www.pexels.com" style="color:#4A90D9;">Pexels</a>`;
        return `        <li><strong>${filename}</strong> — ${credit}</li>`;
      })
      .join('\n');

    return `
      <div style="margin:0 0 16px;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:13px;line-height:1.7;color:#1e3a8a;">
        <strong>📎 첨부 사진 안내 (${images.length}장)</strong>
        <p style="margin:6px 0 8px;">아래 첨부 파일을 다운로드해 본문의 다음 위치에 넣으세요. 각 사진 아래에 출처를 함께 적어주세요.</p>
${markers}
        <p style="margin:12px 0 6px;font-weight:600;">사진 출처 (첨부 파일)</p>
        <ul style="margin:0;padding-left:18px;">
${credits}
        </ul>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;">사진은 Pexels 무료 스톡 이미지입니다. 상업적 이용이 가능하며 출처 표기는 의무는 아니지만 권장됩니다.</p>
      </div>`;
  }
}
