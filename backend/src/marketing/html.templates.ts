import type { ContentResult } from './content.service';
import type { MarketingImage } from './image.types';

/**
 * Pure string builders + escaping for the self-blog publisher. Kept separate so
 * self-blog.publisher.ts stays small and the SEO markup is reviewable in one
 * place. The head/JSON-LD/card structure mirrors the existing hand-written posts
 * (e.g. ai-travel-planning-tips.html) so auto-posts are visually consistent.
 */

const SITE_URL_DEFAULT = 'https://mytravel-planner.com';
const ADSENSE_CLIENT_DEFAULT = 'ca-pub-7330738950092177';

/** Minimal, correct HTML attribute/text escaping. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape what JSON string values need inside a <script type="ld+json">. Backslash
 * and quote are escaped first, then `<` is encoded so the block can't be closed
 * early, and finally ALL control characters (U+0000–U+001F: tab, backspace,
 * form-feed, newline, carriage return, etc.) are encoded as \uXXXX so model text
 * with a stray control char can never produce invalid JSON-LD.
 */
const CONTROL_CHAR_MAX = 0x1f;

function escapeJsonString(input: string): string {
  const pre = input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003c');

  // Encode any remaining C0 control char (U+0000–U+001F: tab, newline, etc.) as
  // \uXXXX so a stray control char in model output can never break the JSON-LD.
  // Done by codepoint scan (no regex) to avoid a no-control-regex lint conflict
  // while still covering the full control range.
  let out = '';
  for (const ch of pre) {
    const code = ch.charCodeAt(0);
    out +=
      code <= CONTROL_CHAR_MAX
        ? '\\u' + code.toString(16).padStart(4, '0')
        : ch;
  }
  return out;
}

function formatDateLabel(isoDate: string): string {
  // isoDate is YYYY-MM-DD → 2026.06.29
  return isoDate.replace(/-/g, '.');
}

const PEXELS_URL = 'https://www.pexels.com';

/**
 * Render one Pexels photo as a captioned <figure>. Every dynamic value (src URL,
 * alt, photographer, photographer URL) is escaped for attribute/text context.
 * The photographer link is only emitted when photographerUrl validated to an
 * http(s) URL upstream; otherwise the name renders as plain text. Pexels asks
 * crediting photographers when possible → caption: "Photo by X on Pexels".
 *
 * @param image  the photo descriptor
 * @param eager  first image may load eagerly (LCP); rest lazy
 */
export function renderImageFigure(
  image: MarketingImage,
  eager = false,
): string {
  const src = escapeHtml(image.srcUrl);
  const alt = escapeHtml(image.alt);
  const photographer = escapeHtml(image.photographer);
  const dims =
    image.width > 0 && image.height > 0
      ? ` width="${image.width}" height="${image.height}"`
      : '';
  const loading = eager
    ? ' loading="eager" fetchpriority="high"'
    : ' loading="lazy"';

  const credit = image.photographerUrl.startsWith('http')
    ? `Photo by <a href="${escapeHtml(image.photographerUrl)}" rel="nofollow noopener" target="_blank">${photographer}</a> on <a href="${PEXELS_URL}" rel="nofollow noopener" target="_blank">Pexels</a>`
    : `Photo by ${photographer} on <a href="${PEXELS_URL}" rel="nofollow noopener" target="_blank">Pexels</a>`;

  return `  <figure class="post-figure">
    <img src="${src}" alt="${alt}"${dims}${loading} />
    <figcaption>${credit}</figcaption>
  </figure>`;
}

interface RenderOptions {
  siteUrl?: string;
  adsenseClient?: string;
  /** Optional Pexels photos embedded into the post (first near top, rest stacked). */
  images?: readonly MarketingImage[];
}

