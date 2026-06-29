import { registerAs } from '@nestjs/config';
import * as path from 'path';

/**
 * Marketing automation config. Mirrors email.config.ts.
 *
 * - MARKETING_ENABLED: master switch. Defaults to FALSE so merging this feature
 *   does not start publishing/emailing before ops configures the paths/recipient.
 * - SELF_BLOG_ENABLED / NAVER_EMAIL_ENABLED: per-channel toggles. Both default
 *   to TRUE (only matter once the master switch is on). The self-blog channel
 *   requires a WRITABLE BLOG_PUBLIC_DIR reachable by the backend container; in
 *   the current infra the backend has no write mount to the nginx-served public
 *   dir, so SELF_BLOG_ENABLED=false is the safe setting until a shared volume is
 *   added — the Naver email draft then runs alone with zero infra change.
 * - BLOG_PUBLIC_DIR: writable directory the self-blog publisher writes into.
 *   Default resolves from the compiled backend (dist) to ../frontend/public/blog.
 *   On the VPS, set this to the nginx-served path (writable bind-mount).
 * - SITE_URL: canonical origin for blog URLs / sitemap entries.
 * - MARKETING_EMAIL_TO: recipient of the daily Naver draft (fallback SMTP_FROM).
 * - ADSENSE_CLIENT: AdSense publisher id injected into generated posts.
 */
export default registerAs('marketing', () => ({
  enabled: process.env.MARKETING_ENABLED === 'true',
  selfBlogEnabled: process.env.SELF_BLOG_ENABLED !== 'false',
  naverEmailEnabled: process.env.NAVER_EMAIL_ENABLED !== 'false',
  blogPublicDir:
    process.env.BLOG_PUBLIC_DIR ||
    path.resolve(__dirname, '../../../frontend/public/blog'),
  siteUrl: process.env.SITE_URL || 'https://mytravel-planner.com',
  emailTo: process.env.MARKETING_EMAIL_TO || process.env.SMTP_FROM || '',
  adsenseClient: process.env.ADSENSE_CLIENT || 'ca-pub-7330738950092177',
}));
