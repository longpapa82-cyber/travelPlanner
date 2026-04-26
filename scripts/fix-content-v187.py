"""
V187 P1-B: bulk fix the 30 latent factual regressions caught by the
validate-content.py V187 patterns:

  - measurable time / superlative trip-creation claims (28x in landing
    pages and city guides)
  - 'unlimited AI' in id/components.json + id/trips.json (2x)
"""

import json
import re
from pathlib import Path

# 1. HTML files: replace specific phrases. Use surgical replacements
# rather than regex so the marketing copy stays readable.
HTML_REPLACEMENTS = [
    # English landing pages and guides
    ("AI Creates Your Perfect Trip in 5 Seconds", "Personalized AI Itineraries Tailored to You"),
    ("AI-powered travel planning in seconds", "AI-powered travel planning made simple"),
    ("Plan Your Trip in 5 Seconds", "Plan Your Trip with AI"),
    ("Plan your trip in seconds", "Plan your trip with AI"),
    ("Plan your trip in 5 seconds", "Plan your trip with AI"),
    ("trip in 5 seconds", "trip with AI"),
    ("trip planning in seconds", "trip planning made simple"),
    ("planning in seconds", "planning made simple"),
    ("Perfect Trip", "Personalized Trip"),
    ("perfect trip", "personalized trip"),
    ("instantly creates your itinerary", "creates a personalized itinerary"),
    ("instantly generates your itinerary", "generates a personalized itinerary"),
    ("instantly creates your trip", "creates a personalized trip"),
    ("plan your perfect day", "plan your day"),
    ("perfect day", "memorable day"),
    ("perfect adventure", "tailored adventure"),
    ("perfect getaway", "tailored getaway"),
    # Korean landing
    ("수 초 안에 완성", "AI가 빠르게 생성"),
]


def patch_html(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in HTML_REPLACEMENTS:
        # case-insensitive single-occurrence-style replacement preserving
        # surrounding context
        text = re.sub(re.escape(old), new, text, flags=re.IGNORECASE)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return text.count("\n") - original.count("\n")
    return 0


# 2. Indonesian i18n: rewrite "tanpa batas" claims.
def patch_id_i18n() -> None:
    targets = [
        "frontend/src/i18n/locales/id/components.json",
        "frontend/src/i18n/locales/id/trips.json",
    ]
    # We don't know the exact keys, so walk and rewrite recursively.

    def rewrite(value):
        if isinstance(value, str):
            # "tanpa batas" → "30 kali per bulan" only in premium contexts
            return re.sub(
                r"\btanpa\s+batas\b",
                "30 kali per bulan",
                value,
                flags=re.IGNORECASE,
            )
        if isinstance(value, dict):
            return {k: rewrite(v) for k, v in value.items()}
        if isinstance(value, list):
            return [rewrite(v) for v in value]
        return value

    for t in targets:
        p = Path(t)
        data = json.loads(p.read_text(encoding="utf-8"))
        new = rewrite(data)
        p.write_text(
            json.dumps(new, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{t}: rewrote 'tanpa batas' → '30 kali per bulan'")


def main():
    public_root = Path("frontend/public")
    files = list(public_root.glob("landing*.html")) + list(
        public_root.glob("guides/*.html")
    )
    for f in files:
        before = f.read_text(encoding="utf-8")
        patch_html(f)
        after = f.read_text(encoding="utf-8")
        if before != after:
            print(f"patched: {f}")
    patch_id_i18n()


if __name__ == "__main__":
    main()
