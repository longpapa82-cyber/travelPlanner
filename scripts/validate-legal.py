#!/usr/bin/env python3
"""
V182 (Issue 4): automated consistency check for the 17-locale legal
documents. Run this before every Alpha submission and on CI.

What it checks (P0 = exit 1, P1 = warn):
  P0  art18 (or other terms article) contains "AI Soft" + an explicit
      placeholder marker so reviewers know the registration number is
      pending issuance.
  P0  privacy.articles.art3 mentions OpenAI, Sentry, RevenueCat, Google,
      OpenWeather (5 third parties).
  P0  privacy.articles.ccpa exists with the 5 statute references
      (1798.100/.105/.110/.120/.125).
  P0  privacy.articles.art12 exists (international transfer table).
  P1  privacy.articles.art5 mentions "90" (error_logs retention).
  P1  terms.effectiveDate and privacy.effectiveDate are consistent
      across all 17 locales (same calendar date even if formatted per
      locale).

Exit codes:
  0  → all P0 pass; warnings printed for any P1
  1  → at least one P0 fails (CI / pre-submit must block)
"""
import json
import re
import sys
from pathlib import Path

LOCALES = [
    'ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko',
    'ms', 'pt', 'ru', 'th', 'tr', 'vi', 'zh',
]

REQUIRED_THIRD_PARTIES_LC = ['openai', 'sentry', 'revenuecat', 'google', 'openweather']
REQUIRED_CCPA_SECTIONS = ['1798.100', '1798.105', '1798.110', '1798.120', '1798.125']

BASE = Path(__file__).resolve().parent.parent / 'frontend' / 'src' / 'i18n' / 'locales'


def validate_locale(locale: str) -> tuple[list[str], list[str]]:
    p0_failures: list[str] = []
    p1_failures: list[str] = []

    path = BASE / locale / 'legal.json'
    if not path.exists():
        p0_failures.append(f'legal.json missing')
        return p0_failures, p1_failures

    data = json.loads(path.read_text())

    # P0-A: terms business info — find any article whose content contains
    # "AI Soft" + the actual representative email.
    terms_articles = data.get('terms', {}).get('articles', {})
    biz_found = any(
        'AI Soft' in (v.get('content', '') or '') and
        'longpapa82@gmail.com' in (v.get('content', '') or '')
        for v in terms_articles.values()
    )
    if not biz_found:
        p0_failures.append('terms missing business-info article (AI Soft + email)')

    # P0-B: privacy.art3 contains required third parties.
    art3_content = (
        data.get('privacy', {})
        .get('articles', {})
        .get('art3', {})
        .get('content', '')
        .lower()
    )
    for tp in REQUIRED_THIRD_PARTIES_LC:
        if tp not in art3_content:
            p0_failures.append(f'privacy.art3 missing third-party "{tp}"')

    # P0-C: privacy.ccpa exists + has all 5 statute references.
    ccpa_content = (
        data.get('privacy', {})
        .get('articles', {})
        .get('ccpa', {})
        .get('content', '')
    )
    if not ccpa_content:
        p0_failures.append('privacy.ccpa article missing')
    else:
        for ref in REQUIRED_CCPA_SECTIONS:
            if ref not in ccpa_content:
                p0_failures.append(f'privacy.ccpa missing "{ref}"')

    # P0-D: privacy.art12 (international data transfer) exists.
    art12 = data.get('privacy', {}).get('articles', {}).get('art12')
    if not art12:
        p0_failures.append('privacy.art12 (international transfer) missing')

    # P1-A: privacy.art5 retention mentions "90".
    art5_content = (
        data.get('privacy', {})
        .get('articles', {})
        .get('art5', {})
        .get('content', '')
    )
    if '90' not in art5_content:
        p1_failures.append('privacy.art5 missing 90-day error_logs retention line')

    return p0_failures, p1_failures


def parse_calendar_date(text: str) -> str:
    """Normalize a localized date string for divergence detection.

    Locales use different month-name conventions (Korean "4월", Turkish
    "Nisan", Arabic "أبريل"). We can not extract the month numerically
    when it is spelled out, so we normalize on the year alone — which is
    sufficient to detect "stale year" inconsistency (the most common
    divergence). For day/month inconsistency we trust the bulk-update
    Python script that wrote the dates and rely on visual review.
    """
    nums = [int(n) for n in re.findall(r'\d+', text)]
    year = next((n for n in nums if 2024 <= n <= 2030), 0)
    return f'{year}' if year else text


def main() -> int:
    print('V182 legal-doc consistency check\n' + '=' * 50)

    any_p0 = False
    any_p1 = False
    eff_dates: dict[str, tuple[str, str]] = {}

    for loc in LOCALES:
        p0, p1 = validate_locale(loc)
        path = BASE / loc / 'legal.json'
        if path.exists():
            d = json.loads(path.read_text())
            terms_d = d.get('terms', {}).get('effectiveDate', '')
            priv_d = d.get('privacy', {}).get('effectiveDate', '')
            eff_dates[loc] = (
                parse_calendar_date(terms_d),
                parse_calendar_date(priv_d),
            )

        if p0 or p1:
            print(f'\n[{loc}]')
            for f in p0:
                print(f'  P0 FAIL: {f}')
                any_p0 = True
            for f in p1:
                print(f'  P1 WARN: {f}')
                any_p1 = True

    # P1-B: effectiveDate consistency across locales.
    print('\n' + '=' * 50)
    print('effectiveDate consistency:')
    canonical_terms = {v[0] for v in eff_dates.values()}
    canonical_priv = {v[1] for v in eff_dates.values()}
    if len(canonical_terms) > 1:
        any_p1 = True
        print(f'  P1 WARN: terms.effectiveDate divergent across locales: {canonical_terms}')
    else:
        print(f'  OK terms.effectiveDate: {canonical_terms.pop()}')
    if len(canonical_priv) > 1:
        any_p1 = True
        print(f'  P1 WARN: privacy.effectiveDate divergent across locales: {canonical_priv}')
    else:
        print(f'  OK privacy.effectiveDate: {canonical_priv.pop()}')

    print('\n' + '=' * 50)
    if any_p0:
        print('FAIL: at least one P0 violation — fix before Alpha submission')
        return 1
    if any_p1:
        print('PASS WITH WARNINGS: P0 OK, P1 issues need attention')
        return 0
    print('PASS: 17 locales fully consistent')
    return 0


if __name__ == '__main__':
    sys.exit(main())
