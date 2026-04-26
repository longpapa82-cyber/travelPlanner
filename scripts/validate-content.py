#!/usr/bin/env python3
"""V185: automated factual-consistency check across HTML + i18n + docs.

Catches V183/V184-class regressions where marketing pages, store-listing,
license screens, and i18n bundles carry strings that disagree with
reality (founding year, business name, dropped processors, unimplemented
features, advertising-policy violations).

V184 → V185 expansion:
  - HTML scan retained (frontend/public/*.html)
  - NEW: i18n JSON scan (frontend/src/i18n/locales/*/*.json)
  - NEW: docs markdown scan (docs/store-listing.md)
  - NEW: unimplemented-feature claim patterns (unlimited AI, 100+
    currencies, checklists, comments, Apple login on iOS-undeployed)

Why expand: V184 validate-content.py covered HTML only. The V184
contentaudit found 11 P0 sourced from i18n JSON + store-listing.md,
all of which would slip through HTML-only scanning. Single source of
truth for factual constraints.

Exit codes:
  0 → all checks pass
  1 → at least one violation
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = ROOT / 'frontend' / 'public'
I18N_ROOT = ROOT / 'frontend' / 'src' / 'i18n' / 'locales'
DOCS_FILES = [ROOT / 'docs' / 'store-listing.md']
FOUNDING_YEAR = 2026

# Banned patterns (case-insensitive). (regex, message, applies_to)
# applies_to: 'all' | 'html' | 'i18n' | 'docs'
BANNED_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    # Dropped processors
    (
        re.compile(r'paddle', re.IGNORECASE),
        'mentions "Paddle" — web payment was discontinued 2026-04-21',
        'all',
    ),
    # Unimplemented features
    (
        re.compile(r'\bical\b', re.IGNORECASE),
        'advertises iCal export — feature not implemented',
        'all',
    ),
    (
        re.compile(r'apple\s+calendar|애플\s*캘린더|Apple\s*カレンダー', re.IGNORECASE),
        'advertises Apple Calendar export — feature not implemented',
        'all',
    ),
    (
        re.compile(r'affiliate\s+marketing|제휴\s*마케팅|アフィリエイト.*プログラム', re.IGNORECASE),
        'advertises affiliate marketing program — currently not running',
        'all',
    ),
    (
        re.compile(r'booking\.com.{0,50}klook|klook.{0,50}getyourguide', re.IGNORECASE),
        'lists affiliate partner brand names — currently not running',
        'all',
    ),
    # V185 NEW: Unlimited AI claim (actual quota: 30/month for premium,
    # 9999 for admin only). Catches V184-D-P0-1, P0-5.
    (
        re.compile(
            r'unlimited\s+AI|무제한\s*AI|無制限.*AI|无限.*AI|無限.*AI|'
            r'AI.*ilimitad|illimitée?\s+IA|unbegrenzte?\s*KI|'
            r'неограниченн[ыа][ея]?\s*AI|غير\s*محدود.*ذكاء|'
            r'AI\s*tanpa\s*had|AI\s*tak\s*terbatas|sınırsız\s*AI|'
            r'illimitat[ao]\s*(?:AI|generazion)|ไม่จำกัด.*AI|'
            r'không\s*giới\s*hạn.*AI',
            re.IGNORECASE,
        ),
        'claims "unlimited AI" — actual quota is 30/month for premium',
        'all',
    ),
    # V185 NEW: 100+ currencies claim (actual: 7 currencies in picker).
    # Catches V184-D-P0-2.
    (
        re.compile(
            r'100\+\s*(?:currencies|통화|通貨|货币|monedas|devises|Währungen|valute|valyut|عملة|मुद्रा|สกุลเงิน|tiền tệ|para birimi|mata\s+wang)|'
            r'100\s*(?:이상의?|以上|多种)\s*통화|'
            r'100以上の通貨',
            re.IGNORECASE,
        ),
        'claims "100+ currencies" — actual implementation supports 7 currencies',
        'all',
    ),
    # V185 NEW: Checklist feature (not implemented).
    # Catches V184-D-P0-3.
    (
        re.compile(
            r'\bchecklists?\b|체크리스트|チェックリスト|清单|准备清单|准备清单|'
            r'lista\s+de\s+verificación|liste\s+de\s+contrôle|Checkliste|'
            r'lista\s+di\s+controllo|чек-лист|قائمة\s*مراجعة|'
            r'चेकलिस्ट|รายการตรวจสอบ|danh\s*sách\s*kiểm\s*tra|'
            r'kontrol\s+listesi|daftar\s+(?:periksa|persediaan)|senarai\s+semak',
            re.IGNORECASE,
        ),
        'advertises checklist feature — not implemented in V184',
        'docs',  # only docs/store-listing — i18n FAQ may legitimately mention
    ),
    # V185 NEW: "Comment on travel/trip stories" — likeTrip exists but no
    # comment module. Catches V184-D-P0-4.
    (
        re.compile(
            r'comment.{0,30}(?:travel|trip|stories|stories?)|'
            r'댓글.*(?:여행|후기|교류)|'
            r'コメント.*(?:旅|思い出|交流)|'
            r'评论.{0,10}(?:旅行|游记)|'
            r'comentari?o.{0,30}(?:viaje|viagem|histori)|'
            r'commenter?\s+(?:vos?\s*)?voyages?|'
            r'kommentier.{0,15}(?:Reise|Geschichte)|'
            r'commento.{0,30}(?:viaggio|stori)|'
            r'комментар.{0,30}(?:путешеств|истори)|'
            r'تعليق.{0,30}(?:رحل|قصة)|'
            r'टिप्पणी.{0,30}(?:यात्रा)|'
            r'ความคิดเห็น.{0,30}(?:เดินทาง)|'
            r'bình\s*luận.{0,30}(?:du\s*lịch|chuyến)|'
            r'yorum.{0,30}(?:seyahat|gezi)|'
            r'komentar.{0,30}(?:perjalanan)',
            re.IGNORECASE,
        ),
        'advertises comments on travel stories — only "like" is implemented',
        'docs',  # docs/store-listing only; i18n FAQ may legitimately discuss
    ),
    # V185 NEW: marketing buzzwords (RULES.md "no marketing language" ban).
    (
        re.compile(
            r'엔터프라이즈\s*급|enterprise[-\s]?(?:grade|class)|エンタープライズ.*(?:級|クラス)|'
            r'blazingly\s*fast|100%\s*secure|world.s\s*best',
            re.IGNORECASE,
        ),
        'marketing language ("enterprise-grade" / "100% secure" / etc.) — RULES.md ban',
        'all',
    ),
    # V186 NEW: "5초 / N seconds" 정량 약속 — AI 생성 컨텍스트만 차단
    # (일반 가이드의 "5시간 코스", "1-2 hours" 같은 시간 표기는 허용)
    # 정확한 약속 패턴: "N초 만에 완성/생성", "in N seconds with/to ai"
    (
        re.compile(
            r'\d+\s*초\s*만에\s*(?:완성|생성|제공|준비)|'
            r'(?:in|within)\s+(?:just\s+|only\s+)?\d+\s+seconds?\s+(?:with\s+AI|to\s+create|to\s+generate|or\s+less|using\s+AI)|'
            r'\d+\s*秒で(?:完成|生成|作成)|'
            r'AI[^.]{0,30}\b\d+\s*(?:초|seconds?|秒)\b[^.]{0,15}(?:완성|생성|만에|to\s+create)',
            re.IGNORECASE,
        ),
        'quantitative time promise for AI generation (e.g. "5초 만에 완성") — actual is 10-30s',
        'all',
    ),
    # V186 NEW: 약관 본문 "제한 없이.*AI" / "unlimited.*premium" 자기모순
    # (header에서는 30회 명시했는데 art6 ⑤ 본문이 "제한 없이"라 모순)
    (
        re.compile(
            r'제한\s*없이.{0,50}AI|premium.{0,30}unlimited.{0,30}generation|'
            r'unlimited.{0,30}access.{0,15}premium',
            re.IGNORECASE,
        ),
        'legal text claims "unlimited" premium — actual is 30/month (Invariant 41)',
        'i18n',
    ),
    # V186 NEW: 약관/개인정보처리방침에 "리뷰/댓글" 표기 (좋아요만 구현)
    (
        re.compile(
            r'(?:리뷰|댓글|reviews?|comments?)[\s,]+(?:and\s+|및\s+|や)?(?:photos?|사진|写真|comment|댓글|코멘트)|'
            r'(?:게시한|posted|posting).{0,30}(?:리뷰|댓글|reviews?|comments?)',
            re.IGNORECASE,
        ),
        'mentions reviews/comments in legal/marketing text — only "like" is implemented',
        'all',
    ),
    # V186 NEW: "완벽" / "perfect" 보장 표현 (표시광고법 제3조 절대적 표현 금지)
    # 단, 여행지 묘사("완벽한 노을", "perfect sunset" 등)는 일반적 형용사라 허용.
    # 서비스·기능 광고 컨텍스트에 한정한 정밀 패턴만 차단.
    (
        re.compile(
            r'완벽(?:한|히)\s*(?:여행\s*계획|일정|지원|기록|서비스|플래너)|'
            r'완벽\s*지원|완벽하게\s*(?:계획|기록|지원)|'
            r'perfectly\s+(?:plan|tailored|matched)\s+(?:itinerary|trip|travel)|'
            r'perfect\s+(?:itinerary|trip\s+planner|travel\s+app)|'
            r'\b최고의\s+(?:선택|서비스|플래너|앱)|'
            r'the\s+best\s+(?:travel|trip)\s+(?:planner|app)',
            re.IGNORECASE,
        ),
        'absolute/superlative service ad ("완벽한 일정", "perfect itinerary") — Korean ad law §3',
        'all',
    ),
    # V187 P1-B (CRITICAL #1): "all features are free" claim (Play 8.3
    # misleading-content). Any locale that promises every feature for free
    # while a paid premium plan exists is a direct policy violation.
    # We allowlist factual phrases like "free to start" / "free with up to
    # N AI generations" by requiring proximity to the unconditional words
    # 모든/all/todas/tutte etc. WITHOUT a premium qualifier.
    (
        re.compile(
            r'모든\s*(?:핵심)?\s*기능[은은이가]?\s*무료|'
            r'all\s+(?:my)?features?\s+are\s+free|'
            r'tutte\s+le\s+funzioni.{0,20}gratu|'
            r'toutes\s+les\s+fonctionnalit.{0,20}gratu|'
            r'todas\s+(?:as|las)\s+(?:funciones|funcionalidades).{0,20}gratu|'
            r'alle\s+\w+-?funktionen\s+sind\s+kostenlos|'
            r'jeden\s+bezpłatny|'
            r'semua\s+fitur.{0,20}gratis|'
            r'tất\s+cả\s+tính\s+năng.{0,20}miễn\s+phí|'
            r'所有功能.{0,20}免费|'
            r'すべての機能.{0,20}無料|'
            r'все\s+функции.{0,20}бесплатн',
            re.IGNORECASE,
        ),
        'unconditional "all features free" claim — Play 8.3 misleading content',
        'all',
    ),
    # V187 P1-B (CRITICAL #5): unlimited AI generation in locales other
    # than the V185-allowlisted "AI_TRIPS_ADMIN_LIMIT" sentinel. Premium
    # is capped at 30/month, so "unlimited" is misleading.
    (
        re.compile(
            r'\btanpa\s+batas\b|'  # id
            r'безлимитн[ыа][ея]?\s*AI|'  # ru
            r'\bvô\s+hạn\b.{0,20}AI|'  # vi
            r'\bilimitad[ao]s?\b.{0,20}IA|'  # es / pt (avoid pre-existing factual mentions)
            r'unbegrenzt(?:e|er)?\s+(?:KI|AI)',  # de
            re.IGNORECASE,
        ),
        'unlimited AI claim — premium is 30/month, not unlimited',
        'all',
    ),
    # V187 P1-B (CRITICAL #6): unregistered currency in pricing. Play
    # Console only carries USD ($) and KRW (₩). Any other symbol in a
    # premium-pricing context promises a price that does not exist.
    (
        re.compile(
            r'(?:R\$|€|£|₹|¥(?!\s*\d))\s*\d+[,.]?\d*\s*'
            r'(?:/(?:mês|mois|mes|月|meses|miesiąc|maand)|'
            r'/(?:ano|année|año|year|年|year)|'
            r'\bpor\s+mes|'
            r'\bal\s+mese|'
            r'\bpro\s+Monat)',
            re.IGNORECASE,
        ),
        'unregistered currency in pricing claim (Play Console has only USD/KRW)',
        'all',
    ),
    # V187 P1-B (HIGH): "in N seconds" / "instantly" trip-creation promises.
    # Real OpenAI calls are 10-30s. Any "in 5 seconds" / "instantly" claim
    # paired with an itinerary noun is a measurable factual breach.
    (
        re.compile(
            r'in\s+\d+\s+seconds?\b(?!\s+with)|'
            r'\binstantly\s+(?:creates?|generates?)\s+(?:your\s+)?(?:itinerary|trip|plan)|'
            r'planning\s+in\s+seconds|'
            r'수\s*초\s*안에\s*완성|'
            r'\bperfect\s+(?:trip|day|itinerary|adventure|journey|getaway)',
            re.IGNORECASE,
        ),
        'measurable time/superlative trip-creation claim (real latency 10-30s)',
        'all',
    ),
]

# Copyright span check: e.g. "© 2024-2026 AI Soft" → 2024 < 2026 → fail.
COPYRIGHT_PATTERN = re.compile(
    r'(?:©|&copy;|\(c\))\s*(?P<start>20\d{2})\s*[-–]\s*(?P<end>20\d{2})',
    re.IGNORECASE,
)
SINGLE_YEAR_PATTERN = re.compile(
    r'(?:©|&copy;|\(c\))\s*(?P<year>20\d{2})\b'
)

# JSON-LD datePublished: prevents staleness like "datePublished": "2024-01-01".
DATE_PUBLISHED_PATTERN = re.compile(
    r'"datePublished"\s*:\s*"(?P<date>\d{4})-\d{2}-\d{2}"'
)

# V185 NEW: i18n effectiveDate header vs body consistency check.
# legal.terms.effectiveDate / legal.privacy.effectiveDate must equal the
# date appearing in art "부칙" / "Effective Date" / etc. body sections.
EFFECTIVE_DATE_BODY_PATTERN = re.compile(
    r'(?:effective\s*from|시행합니다|施行|effetto|kraft|envigueur|'
    r'sürürlüğe\s*girer|berlaku|vigor|сила|سار)\s*(?P<date>[\w\s,.-]{3,30})',
    re.IGNORECASE,
)


def scan_file(path: Path, scope: str) -> list[str]:
    """scope: 'html' | 'i18n' | 'docs' — controls which BANNED_PATTERNS apply.

    V185: false-positive guards
      - admin-only "∞ unlimited/무제한" labels (PremiumContext 9999 sentinel
        for admin accounts) are intentional — see CLAUDE.md invariant 19.
      - lines starting with markdown header comment "정정", "fix", "정정 이력"
        are documentation of past corrections, not active claims.
    """
    failures: list[str] = []
    try:
        text = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError) as exc:
        return [f'unable to read: {exc}']

    # i18n: skip lines whose JSON key starts with "ai" + Unlimited|무제한
    # (admin-only quota sentinel). Detect by checking key context.
    admin_unlimited_key_re = re.compile(
        r'"ai(?:Unlimited|UnlimitedQuota|UnlimitedLabel|Unlimited\w*)"\s*:'
    )
    # docs: skip lines that document a *past* correction — these contain
    # arrow markers like "→" or words "정정", "정정 이력", "fix:", "removed".
    docs_correction_re = re.compile(
        r'정정|정정\s*이력|→|removed|deprecated|^\s*[->]\s|^\s*[#-]\s*V\d+',
        re.IGNORECASE,
    )

    for line_no, line in enumerate(text.split('\n'), start=1):
        # i18n: skip admin-only unlimited sentinel
        if scope == 'i18n' and admin_unlimited_key_re.search(line):
            continue
        # docs: skip past-correction documentation
        if scope == 'docs' and docs_correction_re.search(line):
            continue

        for pattern, message, applies_to in BANNED_PATTERNS:
            if applies_to != 'all' and applies_to != scope:
                continue
            if pattern.search(line):
                failures.append(f'L{line_no}: {message}')

    # Copyright + JSON-LD checks apply to HTML and i18n only (not docs)
    if scope in ('html', 'i18n'):
        for m in COPYRIGHT_PATTERN.finditer(text):
            start = int(m.group('start'))
            end = int(m.group('end'))
            if start < FOUNDING_YEAR:
                failures.append(
                    f'copyright span "{m.group(0)}" starts before AI Soft '
                    f'founding year ({FOUNDING_YEAR})'
                )
            if end < FOUNDING_YEAR:
                failures.append(
                    f'copyright span "{m.group(0)}" ends before AI Soft '
                    f'founding year ({FOUNDING_YEAR})'
                )

        for m in SINGLE_YEAR_PATTERN.finditer(text):
            year = int(m.group('year'))
            if year < FOUNDING_YEAR:
                failures.append(
                    f'single-year copyright "{m.group(0)}" predates AI Soft '
                    f'founding year ({FOUNDING_YEAR})'
                )

    if scope == 'html':
        for m in DATE_PUBLISHED_PATTERN.finditer(text):
            year = int(m.group('date'))
            if year < FOUNDING_YEAR:
                failures.append(
                    f'JSON-LD datePublished year {year} predates AI Soft '
                    f'founding year ({FOUNDING_YEAR})'
                )

    return failures


def main() -> int:
    print('V185 static content factual-consistency check (HTML + i18n + docs)')
    print('=' * 70)

    targets: list[tuple[Path, str]] = []

    # 1. HTML files under frontend/public/
    if WEB_ROOT.exists():
        for path in sorted(WEB_ROOT.rglob('*.html')):
            targets.append((path, 'html'))

    # 2. i18n JSON files (all locales × all namespaces)
    if I18N_ROOT.exists():
        for path in sorted(I18N_ROOT.rglob('*.json')):
            targets.append((path, 'i18n'))

    # 3. Docs (store-listing only — other markdown is internal)
    for path in DOCS_FILES:
        if path.exists():
            targets.append((path, 'docs'))

    if not targets:
        print('ERROR: no scan targets found', file=sys.stderr)
        return 1

    total_failures = 0
    files_with_failures = 0
    for path, scope in targets:
        failures = scan_file(path, scope)
        if failures:
            files_with_failures += 1
            rel = path.relative_to(ROOT)
            print(f'\n[{rel}] ({scope})')
            for f in failures:
                print(f'  FAIL: {f}')
                total_failures += 1

    print('\n' + '=' * 70)
    print(f'Scanned: {len(targets)} files '
          f'(HTML: {sum(1 for _, s in targets if s == "html")}, '
          f'i18n: {sum(1 for _, s in targets if s == "i18n")}, '
          f'docs: {sum(1 for _, s in targets if s == "docs")})')
    print(f'Files with failures: {files_with_failures}')
    print(f'Total failures: {total_failures}')

    if total_failures:
        print('\nFAIL: fix factual inconsistencies before Alpha submission')
        return 1
    print('\nPASS: all static content + i18n + docs factually consistent')
    return 0


if __name__ == '__main__':
    sys.exit(main())
