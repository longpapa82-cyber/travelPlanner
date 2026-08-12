# 블로그 확장 계획 — 실용 정보 심화 배치 (2026-08-12)

> 방향: **실용 정보 심화**(budget/prep/tips 보강) · 규모: **소규모 3~4글 × 3국어 = 9~12 HTML**
> 파이프라인: 메모리 [[blog-expansion-resume]] 6단계 재사용. AdSense 재심사 중 → 원본성·구체성 최우선.

---

## 1. 목표와 배경

- **현재 상태**: blog-content 60 slug(ko/en/ja 각 60) = 180 JSON / blog HTML 181개 / topics 60개 / 라이브 sitemap loc 214.
- **카테고리 분포**: destination 22(편중) · tips 13 · prep 11 · budget 7 · theme 7.
- **왜 실용 심화인가**:
  - destination 인기권 소진(레인 C 4차 완주) + 가이드 카니발라이제이션 위험 → 도시 추가 지양.
  - AdSense "저품질 콘텐츠" 재심사 중. seo 진단 핵심 = **양이 아니라 원본성·구체성**. 실용 정보는 **구체 수치·절차**(세율/보험종류/절차 단계)를 자연스럽게 담아 "일반론 나열" 판정을 회피.
  - budget/prep은 검색 수요 높은 롱테일 키워드 다수.

---

## 2. 주제 선정 (갭 분석 기반, 기존 60 slug와 무중복)

기존 커버 완료(중복 금지): 항공권/마일리지/숙소비/환전×2/N빵/저예산, 비자/여권/예방접종/기내반입/eSIM/짐/보험/인터넷, 시차/장거리비행/앱추천/비상상황/포토/음식/공항/문화차이/가족 등.

### 확정 후보 4개 (우선순위순)

| # | slug | 카테고리 | titleKo | 핵심 원본성 근거(구체 수치·절차) | icon |
|---|------|---------|---------|-----------------------------|------|
| 1 | `tax-refund-shopping-guide` | budget | 해외 쇼핑 세금 환급(택스리펀드) 완벽 가이드 | 국가별 부가세율(EU 20%·일본 10%), 최소구매액, 공항 환급 절차 3단계, 현금 vs 카드 환급 수수료 | coin |
| 2 | `rental-car-abroad-guide` | prep | 해외 렌터카 완벽 가이드: 예약부터 보험까지 | 국제운전면허증 발급(수수료 8,500원·유효 1년), 보험 종류(CDW/LDW/SLI), 좌측통행 국가, 연료 정책 | doc |
| 3 | `tipping-culture-by-country` | tips | 국가별 팁 문화 완벽 정리: 얼마를, 언제, 어떻게 | 미국 15~20%·유럽 5~10%·일본 팁 없음, 상황별(레스토랑/호텔/택시) 기준 | coin |
| 4 | `overseas-payment-safety` | budget | 해외 결제 안전 가이드: 카드·현금·환율 함정 | DCC(현지통화 결제) 함정, 해외 결제 수수료(1~3%), 분실 시 대처, 트래블카드 비교 | shield |

**대안 후보(1~4 중 부적합 판단 시 교체용)**:
- `airport-transit-layover-guide` (prep, 경유·레이오버 활용법) icon plane
- `travel-budget-tracking` (budget, 여행 예산 관리·가계부) icon coin
- `hotel-checkin-etiquette` (prep, 호텔 체크인·이용 실전) icon home

> ⚠️ 최종 slug/제목은 1단계(ko 작성) 착수 전 사용자 확정. 위는 근거 있는 초안.

---

## 3. related 클러스터링 계획 (broken link 0 원칙)

**규칙**(메모리 교훈): related는 **3국어 확정 글로만** 채운다. 신규 4글끼리 상호 + 기존 정본글 조합.

| 신규 글 | related 후보 (기존 정본, 3국어 확정) |
|---------|-------------------------------------|
| tax-refund-shopping-guide | currency-exchange-timing, accommodation-saving-tips, budget-travel-guide, +신규 overseas-payment-safety |
| rental-car-abroad-guide | travel-insurance-guide, roaming-vs-esim-guide, trip-planning-checklist, +신규 tipping-culture-by-country |
| tipping-culture-by-country | europe-culture-differences, local-food-guide, travel-etiquette-guide, +신규 rental-car-abroad-guide |
| overseas-payment-safety | currency-exchange-guide, travel-emergency-guide, cheap-flight-booking-guide, +신규 tax-refund-shopping-guide |