export function renderBlogPostHtml(
  content: ContentResult,
  options: RenderOptions = {},
): string {
  const siteUrl = options.siteUrl ?? SITE_URL_DEFAULT;
  const adsenseClient = options.adsenseClient ?? ADSENSE_CLIENT_DEFAULT;
  const canonical = `${siteUrl}/blog/${content.slug}`;

  const title = escapeHtml(content.title);
  const metaDesc = escapeHtml(content.metaDescription);
  const dateLabel = formatDateLabel(content.datePublished);
  // content.bodyHtml already has every heading/paragraph escaped by the content
  // service (only structural <h2>/<p> tags are raw), so it is inserted as-is.
  const body = content.bodyHtml;

  // Image placement is deterministic (no fragile section parsing): the first
  // figure sits at the top of the body (eager/LCP), the remaining figures are
  // stacked immediately after it. escapeHtml is applied inside renderImageFigure.
  const images = options.images ?? [];
  const leadFigure =
    images.length > 0 ? renderImageFigure(images[0], true) : '';
  const stackedFigures = images
    .slice(1)
    .map((img) => renderImageFigure(img, false))
    .join('\n');
  const figureBlock = [leadFigure, stackedFigures]
    .filter((part) => part !== '')
    .join('\n');

  const jsonLd = {
    title: escapeJsonString(content.title),
    description: escapeJsonString(content.metaDescription),
    url: escapeJsonString(canonical),
    date: content.datePublished,
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <link rel="icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192-v2.png" />
  <meta name="theme-color" content="#4A90D9" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - myTravel 블로그</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="myTravel" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="article:published_time" content="${content.datePublished}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${metaDesc}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}" crossorigin="anonymous"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${jsonLd.title}",
    "description": "${jsonLd.description}",
    "url": "${jsonLd.url}",
    "datePublished": "${jsonLd.date}",
    "dateModified": "${jsonLd.date}",
    "author": {
      "@type": "Organization",
      "name": "myTravel"
    },
    "publisher": {
      "@type": "Organization",
      "name": "myTravel",
      "url": "${siteUrl}"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${jsonLd.url}"
    },
    "inLanguage": "ko"
  }
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a202c; line-height: 1.7; background: #fff; }
    a { color: inherit; text-decoration: none; }
    .header { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid #e2e8f0; }
    .header-inner { max-width: 1200px; margin: 0 auto; padding: 0.75rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 1.25rem; font-weight: 700; color: #4A90D9; }
    .nav { display: flex; gap: 1.5rem; align-items: center; font-size: 0.9rem; }
    .nav a { color: #475569; transition: color 0.2s; }
    .nav a:hover { color: #4A90D9; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.5rem 1.25rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
    .btn-primary { background: #4A90D9; color: #fff; }
    .btn-primary:hover { background: #3a7bc8; }
    .nav a.btn-primary { color: #fff; }
    .breadcrumb { max-width: 800px; margin: 0 auto; padding: 1rem 1.5rem; font-size: 0.85rem; color: #64748b; }
    .breadcrumb a { color: #4A90D9; }
    .breadcrumb a:hover { text-decoration: underline; }
    .content { max-width: 800px; margin: 0 auto; padding: 0 1.5rem 3rem; }
    .content .article-header { margin-bottom: 2rem; }
    .content .article-header h1 { font-size: 1.75rem; font-weight: 700; color: #1e293b; line-height: 1.4; margin-bottom: 0.75rem; }
    .content .article-meta { font-size: 0.85rem; color: #94a3b8; }
    .content h2 { font-size: 1.3rem; font-weight: 700; color: #1e293b; margin: 2.5rem 0 1rem; padding-left: 1rem; border-left: 4px solid #4A90D9; }
    .content h3 { font-size: 1.1rem; font-weight: 600; color: #334155; margin: 1.5rem 0 0.75rem; }
    .content p { color: #374151; margin-bottom: 1rem; font-size: 1rem; }
    .content ul, .content ol { margin: 1rem 0 1rem 1.5rem; color: #374151; }
    .content li { margin-bottom: 0.5rem; }
    .content strong { color: #1e293b; }
    .post-figure { margin: 1.5rem 0; }
    .post-figure img { display: block; width: 100%; height: auto; border-radius: 0.75rem; }
    .post-figure figcaption { margin-top: 0.5rem; font-size: 0.8rem; color: #94a3b8; text-align: center; }
    .post-figure figcaption a { color: #4A90D9; }
    .post-figure figcaption a:hover { text-decoration: underline; }
    .ad-section { text-align: center; margin: 2rem 0; }
    .cta-box { background: linear-gradient(135deg, #4A90D9, #3a7bc8); color: #fff; border-radius: 1rem; padding: 2rem; text-align: center; margin: 2.5rem 0; }
    .cta-box h3 { color: #fff; font-size: 1.2rem; margin-bottom: 0.75rem; }
    .cta-box p { color: rgba(255,255,255,0.9); margin-bottom: 1.25rem; }
    .cta-box .btn-cta { background: #fff; color: #4A90D9; padding: 0.75rem 2rem; border-radius: 0.5rem; font-weight: 700; font-size: 1rem; display: inline-block; transition: all 0.2s; }
    .cta-box .btn-cta:hover { background: #f0f9ff; transform: translateY(-2px); }
    .footer { background: #0f1e3c; color: #94a3b8; padding: 3rem 1.5rem 2rem; }
    .footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
    .footer-brand-name { font-size: 1.2rem; font-weight: 700; color: #4A90D9; margin-bottom: 0.75rem; }
    .footer h4 { color: #e2e8f0; font-weight: 600; margin-bottom: 0.75rem; }
    .footer a { display: block; color: #94a3b8; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .footer a:hover { color: #fff; }
    .footer-bottom { max-width: 1200px; margin: 2rem auto 0; padding-top: 1.5rem; border-top: 1px solid #1e3460; text-align: center; font-size: 0.85rem; }
    @media (max-width: 768px) {
      .nav { display: none; }
      .content .article-header h1 { font-size: 1.35rem; }
      .content h2 { font-size: 1.15rem; }
    }
  </style>
</head>
<body>

<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">myTravel</a>
    <nav class="nav">
      <a href="/">홈</a>
      <a href="/about">소개</a>
      <a href="/guides/">가이드</a>
      <a href="/blog" style="color:#4A90D9;font-weight:600;">블로그</a>
      <a href="/contact">문의</a>
      <a href="/trips/create" class="btn btn-primary">로그인</a>
    </nav>
  </div>
</header>

<div class="breadcrumb">
  <a href="/">홈</a> &gt; <a href="/blog">블로그</a> &gt; <strong>${title}</strong>
</div>

<article class="content">
  <div class="article-header">
    <h1>${title}</h1>
    <p class="article-meta">${dateLabel} | myTravel 사용자 후기</p>
  </div>
${figureBlock ? `\n${figureBlock}\n` : ''}
${body}

  <div class="ad-section">
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="${adsenseClient}"
         data-ad-slot="2397004834"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>

  <div class="cta-box">
    <h3>나도 myTravel로 여행 계획 세워보기</h3>
    <p>목적지만 선택하면 AI가 맞춤 일정을 만들어줍니다. 무료로 시작해 보세요.</p>
    <a href="/trips/create" class="btn-cta">여행 계획 시작하기</a>
  </div>
</article>

<footer class="footer">
  <div class="footer-inner">
    <div>
      <div class="footer-brand-name">myTravel</div>
      <p style="font-size:0.9rem;">AI 기반 여행 계획 서비스.<br/>목적지만 선택하면 맞춤 일정이 완성됩니다.</p>
    </div>
    <div>
      <h4>서비스</h4>
      <a href="https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner">앱 다운로드 (Android)</a>
      <a href="https://apps.apple.com/app/id6766147060">앱 다운로드 (iOS)</a>
      <a href="/guides/">여행 가이드</a>
      <a href="/blog">블로그</a>
      <a href="/about">서비스 소개</a>
      <a href="/contact">문의하기</a>
    </div>
    <div>
      <h4>정책</h4>
      <a href="/terms">이용약관</a>
      <a href="/privacy">개인정보처리방침</a>
      <a href="/faq">FAQ</a>
      <p style="margin-top:1rem;font-size:0.85rem;">📧 <a href="mailto:longpapa82@gmail.com" style="display:inline;">longpapa82@gmail.com</a></p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 AI Soft. All rights reserved.</p>
  </div>
</footer>

</body>
</html>
`;
}

/**
 * Render the blog index card injected after the VIRAL_POSTS_INSERT marker.
 * Mirrors the existing .blog-card structure (card-icon svg, h2, card-excerpt,
 * card-meta → card-date + card-link).
 */
export function renderBlogCard(content: ContentResult): string {
  const dateLabel = formatDateLabel(content.datePublished);
  const slug = escapeHtml(content.slug);
  const title = escapeHtml(content.title);
  const excerpt = escapeHtml(content.excerpt);
  // iconSvg is internally produced (not user input) but kept inline as-is.
  return `  <a href="/blog/${slug}" class="blog-card">
    <div class="card-icon">${content.iconSvg}</div>
    <h2>${title}</h2>
    <p class="card-excerpt">${excerpt}</p>
    <div class="card-meta">
      <span class="card-date">${escapeHtml(dateLabel)}</span>
      <span class="card-link">읽어보기 &rarr;</span>
    </div>
  </a>`;
}

/** Render the sitemap <url> entry inserted at the marker before </urlset>. */
export function renderSitemapUrl(
  slug: string,
  options: RenderOptions = {},
): string {
  const siteUrl = options.siteUrl ?? SITE_URL_DEFAULT;
  const safeSlug = escapeHtml(slug);
  return `  <url><loc>${siteUrl}/blog/${safeSlug}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
}
