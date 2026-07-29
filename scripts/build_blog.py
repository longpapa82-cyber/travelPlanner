#!/usr/bin/env python3
"""build_blog.py — deterministic blog HTML + index + sitemap generator.

Anti-drift strategy: generation agents produce ONLY structured article
content (JSON). This script wraps that content in ONE frozen template so
header / footer / CSS / JSON-LD / hreflang / AdSense are byte-identical
across every article and cannot drift.

Inputs:
  claudedocs/blog-content/<slug>.<lang>.json   (one per article, per lang)
    schema: {
      "slug": "...", "lang": "ko|en|ja",
      "title": "...", "metaTitle": "...", "description": "...",
      "ogDescription": "...", "publishedDate": "2026-07-10",
      "category": "...",
      "sections": [ { "h2": "...", "html": "<p>...</p>..." }, ... ],
      "adAfterSection": 3,           # insert AdSense after Nth section
      "related": [ {"href": "/blog/...", "text": "..."} ],
      "alternates": { "ko": "/blog/slug", "en": "/blog/slug-en", "ja": "/blog/slug-ja" }
    }

Outputs:
  frontend/public/blog/<slug>[-en|-ja].html   (articles)
  frontend/public/blog/index.html             (KO index, regenerated)
  frontend/public/sitemap.xml                 (blog section regenerated)

Usage:
  python3 scripts/build_blog.py articles     # render all article JSONs
  python3 scripts/build_blog.py index        # regenerate KO index
  python3 scripts/build_blog.py sitemap      # regenerate sitemap blog block
  python3 scripts/build_blog.py all          # all of the above
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / 'claudedocs' / 'blog-content'
BLOG_DIR = ROOT / 'frontend' / 'public' / 'blog'
SITEMAP = ROOT / 'frontend' / 'public' / 'sitemap.xml'
TOPICS = ROOT / 'claudedocs' / 'blog-topics.json'
BASE_URL = 'https://mytravel-planner.com'
AD_CLIENT = 'ca-pub-7330738950092177'
AD_SLOT = '2397004834'

# ── i18n chrome strings ──────────────────────────────────────────────
STRINGS = {
    'ko': {
        'siteTitle': 'myTravel 블로그', 'home': '홈', 'about': '소개',
        'guides': '가이드', 'blog': '블로그', 'contact': '문의', 'login': '로그인',
        'blogCrumb': '블로그', 'relatedTitle': '관련 글',
        'ctaTitle': 'AI로 나만의 여행 일정을 만들어 보세요',
        'ctaBody': '목적지만 선택하면 AI가 최적의 여행 계획을 자동으로 생성합니다. 무료로 시작하세요!',
        'ctaBtn': '여행 계획 시작하기', 'author': 'myTravel 팀',
        'brandDesc': 'AI 기반 여행 계획 서비스.<br/>목적지만 선택하면 맞춤 일정이 완성됩니다.',
        'svcHead': '서비스', 'appAndroid': '앱 다운로드 (Android)', 'appIos': '앱 다운로드 (iOS)',
        'guidesLink': '여행 가이드', 'aboutLink': '서비스 소개', 'contactLink': '문의하기',
        'policyHead': '정책', 'terms': '이용약관', 'privacy': '개인정보처리방침', 'faq': 'FAQ',
        'locale': 'ko_KR', 'htmlLang': 'ko',
    },
    'en': {
        'siteTitle': 'myTravel Blog', 'home': 'Home', 'about': 'About',
        'guides': 'Guides', 'blog': 'Blog', 'contact': 'Contact', 'login': 'Log in',
        'blogCrumb': 'Blog', 'relatedTitle': 'Related articles',
        'ctaTitle': 'Create your own trip itinerary with AI',
        'ctaBody': 'Just pick a destination and AI generates an optimized travel plan. Start for free!',
        'ctaBtn': 'Start planning', 'author': 'myTravel Team',
        'brandDesc': 'AI-powered travel planning.<br/>Pick a destination and get a tailored itinerary.',
        'svcHead': 'Service', 'appAndroid': 'Download (Android)', 'appIos': 'Download (iOS)',
        'guidesLink': 'Travel Guides', 'aboutLink': 'About', 'contactLink': 'Contact',
        'policyHead': 'Policy', 'terms': 'Terms', 'privacy': 'Privacy Policy', 'faq': 'FAQ',
        'locale': 'en_US', 'htmlLang': 'en',
    },
    'ja': {
        'siteTitle': 'myTravel ブログ', 'home': 'ホーム', 'about': '紹介',
        'guides': 'ガイド', 'blog': 'ブログ', 'contact': 'お問い合わせ', 'login': 'ログイン',
        'blogCrumb': 'ブログ', 'relatedTitle': '関連記事',
        'ctaTitle': 'AIであなただけの旅行プランを作りましょう',
        'ctaBody': '目的地を選ぶだけで、AIが最適な旅行プランを自動生成します。無料で始めましょう！',
        'ctaBtn': '旅行プランを作成', 'author': 'myTravel チーム',
        'brandDesc': 'AIによる旅行プランニング。<br/>目的地を選ぶだけでオーダーメイドの日程が完成します。',
        'svcHead': 'サービス', 'appAndroid': 'アプリDL (Android)', 'appIos': 'アプリDL (iOS)',
        'guidesLink': '旅行ガイド', 'aboutLink': 'サービス紹介', 'contactLink': 'お問い合わせ',
        'policyHead': 'ポリシー', 'terms': '利用規約', 'privacy': 'プライバシーポリシー', 'faq': 'FAQ',
        'locale': 'ja_JP', 'htmlLang': 'ja',
    },
}

LANG_BADGES = (
    '<span class="lang-badge">🇰🇷 한국어</span><span class="lang-badge">🇺🇸 English</span>'
    '<span class="lang-badge">🇯🇵 日本語</span><span class="lang-badge">🇨🇳 中文</span>'
    '<span class="lang-badge">🇪🇸 Español</span><span class="lang-badge">🇩🇪 Deutsch</span>'
    '<span class="lang-badge">🇫🇷 Français</span><span class="lang-badge">🇹🇭 ไทย</span>'
    '<span class="lang-badge">🇻🇳 Tiếng Việt</span><span class="lang-badge">🇧🇷 Português</span>'
    '<span class="lang-badge">🇸🇦 العربية</span><span class="lang-badge">🇮🇩 Bahasa</span>'
    '<span class="lang-badge">🇮🇳 हिन्दी</span><span class="lang-badge">🇮🇹 Italiano</span>'
    '<span class="lang-badge">🇷🇺 Русский</span><span class="lang-badge">🇹🇷 Türkçe</span>'
    '<span class="lang-badge">🇲🇾 Melayu</span>'
)

STYLE = """*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
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
    .content .tip-box { background: rgba(74,144,217,0.1); border: 1px solid #bfdbfe; border-radius: 0.75rem; padding: 1.25rem 1.5rem; margin: 1.5rem 0; }
    .content .tip-box strong { color: #4A90D9; }
    .content .highlight-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 0.75rem; padding: 1.25rem 1.5rem; margin: 1.5rem 0; }
    .content .highlight-box strong { color: #b45309; }
    .content .warning-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.75rem; padding: 1.25rem 1.5rem; margin: 1.5rem 0; }
    .content .warning-box strong { color: #dc2626; }
    .content .checklist { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.25rem 1.5rem; margin: 1rem 0; }
    .content .checklist li { list-style: none; padding-left: 1.5rem; position: relative; }
    .content .checklist li::before { content: "\2610"; position: absolute; left: 0; color: #4A90D9; }
    .content .compare-table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.95rem; }
    .content .compare-table th { background: #f1f5f9; padding: 0.75rem 1rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    .content .compare-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }
    .content .compare-table tr:hover { background: #f8fafc; }
    .ad-section { text-align: center; margin: 2rem 0; }
    .cta-box { background: linear-gradient(135deg, #4A90D9, #3a7bc8); color: #fff; border-radius: 1rem; padding: 2rem; text-align: center; margin: 2.5rem 0; }
    .cta-box h3 { color: #fff; font-size: 1.2rem; margin-bottom: 0.75rem; }
    .cta-box p { color: rgba(255,255,255,0.9); margin-bottom: 1.25rem; }
    .cta-box .btn-cta { background: #fff; color: #4A90D9; padding: 0.75rem 2rem; border-radius: 0.5rem; font-weight: 700; font-size: 1rem; display: inline-block; transition: all 0.2s; }
    .cta-box .btn-cta:hover { background: #f0f9ff; transform: translateY(-2px); }
    .related { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; }
    .related h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; border-left: none; padding-left: 0; }
    .related-links { display: flex; flex-direction: column; gap: 0.75rem; }
    .related-links a { color: #4A90D9; font-weight: 500; }
    .related-links a:hover { text-decoration: underline; }
    .footer { background: #0f1e3c; color: #94a3b8; padding: 3rem 1.5rem 2rem; }
    .footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
    .footer-brand-name { font-size: 1.2rem; font-weight: 700; color: #4A90D9; margin-bottom: 0.75rem; }
    .footer h4 { color: #e2e8f0; font-weight: 600; margin-bottom: 0.75rem; }
    .footer a { display: block; color: #94a3b8; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .footer a:hover { color: #fff; }
    .footer-bottom { max-width: 1200px; margin: 2rem auto 0; padding-top: 1.5rem; border-top: 1px solid #1e3460; text-align: center; font-size: 0.85rem; }
    .langs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .lang-badge { background: #334155; padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.75rem; }
    .hero { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem 1rem; text-align: center; }
    .hero h1 { font-size: 2rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; }
    .hero p { color: #64748b; font-size: 1.05rem; }
    .blog-intro { max-width: 800px; margin: 0 auto; padding: 0 1.5rem 2rem; }
    .blog-intro p { color: #475569; margin-bottom: 1rem; font-size: 1rem; }
    .blog-grid { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem 1.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.5rem; }
    .blog-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2rem; transition: all 0.3s; display: flex; flex-direction: column; }
    .blog-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); border-color: #4A90D9; }
    .blog-card .card-icon { width: 3rem; height: 3rem; background: rgba(74,144,217,0.1); border-radius: 0.875rem; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; flex-shrink: 0; }
    .blog-card .card-icon svg { width: 1.5rem; height: 1.5rem; color: #4A90D9; }
    .blog-card h2 { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin-bottom: 0.75rem; line-height: 1.4; }
    .blog-card .card-excerpt { color: #475569; font-size: 0.92rem; flex: 1; margin-bottom: 1rem; line-height: 1.6; }
    .blog-card .card-meta { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; }
    .blog-card .card-date { color: #94a3b8; }
    .blog-card .card-link { color: #4A90D9; font-weight: 600; }
    .cat-head { max-width: 1200px; margin: 1.5rem auto 0; padding: 0 1.5rem; font-size: 1.2rem; font-weight: 700; color: #1e293b; border-left: 4px solid #4A90D9; padding-left: 0.75rem; }
    .cta-section { background: linear-gradient(135deg, #4A90D9, #3a7bc8); color: #fff; padding: 3rem 1.5rem; text-align: center; margin-top: 2rem; }
    .cta-section h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; }
    .cta-section p { font-size: 1rem; opacity: 0.9; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto; }
    .cta-section .btn-cta { background: #fff; color: #4A90D9; padding: 0.75rem 2rem; border-radius: 0.5rem; font-weight: 700; font-size: 1rem; transition: all 0.2s; display: inline-block; }
    @media (max-width: 768px) {
      .nav { display: none; }
      .content .article-header h1 { font-size: 1.35rem; }
      .content h2 { font-size: 1.15rem; }
      .hero h1 { font-size: 1.5rem; }
      .blog-grid { grid-template-columns: 1fr; }
    }"""

# SVG icon set (stroke-based, matches existing index cards)
ICONS = {
    'doc': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'bag': '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    'wifi': '<path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M8.5 16.11a6 6 0 0 1 7 0"/><line x1="12" y1="20" x2="12" y2="20"/>',
    'plane': '<path d="M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-.9 1.7L9 11l-2 3-3-1-1 1 4 2 2 4 1-1-1-3 3-2 3.1 5.1a1 1 0 0 0 1.7-.9z"/>',
    'coin': '<circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-4-6h8m-2-2a2 2 0 0 0-2-2h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-2-2"/>',
    'home': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'laptop': '<rect x="3" y="4" width="18" height="12" rx="1"/><line x1="2" y1="20" x2="22" y2="20"/>',
    'heart': '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    'sparkle': '<path d="M12 2l2.4 7.2L21 12l-6.6 2.8L12 22l-2.4-7.2L3 12l6.6-2.8z"/>',
    'map': '<polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'phone': '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/>',
    'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
}


def icon_svg(name: str) -> str:
    path = ICONS.get(name, ICONS['map'])
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{path}</svg>')


def head_common(s: dict) -> str:
    return f"""  <link rel="icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icon-192-v2.png" />
  <meta name="theme-color" content="#4A90D9" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />"""


def alternates_links(alts: dict, self_lang: str) -> str:
    out = []
    for lang, path in alts.items():
        out.append(f'  <link rel="alternate" hreflang="{lang}" href="{BASE_URL}{path}" />')
    # x-default → KO
    if 'ko' in alts:
        out.append(f'  <link rel="alternate" hreflang="x-default" href="{BASE_URL}{alts["ko"]}" />')
    return '\n'.join(out)


def footer_html(s: dict) -> str:
    return f"""<footer class="footer">
  <div class="footer-inner">
    <div>
      <div class="footer-brand-name">myTravel</div>
      <p style="font-size:0.9rem;">{s['brandDesc']}</p>
      <div class="langs" style="margin-top:1rem;">{LANG_BADGES}</div>
    </div>
    <div>
      <h4>{s['svcHead']}</h4>
      <a href="https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner">{s['appAndroid']}</a>
      <a href="https://apps.apple.com/app/id6766147060">{s['appIos']}</a>
      <a href="/guides/">{s['guidesLink']}</a>
      <a href="/blog">{s['blog']}</a>
      <a href="/about">{s['aboutLink']}</a>
      <a href="/contact">{s['contactLink']}</a>
    </div>
    <div>
      <h4>{s['policyHead']}</h4>
      <a href="/terms">{s['terms']}</a>
      <a href="/privacy">{s['privacy']}</a>
      <a href="/faq">{s['faq']}</a>
      <p style="margin-top:1rem;font-size:0.85rem;">📧 <a href="mailto:longpapa82@gmail.com" style="display:inline;">longpapa82@gmail.com</a></p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 AI Soft. All rights reserved.</p>
  </div>
</footer>"""


def nav_html(s: dict, active: str = 'blog') -> str:
    blog_style = ' style="color:#4A90D9;font-weight:600;"' if active == 'blog' else ''
    return f"""<header class="header">
  <div class="header-inner">
    <a href="/" class="logo">myTravel</a>
    <nav class="nav">
      <a href="/">{s['home']}</a>
      <a href="/about">{s['about']}</a>
      <a href="/guides/">{s['guides']}</a>
      <a href="/blog"{blog_style}>{s['blog']}</a>
      <a href="/contact">{s['contact']}</a>
      <a href="/login" class="btn btn-primary">{s['login']}</a>
    </nav>
  </div>
</header>"""


def ad_block() -> str:
    return f"""  <div class="ad-section">
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="{AD_CLIENT}"
         data-ad-slot="{AD_SLOT}"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
  </div>"""


def render_article(data: dict) -> str:
    lang = data['lang']
    s = STRINGS[lang]
    url = f"{BASE_URL}{data['alternates'][lang]}"
    sections_html = []
    ad_after = data.get('adAfterSection', 3)
    for i, sec in enumerate(data['sections'], start=1):
        sections_html.append(f'  <h2>{sec["h2"]}</h2>\n{sec["html"]}')
        if i == ad_after:
            sections_html.append(ad_block())
    body = '\n\n'.join(sections_html)
    intro = data.get('intro', '')
    intro_html = f'\n{intro}\n' if intro else ''
    related = '\n'.join(
        f'      <a href="{r["href"]}">{r["text"]}</a>' for r in data.get('related', [])
    )
    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": data['title'], "description": data['ogDescription'],
        "url": url, "datePublished": data['publishedDate'],
        "dateModified": data['publishedDate'],
        "author": {"@type": "Organization", "name": "myTravel"},
        "publisher": {"@type": "Organization", "name": "myTravel", "url": BASE_URL},
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "inLanguage": lang,
    }, ensure_ascii=False, indent=2)

    return f"""<!DOCTYPE html>
<html lang="{s['htmlLang']}">
<head>
{head_common(s)}
  <title>{data['metaTitle']}</title>
  <meta name="description" content="{data['description']}" />
  <link rel="canonical" href="{url}" />
{alternates_links(data['alternates'], lang)}
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{data['title']}" />
  <meta property="og:description" content="{data['ogDescription']}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:site_name" content="myTravel" />
  <meta property="og:locale" content="{s['locale']}" />
  <meta property="article:published_time" content="{data['publishedDate']}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{data['title']}" />
  <meta name="twitter:description" content="{data['ogDescription']}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={AD_CLIENT}" crossorigin="anonymous"></script>
  <script type="application/ld+json">
{jsonld}
  </script>
  <style>
    {STYLE}
  </style>
</head>
<body>

{nav_html(s)}

<div class="breadcrumb">
  <a href="/">{s['home']}</a> &gt; <a href="/blog">{s['blogCrumb']}</a> &gt; <strong>{data['title']}</strong>
</div>

<article class="content">
  <div class="article-header">
    <h1>{data['title']}</h1>
    <p class="article-meta">{data['publishedDate']} | {s['author']}</p>
  </div>
{intro_html}
{body}

  <div class="cta-box">
    <h3>{s['ctaTitle']}</h3>
    <p>{s['ctaBody']}</p>
    <a href="/trips/create" class="btn-cta">{s['ctaBtn']}</a>
  </div>

  <div class="related">
    <h3>{s['relatedTitle']}</h3>
    <div class="related-links">
{related}
    </div>
  </div>
</article>

{footer_html(s)}

</body>
</html>
"""


def out_filename(slug: str, lang: str) -> str:
    return slug if lang == 'ko' else f'{slug}-{lang}'


def cmd_articles() -> int:
    if not CONTENT_DIR.exists():
        print(f'no content dir: {CONTENT_DIR}', file=sys.stderr)
        return 1
    count = 0
    for jf in sorted(CONTENT_DIR.glob('*.json')):
        data = json.loads(jf.read_text(encoding='utf-8'))
        html = render_article(data)
        fname = out_filename(data['slug'], data['lang']) + '.html'
        (BLOG_DIR / fname).write_text(html, encoding='utf-8')
        count += 1
        print(f'  wrote blog/{fname}')
    print(f'rendered {count} articles')
    return 0


CATEGORY_LABELS_KO = {
    'prep': '여행 준비', 'budget': '예산 관리', 'theme': '테마 여행',
    'ai': 'AI 활용', 'destination': '목적지 심층', 'tips': '실용 팁',
}
CATEGORY_ORDER = ['ai', 'destination', 'prep', 'budget', 'theme', 'tips']

# Existing 15 KO articles (slug, title, excerpt, date, icon, category) — kept in index.
EXISTING_KO_CARDS = [
    ('ai-travel-planning-tips', 'AI로 여행 계획 세우는 5가지 팁', 'AI 여행 플래너를 200% 활용하는 방법을 알려드립니다. 구체적인 정보 입력부터 현지 날씨 활용, 효율적인 동선 짜기까지 실전 팁을 확인해 보세요.', '2026.02.15', 'sparkle', 'ai'),
    ('packing-checklist', '해외여행 짐 싸기 완벽 체크리스트', '여권부터 전자기기까지, 해외여행에 꼭 필요한 짐 목록을 카테고리별로 정리했습니다. 기내 가방과 수화물 분리 팁도 함께 확인하세요.', '2026.02.10', 'bag', 'prep'),
    ('budget-travel-guide', '저예산 여행의 기술: 돈 아끼는 10가지 방법', '적은 예산으로도 충분히 즐거운 해외여행이 가능합니다. 항공권 절약부터 현지 맛집, 무료 관광지까지 알뜰 여행의 비법을 공개합니다.', '2026.02.05', 'coin', 'budget'),
    ('first-solo-travel', '첫 혼자 여행 가이드: 준비부터 안전까지', '혼자 떠나는 첫 여행이 두려우신가요? 목적지 선택부터 숙소 예약, 현지 안전 수칙까지 솔로 트래블러를 위한 모든 것을 담았습니다.', '2026.01.28', 'shield', 'theme'),
    ('travel-insurance-guide', '여행자 보험 가이드: 꼭 알아야 할 5가지', '여행자 보험, 왜 필요하고 어떻게 고를까요? 보장 범위부터 청구 방법까지 여행자 보험의 핵심을 정리했습니다.', '2026.01.20', 'shield', 'prep'),
    ('currency-exchange-guide', '해외여행 환전 완벽 가이드', '어디서, 언제, 얼마나 환전해야 할까요? 환율 우대부터 현지 결제까지 환전의 모든 것을 알려드립니다.', '2026.01.15', 'coin', 'budget'),
    ('travel-internet-guide', '여행 중 인터넷 사용 가이드', '유심, eSIM, 포켓와이파이 중 무엇을 선택해야 할까요? 각 방식의 장단점과 비용을 비교했습니다.', '2026.01.10', 'wifi', 'prep'),
    ('family-travel-planning', '가족 여행 계획 세우는 법', '아이와 함께하는 해외여행, 어떻게 준비할까요? 연령대별 준비물과 일정 짜기 노하우를 안내합니다.', '2026.01.05', 'heart', 'theme'),
    ('japan-transport-pass-guide', '일본 여행 필수 교통패스 완벽 가이드', 'JR패스부터 지역별 교통패스까지, 일본 여행에서 교통비를 아끼는 방법을 총정리했습니다.', '2025.12.28', 'plane', 'destination'),
    ('europe-culture-differences', '유럽 여행 시 꼭 알아야 할 문화 차이 10가지', '팁 문화부터 식사 예절까지, 유럽 여행에서 알아두면 좋은 문화 차이를 정리했습니다.', '2025.12.20', 'map', 'destination'),
    ('airport-time-saving-tips', '공항에서 시간 절약하는 7가지 방법', '체크인부터 보안 검색, 출입국 심사까지 공항에서 시간을 아끼는 실전 팁을 소개합니다.', '2025.12.15', 'clock', 'tips'),
    ('smartphone-travel-photography', '여행 사진 잘 찍는 10가지 팁', '스마트폰만으로도 멋진 여행 사진을 남길 수 있습니다. 구도, 빛, 편집까지 사진 잘 찍는 법을 알려드립니다.', '2025.12.10', 'camera', 'tips'),
    ('southeast-asia-rainy-season', '동남아시아 우기 여행의 장단점과 준비법', '우기의 동남아, 피해야 할까요? 우기 여행의 의외의 장점과 대비법을 정리했습니다.', '2025.12.05', 'map', 'destination'),
    ('long-term-travel-guide', '장기 여행 준비 가이드: 한 달 이상 여행하기', '한 달 이상의 장기 여행, 무엇을 준비해야 할까요? 짐 싸기부터 예산 관리까지 안내합니다.', '2025.11.28', 'bag', 'theme'),
    ('travel-journal-tips', '여행 일기 쓰는 법: 추억을 오래 간직하는 방법', '여행의 순간을 오래 기억하는 법, 여행 일기입니다. 꾸준히 쓰는 노하우와 활용법을 소개합니다.', '2025.11.20', 'doc', 'tips'),
]


def cmd_index() -> int:
    """Regenerate KO blog/index.html: existing 15 + new KO topics, grouped by category."""
    s = STRINGS['ko']
    topics = json.loads(TOPICS.read_text(encoding='utf-8'))['topics']
    # Build card list: (slug, title, excerpt, date, icon, category)
    cards = list(EXISTING_KO_CARDS)
    for t in topics:
        cards.append((t['slug'], t['titleKo'], t['descKo'],
                      '2026.07.10', t.get('icon', 'map'), t['category']))
    # Group by category
    by_cat: dict[str, list] = {}
    for c in cards:
        by_cat.setdefault(c[5], []).append(c)

    sections_html = []
    for cat in CATEGORY_ORDER:
        if cat not in by_cat:
            continue
        sections_html.append(
            f'<div class="cat-head">{CATEGORY_LABELS_KO[cat]}</div>\n<div class="blog-grid">')
        for slug, title, excerpt, date, icon, _ in by_cat[cat]:
            sections_html.append(f"""  <a href="/blog/{slug}" class="blog-card">
    <div class="card-icon">{icon_svg(icon)}</div>
    <h2>{title}</h2>
    <p class="card-excerpt">{excerpt}</p>
    <div class="card-meta">
      <span class="card-date">{date}</span>
      <span class="card-link">읽어보기 &rarr;</span>
    </div>
  </a>""")
        sections_html.append('</div>')
    grid = '\n'.join(sections_html)

    jsonld = json.dumps({
        "@context": "https://schema.org", "@type": "Blog",
        "name": "myTravel 블로그", "url": f"{BASE_URL}/blog",
        "description": "AI 여행 계획, 여행 준비, 예산, 목적지 가이드를 다루는 myTravel 블로그.",
        "inLanguage": "ko",
    }, ensure_ascii=False, indent=2)

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
{head_common(s)}
  <title>여행 블로그 - myTravel</title>
  <meta name="description" content="AI 여행 계획 활용법, 여행 준비, 예산 관리, 목적지 가이드까지 — myTravel 블로그에서 더 나은 여행을 위한 실용 정보를 만나보세요." />
  <link rel="canonical" href="{BASE_URL}/blog" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="여행 블로그 - myTravel" />
  <meta property="og:description" content="더 나은 여행을 위한 팁, 가이드, AI 활용법." />
  <meta property="og:url" content="{BASE_URL}/blog" />
  <meta property="og:site_name" content="myTravel" />
  <meta property="og:locale" content="ko_KR" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={AD_CLIENT}" crossorigin="anonymous"></script>
  <script type="application/ld+json">
{jsonld}
  </script>
  <style>
    {STYLE}
  </style>
</head>
<body>

{nav_html(s)}

<section class="hero">
  <h1>여행 블로그</h1>
  <p>더 나은 여행을 위한 팁, 가이드, 그리고 AI 활용법을 만나보세요</p>
</section>

<div class="breadcrumb">
  <a href="/">홈</a> &gt; <strong>블로그</strong>
</div>

<div class="blog-intro">
  <p>myTravel 블로그에 오신 것을 환영합니다. 이곳에서는 여행을 더 즐겁고 효율적으로 만들어 줄 다양한 정보를 공유합니다. AI 기반 여행 계획 활용법부터 여행 준비, 예산 관리, 목적지별 코스, 혼자 여행 가이드까지 실용적인 콘텐츠를 제공합니다.</p>
  <p>여행 전문가와 경험 많은 여행자들의 노하우를 바탕으로 작성된 글들을 통해, 여러분의 다음 여행이 한층 더 특별해지길 바랍니다. 궁금한 주제가 있다면 언제든 <a href="/contact" style="color:#4A90D9;">문의해 주세요</a>!</p>
</div>

{grid}

<div class="ad-section" style="max-width:1200px;margin:0 auto;padding:1.5rem;text-align:center;">
  <ins class="adsbygoogle" style="display:block" data-ad-client="{AD_CLIENT}" data-ad-slot="{AD_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
</div>

<section class="cta-section">
  <h2>AI로 나만의 여행 일정을 만들어 보세요</h2>
  <p>목적지만 선택하면 AI가 최적의 여행 계획을 자동으로 생성합니다. 무료로 시작하세요!</p>
  <a href="/trips/create" class="btn-cta">여행 계획 시작하기</a>
</section>

{footer_html(s)}

</body>
</html>
"""
    (BLOG_DIR / 'index.html').write_text(html, encoding='utf-8')
    print(f'wrote blog/index.html ({len(cards)} cards)')
    return 0


def cmd_sitemap() -> int:
    """Regenerate the blog section of sitemap.xml (existing + new, all langs)."""
    topics = json.loads(TOPICS.read_text(encoding='utf-8'))['topics']
    existing = [c[0] for c in EXISTING_KO_CARDS]
    lines = ['  <!-- Blog (auto-generated by build_blog.py) -->']
    # index
    lines.append(f"""  <url>
    <loc>{BASE_URL}/blog</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>""")
    # existing KO (single-lang)
    for slug in existing:
        lines.append(f"""  <url>
    <loc>{BASE_URL}/blog/{slug}</loc>
    <lastmod>2026-07-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>""")
    # new topics: KO + EN + JA with hreflang alternates
    for t in topics:
        slug = t['slug']
        alts = {'ko': f'/blog/{slug}', 'en': f'/blog/{slug}-en', 'ja': f'/blog/{slug}-ja'}
        for lang, path in alts.items():
            altlinks = '\n'.join(
                f'    <xhtml:link rel="alternate" hreflang="{l}" href="{BASE_URL}{p}"/>'
                for l, p in alts.items())
            lines.append(f"""  <url>
    <loc>{BASE_URL}{path}</loc>
{altlinks}
    <lastmod>2026-07-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>""")
    block = '\n'.join(lines)

    text = SITEMAP.read_text(encoding='utf-8')
    import re as _re
    # Replace existing blog block if marker present, else insert before </urlset>
    marker_start = '  <!-- Blog (auto-generated by build_blog.py) -->'
    if marker_start in text:
        text = _re.sub(
            r'  <!-- Blog \(auto-generated by build_blog\.py\) -->.*?(?=\n  <!--|\n</urlset>)',
            block, text, count=1, flags=_re.DOTALL)
    else:
        # Remove any pre-existing hand-written blog <url> entries, then insert
        text = _re.sub(
            r'\n  <url>\s*<loc>[^<]*/blog[^<]*</loc>.*?</url>',
            '', text, flags=_re.DOTALL)
        text = text.replace('</urlset>', block + '\n</urlset>')
    SITEMAP.write_text(text, encoding='utf-8')
    print('updated sitemap.xml blog block')
    return 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    rc = 0
    if cmd in ('articles', 'all'):
        rc |= cmd_articles()
    if cmd in ('index', 'all'):
        rc |= cmd_index()
    if cmd in ('sitemap', 'all'):
        rc |= cmd_sitemap()
    sys.exit(rc)
