# 홍보 웹 블로그 대량 업데이트 — 상세 실행 계획

> 작성일: 2026-07-10 · 대상: `frontend/public/blog/` (정적 HTML 블로그)
> 범위(사용자 확정): **① 새 글 대량 추가 + ② 기존 글 개선 + ③ 영어(다국어) 블로그 추가 + ④ 디자인·구조 일괄 개편**
> 작성 방식: **AI 병렬 자동 생성** · 규모: **30개+** (대규모)

---

## 0. 현황 파악 (Discovery 결과)

| 항목 | 사실 |
|------|------|
| 블로그 형태 | **100% 정적 HTML** — CMS/템플릿 엔진 없음. 파일마다 `<style>`·JSON-LD·AdSense·헤더/푸터 **전량 중복** |
| 기존 글 수 | **16개** (`blog/*.html`, 총 ~5,807 lines), 전부 `lang="ko"` |
| 영어 블로그 | **없음** (guides는 `-en` 변형 있으나 blog는 미적용) |
| 라우팅 | `nginx.conf` L241·248: `/blog`→`index.html`, `/blog/<slug>`→`<slug>.html` (정규식 `[a-z0-9-]+`) |
| 사이트맵 | `sitemap.xml`에 blog 16 entry 등록됨 |
| **CI 게이트** | **`scripts/validate-content.py`** — 모든 `public/*.html`의 금지어(무제한 AI, 100+ 통화, 체크리스트, "5초 만에", enterprise-grade, Paddle, 제휴 브랜드…) 스캔 → 위반 시 **CI 실패** |
| 배포 | 정적 `public/` → **rsync + frontend 이미지 재빌드** (앱 빌드/OTA 불필요, 전 방문자 즉시 반영) |

### 아키텍처적 핵심 리스크 3가지
1. **중복 드리프트**: 공유 partial이 없어 30개 글이 헤더/푸터/CSS를 각각 복제 → 일관성 깨지기 쉬움.
2. **CI 콘텐츠 검증**: AI가 자연히 쓰는 마케팅 표현("무제한", "세계 최고")이 곧 CI 위반. **생성 프롬프트에 사실 불변식을 강제**해야 함.
3. **URL·사이트맵·index 동기화**: 글 하나 추가 = HTML 파일 + `blog/index.html` 카드 + `sitemap.xml` entry + 관련글 내부링크 **4곳** 동시 갱신 필요.

---

## 1. 목표 & 성공 기준

**목표**: myTravel 블로그를 16개(KO) → **KO 30~46개 + EN 30~46개** 규모로 확장하고, 공유 구조로 리팩터해 유지보수성과 SEO 커버리지를 동시에 끌어올린다.

**성공 기준 (Definition of Done)**
- [ ] 신규/기존 전 글이 `validate-content.py` **통과** (금지어 0)
- [ ] 각 글에 유효한 JSON-LD(`BlogPosting`)·canonical·OG·hreflang(KO↔EN 상호) 존재
- [ ] `blog/index.html`이 전 글 카드 포함, `sitemap.xml`이 전 URL 포함
- [ ] nginx 라우팅 정규식(`[a-z0-9-]+`)에 맞는 slug만 사용
- [ ] 모바일(≤768px) 레이아웃 깨짐 없음, AdSense 슬롯 정상
- [ ] 사실 정합성: AI 30회/월, 통화 7종, 미구현 기능 언급 0

---

## 2. 콘텐츠 전략 (30개+ 주제 설계)

기존 index가 명시한 5개 카테고리를 축으로 확장. **목적지 심층(destination)** 이 SEO 롱테일에 가장 강력 → 비중 확대.

