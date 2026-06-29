import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ContentResult } from './content.service';
import {
  renderBlogCard,
  renderBlogPostHtml,
  renderSitemapUrl,
} from './html.templates';

const INSERT_MARKER = '<!-- VIRAL_POSTS_INSERT -->';
const SITEMAP_CLOSE = '</urlset>';

export interface SelfBlogPublishResult {
  url: string;
  filePath: string;
  /** True when nothing changed because the slug already existed (idempotent). */
  skipped: boolean;
}

/**
 * Fully-automatic self-blog publishing.
 *
 * Writes three files, each idempotent (skip-if-present) and atomic (write to a
 * temp file then rename), so a retried or overlapping run can never corrupt the
 * shared index.html / sitemap.xml:
 *   1. {blogDir}/{slug}.html          — the post (never overwrites existing)
 *   2. {blogDir}/index.html           — new card spliced after the marker
 *   3. {sitemapPath}                  — new <url> spliced at the marker
 *
 * Paths come from marketing config (BLOG_PUBLIC_DIR) so the same code works
 * locally and on the VPS (env-driven path / writable bind-mount).
 */
@Injectable()
export class SelfBlogPublisher {
  private readonly logger = new Logger(SelfBlogPublisher.name);

  constructor(private readonly configService: ConfigService) {}

  private get blogDir(): string {
    return (
      this.configService.get<string>('marketing.blogPublicDir') ??
      path.resolve(__dirname, '../../../frontend/public/blog')
    );
  }

  private get sitemapPath(): string {
    // sitemap.xml lives one level up from the blog directory (frontend/public).
    return path.resolve(this.blogDir, '..', 'sitemap.xml');
  }

  private get siteUrl(): string {
    return (
      this.configService.get<string>('marketing.siteUrl') ??
      'https://mytravel-planner.com'
    );
  }

  private get adsenseClient(): string {
    return (
      this.configService.get<string>('marketing.adsenseClient') ??
      'ca-pub-7330738950092177'
    );
  }

  async publish(content: ContentResult): Promise<SelfBlogPublishResult> {
    const blogDir = this.blogDir;
    await fs.mkdir(blogDir, { recursive: true });

    const filePath = path.join(blogDir, `${content.slug}.html`);
    const url = `${this.siteUrl}/blog/${content.slug}`;

    const postWritten = await this.writePostHtml(filePath, content);
    const indexUpdated = await this.insertIndexCard(blogDir, content);
    const sitemapUpdated = await this.appendSitemapUrl(content.slug);

    const skipped = !postWritten && !indexUpdated && !sitemapUpdated;
    this.logger.log(
      `Self-blog publish ${content.slug}: post=${postWritten} ` +
        `index=${indexUpdated} sitemap=${sitemapUpdated}`,
    );

    return { url, filePath, skipped };
  }

  /** Write the post HTML. Returns false (skip) if the file already exists. */
  private async writePostHtml(
    filePath: string,
    content: ContentResult,
  ): Promise<boolean> {
    if (await this.fileExists(filePath)) {
      this.logger.warn(`Post already exists, skipping: ${filePath}`);
      return false;
    }
    const html = renderBlogPostHtml(content, {
      siteUrl: this.siteUrl,
      adsenseClient: this.adsenseClient,
    });
    await this.atomicWrite(filePath, html);
    return true;
  }

  /**
   * Splice the new card immediately after the marker so newest appears first.
   * Returns false if index.html is missing, the marker is absent, or the slug is
   * already linked (idempotent).
   */
  private async insertIndexCard(
    blogDir: string,
    content: ContentResult,
  ): Promise<boolean> {
    const indexPath = path.join(blogDir, 'index.html');
    if (!(await this.fileExists(indexPath))) {
      this.logger.warn(`index.html not found at ${indexPath}, skipping card`);
      return false;
    }
    const html = await fs.readFile(indexPath, 'utf8');

    if (html.includes(`href="/blog/${content.slug}"`)) {
      return false; // already present
    }
    const markerIndex = html.indexOf(INSERT_MARKER);
    if (markerIndex === -1) {
      this.logger.warn(
        `Marker ${INSERT_MARKER} not found in index.html, skipping card`,
      );
      return false;
    }

    const insertAt = markerIndex + INSERT_MARKER.length;
    const card = `\n${renderBlogCard(content)}`;
    const updated = html.slice(0, insertAt) + card + html.slice(insertAt);
    await this.atomicWrite(indexPath, updated);
    return true;
  }

  /**
   * Splice the new <url> at the marker (preferred) or fall back to before
   * </urlset>. Returns false if the sitemap is missing or the loc already exists.
   */
  private async appendSitemapUrl(slug: string): Promise<boolean> {
    const sitemapPath = this.sitemapPath;
    if (!(await this.fileExists(sitemapPath))) {
      this.logger.warn(
        `sitemap.xml not found at ${sitemapPath}, skipping sitemap update`,
      );
      return false;
    }
    const xml = await fs.readFile(sitemapPath, 'utf8');

    const loc = `${this.siteUrl}/blog/${slug}</loc>`;
    if (xml.includes(loc)) {
      return false; // already present
    }
    const entry = `\n${renderSitemapUrl(slug, { siteUrl: this.siteUrl })}`;

    let updated: string;
    const markerIndex = xml.indexOf(INSERT_MARKER);
    if (markerIndex !== -1) {
      const insertAt = markerIndex + INSERT_MARKER.length;
      updated = xml.slice(0, insertAt) + entry + xml.slice(insertAt);
    } else {
      const closeIndex = xml.lastIndexOf(SITEMAP_CLOSE);
      if (closeIndex === -1) {
        this.logger.warn(
          'Neither marker nor </urlset> found in sitemap.xml, skipping',
        );
        return false;
      }
      updated = xml.slice(0, closeIndex) + entry + '\n' + xml.slice(closeIndex);
    }
    await this.atomicWrite(sitemapPath, updated);
    return true;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Write to a temp file in the same dir then rename (atomic on same FS). */
  private async atomicWrite(filePath: string, data: string): Promise<void> {
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, data, 'utf8');
    try {
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
