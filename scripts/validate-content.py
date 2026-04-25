#!/usr/bin/env python3
"""V184: automated factual-consistency check for static web content.

Runs alongside scripts/validate-legal.py. Catches the V183-class regressions
where marketing pages, blog footers, license screens, etc. carry strings
that disagree with reality (founding year, business name, dropped
processors, unimplemented features).

What it checks (all P0 — exit 1):
  1. No copyright span starting before AI Soft's founding year (2026).
  2. No "Paddle" mention anywhere in frontend/public/*.html
     (web payment was discontinued 2026-04-21).
  3. No "iCal" / "Apple Calendar" mention as if implemented.
  4. No claim about affiliate marketing programs (revenue dashboard
     dropped affiliate; advertising it would mislead users).
  5. JSON-LD datePublished must not predate AI Soft's founding year.

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
FOUNDING_YEAR = 2026

# Banned literal substrings (case-insensitive). Each entry: (regex, message).
BANNED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r'paddle', re.IGNORECASE),
        'mentions "Paddle" — web payment was discontinued 2026-04-21',
    ),
    (
        re.compile(r'\bical\b', re.IGNORECASE),
        'advertises iCal export — feature not implemented',
    ),
    (
        re.compile(r'apple\s+calendar|애플\s*캘린더', re.IGNORECASE),
        'advertises Apple Calendar export — feature not implemented',
    ),
    (
        re.compile(r'affiliate\s+marketing|제휴\s*마케팅', re.IGNORECASE),
        'advertises affiliate marketing program — currently not running',
    ),
    (
        re.compile(r'booking\.com.{0,50}klook|klook.{0,50}getyourguide', re.IGNORECASE),
        'lists affiliate partner brand names — currently not running',
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


def scan_file(path: Path) -> list[str]:
    failures: list[str] = []
    try:
        text = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError) as exc:
        return [f'unable to read: {exc}']

    for line_no, line in enumerate(text.split('\n'), start=1):
        for pattern, message in BANNED_PATTERNS:
            if pattern.search(line):
                failures.append(f'L{line_no}: {message}')

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

    for m in DATE_PUBLISHED_PATTERN.finditer(text):
        year = int(m.group('date'))
        if year < FOUNDING_YEAR:
            failures.append(
                f'JSON-LD datePublished year {year} predates AI Soft '
                f'founding year ({FOUNDING_YEAR})'
            )

    return failures


def main() -> int:
    print('V184 static content factual-consistency check')
    print('=' * 60)

    if not WEB_ROOT.exists():
        print(f'ERROR: web root not found at {WEB_ROOT}', file=sys.stderr)
        return 1

    html_files = sorted(WEB_ROOT.rglob('*.html'))
    if not html_files:
        print(f'ERROR: no HTML files under {WEB_ROOT}', file=sys.stderr)
        return 1

    total_failures = 0
    files_with_failures = 0
    for path in html_files:
        failures = scan_file(path)
        if failures:
            files_with_failures += 1
            rel = path.relative_to(ROOT)
            print(f'\n[{rel}]')
            for f in failures:
                print(f'  FAIL: {f}')
                total_failures += 1

    print('\n' + '=' * 60)
    print(f'Scanned: {len(html_files)} HTML files')
    print(f'Files with failures: {files_with_failures}')
    print(f'Total failures: {total_failures}')

    if total_failures:
        print('\nFAIL: fix factual inconsistencies before Alpha submission')
        return 1
    print('\nPASS: all static content factually consistent')
    return 0


if __name__ == '__main__':
    sys.exit(main())