| 카테고리 | 기존 | 신규 후보 (예시) | 목표 |
|----------|------|------------------|------|
| 여행 준비 | 짐싸기, 보험, 인터넷 | 비자 가이드, 여권 갱신, 예방접종, 로밍 vs eSIM | 6~8 |
| 예산 관리 | 저예산, 환율 | 항공권 싸게 사는 법, 마일리지, 숙소 절약, 환전 타이밍 | 5~7 |
| 혼자/테마 여행 | 첫 혼행, 가족, 장기 | 여성 혼행 안전, 워케이션, 시니어 여행, 반려동물 동반 | 5~7 |
| AI 활용 | AI 5팁 | AI 일정 커스터마이징, AI로 예산 짜기, AI 맛집 추천 활용 | 3~4 |
| 목적지 심층 | (guides에 27개) | 블로그형 "3박4일 코스", "현지인 추천", 계절별 베스트 | 8~12 |
| 실용 팁 | 사진, 저널, 문화차이, 공항, 교통패스, 우기 | 시차적응, 기내 꿀팁, 여행 앱 추천, 비상상황 대처 | 6~8 |

> **주제 확정 방식**: 위 표 기반으로 실제 slug 리스트(30~46개)를 별도 `blog-topics.json`에 확정 → 각 글의 title/slug/description/category/relatedLinks를 미리 정의(= 생성 입력). 키워드는 네이버/구글 검색량 고려(메모리 `naver_search_registration.md` 참조).

---

## 3. 실행 단계 (Phase 0~6)

### Phase 0 — 템플릿 추출 & 사실 스펙 확정 (선행 필수)
**왜 먼저**: 30개를 복제-생성하기 전에 "정본 1개"를 못 박아야 드리프트를 원천 차단.
- `blog/_template.html` (커밋 제외 or 주석 표식) 또는 생성 스크립트 내 상수로 **헤더/푸터/CSS/JSON-LD 골격** 1벌 확정.
- **`blog-facts.md`** 작성: AI 30회/월, 통화 7종, 미구현 기능 목록, 금지 표현 목록(= `validate-content.py`에서 역추출). → 모든 생성 프롬프트에 주입.
- `blog-topics.json` 확정 (slug·title·desc·category·published_date·relatedLinks).

**산출물**: 템플릿 1, facts 1, topics 1. **코드 변경 없음(문서·설정).**

### Phase 1 — 구조·디자인 일괄 개편 (기존 16개 대상)
- 공유 CSS/헤더/푸터를 **단일 정본으로 통일** (현재 미세 차이 존재: index는 `/login`, 기사들은 `/trips/create` 로그인 링크 등).
- `index.html`을 **자동 생성형**으로 전환: `blog-topics.json`을 읽어 카드 그리드를 렌더하는 빌드 스크립트(`scripts/build-blog-index.py`) 도입 → 이후 글 추가 시 index 수동 편집 불필요.
- **결정 필요**: 리디자인 강도 (아래 §5 열린 질문).

### Phase 2 — 신규 KO 글 대량 생성 (병렬 Workflow)
- **파이프라인**: `주제 → 생성(템플릿+facts 주입) → 자가검증(facts 대조) → validate-content 통과 확인 → 관련글/사이트맵 갱신`.
- 병렬 팬아웃(동시 ~8~16개). 각 글 독립 → 실패 시 해당 글만 재생성.
- 생성 후 **`validate-content.py`를 파일 단위로 즉시 실행** (게이트를 커밋 전으로 당김).

### Phase 3 — 영어(다국어) 블로그 추가
- **결정 필요**: 영어만 vs 전체 다국어 (§5). 기본안 = **EN 우선**(트래픽 ROI).
- slug 규칙: `<slug>-en.html` (guides 패턴 계승) 또는 `blog/en/<slug>.html` 하위디렉토리.
  - guides는 `-en` 접미사 방식 → **일관성 위해 `-en` 채택** 권장. nginx 정규식 이미 매칭(`ai-travel-planning-tips-en`).
- KO↔EN **hreflang 상호 링크** + canonical 분리 필수.
- 번역이 아닌 **로컬라이즈**(영어권 독자 맥락) 지향.

