import {
  Controller,
  Get,
  Inject,
  Param,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Trip } from './trips/entities/trip.entity';
import { AppService } from './app.service';
import { isShuttingDown } from './common/lifecycle.service';
import {
  BLOG_ENTRIES,
  GUIDE_ENTRIES,
  type ContentEntry,
  type ContentLang,
} from './marketing/blog-manifest';

/** Path for a content page URL. Korean is canonical (no lang suffix). */
function contentPath(section: string, slug: string, lang: ContentLang): string {
  const suffix = lang === 'ko' ? '' : `-${lang}`;
  return `/${section}/${slug}${suffix}`;
}

/**
 * Render one `<url>` block per language variant of a content entry, each with
 * reciprocal `<xhtml:link hreflang>` alternates so Google links the language
 * cluster. Korean doubles as `x-default`.
 */
function renderContentUrls(
  entry: ContentEntry,
  section: string,
  baseUrl: string,
  changefreq: string,
  priority: string,
  fallbackDate: string,
): string {
  const langs = Object.keys(entry.langs) as ContentLang[];
  const alternates = langs
    .map(
      (lang) =>
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}${contentPath(section, entry.slug, lang)}" />`,
    )
    .join('\n');
  const xDefault = entry.langs.ko
    ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${contentPath(section, entry.slug, 'ko')}" />`
    : '';

  return langs
    .map((lang) => {
      const lastmod = entry.langs[lang] || fallbackDate;
      return `  <url>
    <loc>${baseUrl}${contentPath(section, entry.slug, lang)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}${xDefault}
  </url>`;
    })
    .join('\n');
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(@Res() res: Response) {
    // During graceful shutdown, return 503 so Nginx/Docker stop routing traffic
    if (isShuttingDown) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'shutting_down',
        timestamp: new Date().toISOString(),
      });
    }

    const checks: Record<string, 'up' | 'down'> = {};

    // Database check
    try {
      await this.tripRepo.query('SELECT 1');
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    // Cache check
    try {
      await this.cacheManager.set('health:ping', '1', 5000);
      await this.cacheManager.get('health:ping');
      checks.cache = 'up';
    } catch {
      checks.cache = 'down';
    }

    const allUp = Object.values(checks).every((v) => v === 'up');

    return res.status(HttpStatus.OK).json({
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  }

  /**
   * V115 (V114-9): Version contract for zero-downtime rollout.
   *
   * Apps hit this on launch to decide whether to allow, nag, or block usage.
   * `minAppVersionCode` is the floor below which the client is considered
   * incompatible with the current backend contract — the app shows a blocking
   * "update required" modal. `recommendedAppVersionCode` drives a dismissable
   * nag toast for soft rollouts.
   *
   * Values are intentionally hardcoded here (not env-driven) so a redeploy
   * is the only way to raise the floor — prevents accidental lockouts from
   * a stray env change.
   */
  @Get('version')
  getVersion() {
    return {
      apiVersion: '1.0.0',
      minAppVersionCode: 100,
      recommendedAppVersionCode: 115,
      releaseNotesUrl: 'https://mytravel-planner.com/release-notes',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sitemap.xml')
  async getSitemap(@Res() res: Response) {
    const baseUrl = process.env.FRONTEND_URL || 'https://mytravel-planner.com';
    const now = new Date().toISOString().split('T')[0];

    // Fetch public shared trips for dynamic sitemap entries (filter test data)
    const publicTrips = await this.tripRepo
      .createQueryBuilder('trip')
      .where('trip.isPublic = :isPublic', { isPublic: true })
      .andWhere('trip.shareToken IS NOT NULL')
      .andWhere('trip.shareExpiresAt > :now', { now: new Date() })
      .andWhere('trip.destination NOT LIKE :testKo', { testKo: '%테스트%' })
      .andWhere('trip.destination NOT LIKE :testEn', { testEn: '%test%' })
      .andWhere('trip.description NOT LIKE :descTest', { descTest: '%테스트%' })
      .select(['trip.shareToken', 'trip.updatedAt', 'trip.destination'])
      .take(1000)
      .getMany();

    // Main pages + section indexes. Individual blog posts and destination
    // guides are generated from the file-scanned manifest below, so adding a
    // page never requires editing this controller.
    const staticUrls = [
      // Main pages
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/about', changefreq: 'monthly', priority: '0.9' },
      { loc: '/contact', changefreq: 'monthly', priority: '0.9' },
      // Legal & info
      { loc: '/privacy', changefreq: 'monthly', priority: '0.7' },
      { loc: '/terms', changefreq: 'monthly', priority: '0.7' },
      { loc: '/faq', changefreq: 'monthly', priority: '0.8' },
      // Section indexes
      { loc: '/guides', changefreq: 'weekly', priority: '0.9' },
      { loc: '/guides/index-en', changefreq: 'weekly', priority: '0.9' },
      { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
    ];

    const staticEntries = staticUrls
      .map(
        (u) => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
      )
      .join('\n');

    // Blog posts + destination guides with reciprocal hreflang alternates,
    // driven entirely by the auto-generated manifest.
    const blogEntries = BLOG_ENTRIES.map((e) =>
      renderContentUrls(e, 'blog', baseUrl, 'monthly', '0.75', now),
    ).join('\n');

    const guideEntries = GUIDE_ENTRIES.map((e) =>
      renderContentUrls(e, 'guides', baseUrl, 'monthly', '0.85', now),
    ).join('\n');

    const tripEntries = publicTrips
      .map(
        (t) => `  <url>
    <loc>${baseUrl}/trips/shared/${t.shareToken}</loc>
    <lastmod>${(t.updatedAt ?? new Date()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticEntries}
${blogEntries}
${guideEntries}
${tripEntries}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }

  /**
   * Returns an HTML page with dynamic OG meta tags for a shared trip.
   * Social media crawlers (Facebook, Twitter, Slack, KakaoTalk) hit this
   * endpoint via the nginx location rule for /trips/shared/:token.
   */
  @Get('trips/og/:token')
  async getSharedTripOg(@Param('token') token: string, @Res() res: Response) {
    const baseUrl = process.env.FRONTEND_URL || 'https://mytravel-planner.com';

    const trip = await this.tripRepo.findOne({
      where: { shareToken: token },
      relations: ['itineraries'],
    });

    if (!trip || !trip.isPublic) {
      return res.redirect(302, baseUrl);
    }

    // Check expiration
    if (trip.shareExpiresAt && trip.shareExpiresAt < new Date()) {
      return res.redirect(302, baseUrl);
    }

    const days = trip.itineraries?.length || 0;
    const title = `${trip.destination} ${days > 0 ? `${days}일` : ''} 여행 계획`;
    const description =
      trip.description ||
      `${trip.destination} 여행 계획을 확인해보세요! MyTravel에서 AI가 만든 일정입니다.`;
    const ogImage = trip.coverImage || `${baseUrl}/assets/og-image.png`;
    const url = `${baseUrl}/trips/shared/${token}`;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | MyTravel</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:site_name" content="MyTravel" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:locale:alternate" content="ja_JP" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta name="theme-color" content="#3B82F6" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TravelAction',
    name: title,
    description,
    url,
    image: ogImage,
    provider: { '@type': 'Organization', name: 'MyTravel' },
  }).replace(/</g, '\\u003c')}</script>
  <script>window.location.replace("${url}");</script>
</head>
<body>
  <p>Redirecting to <a href="${url}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
