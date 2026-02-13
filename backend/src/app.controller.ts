import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, Not } from 'typeorm';
import { Trip } from './trips/entities/trip.entity';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async getSitemap(): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'https://travelplanner.app';
    const now = new Date().toISOString().split('T')[0];

    // Fetch public shared trips for dynamic sitemap entries
    const publicTrips = await this.tripRepo.find({
      where: {
        isPublic: true,
        shareToken: Not(IsNull()),
        shareExpiresAt: MoreThan(new Date()),
      },
      select: ['shareToken', 'updatedAt', 'destination'],
      take: 1000,
    });

    const staticUrls = [
      { loc: '/', changefreq: 'daily', priority: '1.0' },
      { loc: '/login', changefreq: 'monthly', priority: '0.8' },
      { loc: '/register', changefreq: 'monthly', priority: '0.8' },
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

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${tripEntries}
</urlset>`;
  }

  /**
   * Returns an HTML page with dynamic OG meta tags for a shared trip.
   * Social media crawlers (Facebook, Twitter, Slack, KakaoTalk) hit this
   * endpoint via the nginx location rule for /trips/shared/:token.
   */
  @Get('trips/og/:token')
  async getSharedTripOg(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
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
      `${trip.destination} 여행 계획을 확인해보세요! TravelPlanner에서 AI가 만든 일정입니다.`;
    const ogImage = trip.coverImage || `${baseUrl}/assets/og-image.png`;
    const url = `${baseUrl}/trips/shared/${token}`;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | TravelPlanner</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:site_name" content="TravelPlanner" />
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
    provider: { '@type': 'Organization', name: 'TravelPlanner' },
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