### Phase 4 — 기존 16개 글 개선
- 본문 최신성·내부링크·CTA 갱신, JSON-LD `dateModified` 갱신.
- 신규 글과의 **상호 관련글 링크** 재편(고아 글 방지).

### Phase 5 — 통합 & 검증
- `blog/index.html` 재생성(전 글 카드).
- `sitemap.xml` 재생성(전 URL + hreflang). → `scripts/build-sitemap` 확장 권장.
- **전체 `validate-content.py` 실행** + 링크 무결성 체크(깨진 내부링크·slug 오타) + 모바일 스냅샷(브라우저).

### Phase 6 — 배포
- 선별 rsync (blog/ + sitemap.xml) → **frontend 이미지 재빌드** (CLAUDE.md 배포 명령).
- 라이브 검증: `/blog`, 신규 slug 몇 개, `/blog/<slug>-en`, sitemap 200.
- **PR 분리**: 구조개편(Phase1) / 신규글(Phase2-3) / 개선(Phase4)을 **별도 PR**로 → 리뷰 용이·롤백 안전.

---

## 4. 자동화 설계 (Workflow 제안)

병렬 생성은 **Workflow 도구**(다중 에이전트 오케스트레이션)에 최적. 단, 토큰 대량 소모 → **명시적 승인 필요**.

```
pipeline(topics[],
  1) generate:  템플릿+facts 주입해 글 HTML 생성
  2) self-check: facts.md 대조 자가검증(금지어/사실 오류)
  3) validate:  validate-content.py 규칙 재확인
) → index/sitemap 일괄 재생성(배리어)
```
- 각 글이 stage1에서 생성되는 즉시 stage2 검증 진입(배리어 없음) → 벽시계 최소화.
- index·sitemap 재생성만 **전 글 필요**하므로 마지막에 배리어 1회.

> 실행하려면 `ultracode` 또는 "워크플로 실행" 명시 요청 필요. 미지정 시 소규모 배치(에이전트 수동 팬아웃)로 진행 가능.

---

## 5. 결정이 필요한 열린 질문

1. **리디자인 강도** (Phase 1): (A) 현 디자인 유지·구조만 통일 / (B) 카드·타이포·컬러 톤업 / (C) 풀 리디자인(에디토리얼).
2. **다국어 범위** (Phase 3): (A) EN만 / (B) EN+JA / (C) 17개 언어 전체(대규모·비추천).
3. **slug 규칙**: `-en` 접미사(guides 계승) vs `blog/en/` 하위디렉토리.
4. **최종 글 수**: 30 / 40 / 46 (topics.json에서 확정).
5. **index 자동생성 도입 여부**: 스크립트화(권장) vs 수동 편집 유지.
6. **회사명 표기**: 푸터 `© 2026 AI Soft` 유지 확인 (메모리상 KO는 "에이아이소프트" 정정 이력 — 블로그 신규 KO 글도 동일 정책 적용할지).

---

## 6. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| CI 콘텐츠 검증 실패 | 배포 차단 | facts 주입 + 파일단위 validator 선실행 |
| 중복 CSS 드리프트 | 디자인 불일치 | Phase 0 정본 템플릿 + index 스크립트화 |
| 사실 오류(할루시네이션) | 신뢰도·법적 | facts 대조 자가검증 stage |
| 내부링크 고아/오타 | SEO 손실 | Phase 5 링크 무결성 체크 |
| main 미병합 브랜치 회귀 | 배포 사고 | **기능 브랜치는 main에서 분기**(메모리 반복 교훈), 선별 rsync |
| 토큰 대량 소모 | 비용 | 규모·Workflow 실행 전 명시 승인 |

---

## 7. 다음 액션 (권장 순서)
1. §5 열린 질문 6개 답변 → 범위 확정.
2. Phase 0 산출물 작성(topics.json · facts.md · 템플릿).
3. Phase 1 구조개편 PR (소규모·저리스크, 먼저 병합해 기반 확보).
4. Phase 2~3 병렬 생성(Workflow 승인 시).
5. Phase 4~6 개선·검증·배포.
