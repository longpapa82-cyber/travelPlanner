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
import { Repository, IsNull, MoreThan, Not } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Trip } from './trips/entities/trip.entity';
import { AppService } from './app.service';
import { isShuttingDown } from './common/lifecycle.service';

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

  @Get('sitemap.xml')
  async getSitemap(@Res() res: Response) {
    const baseUrl = process.env.FRONTEND_URL || 'https://travelplanner.app';
    const now = new Date().toISOString().split('T')[0];

    // Fetch public shared trips for dynamic sitemap entries (filter test data)
    const publicTrips = await this.tripRepo
      .createQueryBuilder('trip')
      .where('trip.isPublic = :isPublic', { isPublic: true })
      .andWhere('trip.shareToken IS NOT NULL')
      .andWhere('trip.shareExpiresAt > :now', { now: new Date() })
      .andWhere("trip.destination NOT LIKE :testKo", { testKo: '%테스트%' })
      .andWhere("trip.destination NOT LIKE :testEn", { testEn: '%test%' })
      .andWhere("trip.description NOT LIKE :descTest", { descTest: '%테스트%' })
      .select(['trip.shareToken', 'trip.updatedAt', 'trip.destination'])
      .take(1000)
      .getMany();

    const staticUrls = [
      // Main pages
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/about', changefreq: 'monthly', priority: '0.9' },
      { loc: '/contact', changefreq: 'monthly', priority: '0.9' },
      // Legal & info
      { loc: '/privacy', changefreq: 'monthly', priority: '0.7' },
      { loc: '/terms', changefreq: 'monthly', priority: '0.7' },
      { loc: '/faq', changefreq: 'monthly', priority: '0.8' },
      // Guides index
      { loc: '/guides', changefreq: 'weekly', priority: '0.9' },
      // Guides — Asia
      { loc: '/guides/tokyo', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/osaka', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/kyoto', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/seoul', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/bangkok', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/singapore', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/ho-chi-minh', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/kuala-lumpur', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/bali', changefreq: 'monthly', priority: '0.85' },
      // Guides — Europe
      { loc: '/guides/paris', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/london', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/barcelona', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/rome', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/prague', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/amsterdam', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/istanbul', changefreq: 'monthly', priority: '0.85' },
      // Guides — Americas/Oceania/Middle East
      { loc: '/guides/new-york', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/hawaii', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/sydney', changefreq: 'monthly', priority: '0.85' },
      { loc: '/guides/dubai', changefreq: 'monthly', priority: '0.85' },
      // Blog
      { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
      { loc: '/blog/ai-travel-planning-tips', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/packing-checklist', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/budget-travel-guide', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/first-solo-travel', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/travel-insurance-guide', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/japan-transport-pass-guide', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/europe-culture-differences', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/southeast-asia-rainy-season', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/smartphone-travel-photography', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/currency-exchange-guide', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/airport-time-saving-tips', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/travel-internet-guide', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/family-travel-planning', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/travel-journal-tips', changefreq: 'monthly', priority: '0.75' },
      { loc: '/blog/long-term-travel-guide', changefreq: 'monthly', priority: '0.75' },
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
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
    const baseUrl = process.env.FRONTEND_URL || 'https://travelplanner.app';

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
