"""
V189 P1 (콘텐츠 #3): store-metadata 절대표현 + 시간 약속 정리.

en/ko/es 3개 locale의 description에서 'perfect trip' / 'instantly' / '완벽한 여행'
같은 절대 표현 + 검증 불가능한 시간 약속을 사실적 표현으로 교체.

Play 정책 8.3 (오해 소지 광고) + 한국 표시광고법 §3 (절대적 표현 금지) 직접
적용 영역. validate-content.py 검사 영역 외였음.
"""

import json
from pathlib import Path

REPLACEMENTS = {
    "ko": {
        "마이트래블로 완벽한 여행을 계획하세요!": "마이트래블로 맞춤 여행을 계획하세요!",
        "여행지, 날짜, 예산만 입력하면 최적의 일정이 완성됩니다.": "여행지, 날짜, 예산을 입력하면 AI가 맞춤 일정을 생성합니다.",
    },
    "en": {
        "Plan your perfect trip with MyTravel!": "Plan your personalized trip with MyTravel!",
        "and get an optimized travel plan instantly.": "and AI generates a tailored travel plan for you.",
    },
    "es": {
        "¡Planifica tu viaje perfecto con MyTravel!": "¡Planifica tu viaje personalizado con MyTravel!",
        "para obtener un plan de viaje optimizado al instante.": "y la IA generará un plan de viaje a tu medida.",
    },
}

base = Path("frontend/store-metadata")
for locale, repls in REPLACEMENTS.items():
    path = base / f"{locale}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    desc = data.get("description", "")
    changed = False
    for old, new in repls.items():
        if old in desc:
            desc = desc.replace(old, new)
            changed = True
    if changed:
        data["description"] = desc
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{locale}: updated description")
    else:
        print(f"{locale}: SKIP (already updated)")