- 신규끼리 참조는 **같은 배치라 3국어 동시 생성**되므로 안전.
- 각 글 related 5개 목표(기존 글 패턴).

---

## 4. 콘텐츠 JSON 구조 (신규 작성 스키마)

정본 `claudedocs/blog-content/<slug>.<lang>.json` 필드(tokyo-3day-course 확인):
```
slug, lang, title, metaTitle, description, ogDescription,
publishedDate, category, sections[{h2, html}], adAfterSection,
related[{href, text}], alternates{ko,en,ja}
```
- sections: 6개 목표(기존 글 패턴). h2 + html(문단·리스트·강조·표).
- **정직성 불변식**(과장어 금지): instantly/perfect/unlimited/즉시/무제한 금지. 앱 기능 언급 시 코드조사 후(AI 10~90초·월 무료3/프리30·최대31일·실시간 예약/결제 안 함).
- publishedDate: 2026-08-12.
- intro: 도시코스는 "" 이지만 실용글은 리드문 있으면 intro 필드 활용 가능([[blog_legacy_intro_field_migration]]).

---

## 5. 실행 파이프라인 (6단계 — 매 배치 이대로)

1. **ko 창작**: 서브에이전트 위임. **코드/사실 조사 선행**(세율·수수료·절차는 실제값). category 정확히.
2. **related 채우기**: 위 3절 클러스터. `blog-content/*.ko.json` 존재 확인(3국어 확정글만).
3. **en/ja 번역**: 서브에이전트. 구조 100% 유지 · related href에 -en/-ja 안 붙임 · 과장어 금지.
4. **blog-topics 등록**: icon은 **ICONS 실존값만**(coin/doc/shield/plane/home 등) assert. 필드: slug/category/icon/titleKo/descKo.
5. **빌드+검증**:
   - `python3 scripts/build_blog.py articles && python3 scripts/build_blog.py index`
   - `python3 scripts/generate-blog-manifest.py`
   - `python3 scripts/validate-content.py` (**PASS 필수**)
   - broken link 전수검증 **파이썬으로**(셸 grep 이스케이프 버그).
6. **배포**:
   - blog 디렉토리 rsync(landing 무관·즉시반영) + manifest rsync
   - `docker compose build && up -d` (**sitemap = 백엔드 동적생성**이라 backend rebuild 필수)
   - ⚠️ **root prod compose로**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` (backend/ 컨텍스트는 proxy 빠져 521 다운 — 8/12 사고 교훈)
   - 라이브 200 + sitemap loc 증가 검증(214 → +12 예상 = 226).
   - git: main에서 feat 브랜치 분기(마케팅/UI 브랜치 금지)·단일커밋·PR·핵심 6 job 초록·squash 병합.

---

## 6. 예상 결과 및 검증 기준

- blog-content JSON: 180 → **192** (60→64 slug × 3lang).
- blog-topics: 60 → **64**.
- 라이브 sitemap loc: 214 → **226** (+12 = 4 slug × 3lang).
- 검증 게이트: validate-content.py PASS · broken link 0 · 라이브 9~12 URL 200 · sitemap 반영.

---

## 7. 하지 말 것 / 교훈 (메모리 압축)

- **가이드 카니발라이제이션**: 블로그=실전 절차/팁, 가이드=종합정보. 각도 분리.
- **아이콘 silent fallback**: blog-topics icon이 ICONS에 없으면 map으로 조용히 대체(에러 안 남) → 등록 시 assert.
- **broken link**: related는 3국어 확정 글만.
- **검증은 파이썬으로**: 셸 for+grep이 URL 특수문자로 오탐(0/N).
- **sitemap 이중소스**: 라이브 sitemap은 정적 아님, 백엔드 blog-manifest.ts 동적생성 → backend rebuild 필요.
- **배포 topology**: 백엔드 재배포는 root prod compose(proxy 포함).
- **git**: 기능브랜치는 main에서 분기. E2E는 non-required 기존부채라 pending이어도 핵심 6 job 초록이면 병합.
- **AdSense**: 재심사 대기 중. 신규 글은 승인 후 광고 게재. 심사 중 대규모 변경은 평가 불안정 → 소규모·고품질 유지.

---

## 8. 다음 액션

1. **사용자 확정**: 위 주제 4개(또는 대안 교체) OK 여부.
2. 확정 시 → 1단계(ko 창작) 서브에이전트 착수.
3. 각 단계 검증 통과 후 배포 → PR → 병합.
