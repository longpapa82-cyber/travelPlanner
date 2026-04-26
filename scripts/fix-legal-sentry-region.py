"""
V187 P1-B (CRITICAL #3): Sentry region in privacy.art12 was incorrectly
listed as USA in 17 locales. The actual Sentry DSN is `o4511263608471552
.ingest.de.sentry.io` (Germany region). GDPR Art. 13 requires accurate
disclosure of where personal data flows; misstating the country is a
direct breach.

This pass walks every locale, finds the Sentry row in art12 (cross-border
transfer table) AND elsewhere in the file, and replaces the country in
that specific row.
"""

import json
import re
from pathlib import Path

# Localized country labels for Germany. Each value is what the row's
# "country" cell should read in that locale.
GERMANY_BY_LOCALE = {
    "ar": "ألمانيا",
    "de": "Deutschland",
    "en": "Germany",
    "es": "Alemania",
    "fr": "Allemagne",
    "hi": "जर्मनी",
    "id": "Jerman",
    "it": "Germania",
    "ja": "ドイツ",
    "ko": "독일",
    "ms": "Jerman",
    "pt": "Alemanha",
    "ru": "Германия",
    "th": "เยอรมนี",
    "tr": "Almanya",
    "vi": "Đức",
    "zh": "德国",
}

# Patterns of incorrect country labels we are replacing (locale-specific).
# Built as a regex that matches the country cell after "Sentry |".
WRONG_COUNTRY_BY_LOCALE = {
    "ar": r"الولايات المتحدة|الولايات المتحدة الأمريكية|أمريكا|USA",
    "de": r"USA|Vereinigte Staaten",
    "en": r"USA|United States",
    "es": r"USA|Estados Unidos|EE\.UU\.|EE\. UU\.",
    "fr": r"USA|États-Unis|Etats-Unis",
    "hi": r"संयुक्त राज्य अमेरिका|यूएसए|अमेरिका|USA",
    "id": r"Amerika Serikat|AS|USA",
    "it": r"USA|Stati Uniti",
    "ja": r"アメリカ|米国|USA",
    "ko": r"미국|USA",
    "ms": r"AS|Amerika Syarikat|USA",
    "pt": r"EUA|Estados Unidos|USA",
    "ru": r"США|USA",
    "th": r"สหรัฐอเมริกา|สหรัฐ|USA",
    "tr": r"ABD|Amerika Birleşik Devletleri|USA",
    "vi": r"Hoa Kỳ|Mỹ|USA",
    "zh": r"美国|USA",
}


def replace_sentry_country(content: str, wrong: str, right: str) -> str:
    # Match a markdown table row whose first non-whitespace cell is "Sentry"
    # followed by a country cell containing the wrong label. Keep cell
    # delimiters intact.
    pattern = re.compile(
        rf"(\|\s*Sentry\s*\|\s*)(?:{wrong})(\s*\|)",
        re.IGNORECASE,
    )
    return pattern.sub(rf"\1{right}\2", content)


base = Path("frontend/src/i18n/locales")
for locale, right in GERMANY_BY_LOCALE.items():
    path = base / locale / "legal.json"
    if not path.exists():
        print(f"{locale}: SKIP (no file)")
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    privacy = data.get("privacy", {}).get("articles", {})
    wrong_pat = WRONG_COUNTRY_BY_LOCALE.get(locale, "USA")
    changes = []
    # Walk every article — different locales place the cross-border
    # transfer table under art12 OR art15 (V184 invariant 33 history).
    for art_key, art in privacy.items():
        if not isinstance(art, dict) or "content" not in art:
            continue
        before = art["content"]
        after = replace_sentry_country(before, wrong_pat, right)
        if before != after:
            art["content"] = after
            changes.append(art_key)
    if not changes:
        print(f"{locale}: NO CHANGE (Sentry row not matching expected pattern)")
        continue
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"{locale}: Sentry region → {right} (in {', '.join(changes)})")
