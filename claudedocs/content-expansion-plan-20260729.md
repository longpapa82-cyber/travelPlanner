# 홍보 웹 가이드·블로그 콘텐츠 확장 상세 계획 (2026-07-29)

> 목적: mytravel-planner.com의 검색 유입(SEO) 확대 및 앱 설치 전환.
> 전제: 기존 정본 빌드 툴체인(`build_blog.py`)·6단계 공식 재사용. 새 인프라 없음.

---

## 0. 현황 진단 (2026-07-29 실사)

| 자산 | 현황 | 비고 |
|------|------|------|
| 블로그 콘텐츠 JSON | ko 36 / en 36 / ja 36 (108개) | `claudedocs/blog-content/*.json` — 재빌드 가능한 진실원천 |
| 블로그 렌더 HTML | 123개 | `frontend/public/blog/` |
| 도시 가이드 | ko 20 / **en 5** / **ja 0** | `frontend/public/guides/` — **언어 불균형 심각** |
| 레거시 ko-단일 블로그 | 15개 | JSON 없음·en/ja 없음 → broken link 위험원 |
| 툴체인 | build_blog.py / generate-blog-manifest.py / validate-content.py | 전부 정상 |
| sitemap loc | 157 | 매니페스트 자동화(파일스캔) 적용됨 |

### 3대 갭 (우선순위 결정 근거)
1. **가이드 다국어 부재** 🔴 — 도시 가이드 en 5/20, ja 0/20. 도시명 검색은 글로벌 트래픽이 큰데 한국어만 노출. 가장 큰 미회수 SEO.
2. **레거시 15개 ko-단일 글** 🟡 — 재빌드 불가(JSON 없음)·다국어 없음. 매 배치마다 broken link 유발.
3. **블로그 카테고리 편중** 🟢 — destination(도시 코스) 6개뿐. "○○ N일 코스" 검색량 큰데 커버 얕음.

---

## 1. 전략: 3개 레인 (독립 실행 가능, 병렬화 가능)

### 레인 A — 도시 가이드 다국어화 🔴 **최우선·최대 효과**
기존 ko 가이드 20개 중 en/ja 없는 것을 채운다. **새 콘텐츠 창작이 아니라 기존 검증된 ko 가이드의 번역**이므로 리스크 최소·효과 최대.

- **A-1**: en 미보유 15개 도시 → en 생성
  (amsterdam, bali, barcelona, dubai, hawaii, ho-chi-minh, istanbul, kuala-lumpur, kyoto, london, new-york, prague, rome, singapore, sydney)
- **A-2**: ja 미보유 20개 도시 전부 → ja 생성
- **효과**: 도시명 글로벌 검색 커버리지 확보. 20 도시 × 3언어 = 60 가이드 완성 목표.
- **주의**: 가이드가 `build_blog.py`로 렌더되는지 vs 수기 HTML인지 **선(先)확인 필요**(블로그와 빌드 경로 다를 수 있음 — Phase 0에서 검증).

### 레인 B — 레거시 15개 글 정본화 🟡 **부채 상환**
JSON 없는 ko-단일 글 15개를 `blog-content` JSON으로 역이관 → 재빌드 가능화 + en/ja 추가.

- **B-1**: 15개 글을 JSON 스키마로 이관(기존 HTML에서 콘텐츠 추출)
- **B-2**: en/ja 생성 → broken link 위험원 **영구 제거**
- **효과**: 매 배치 broken link 방어 부담 소멸 + 45개(15×3) 다국어 자산화
- **판단 포인트**: 15개 중 **콘텐츠 품질·검색가치 낮은 글은 제외**하고 선별(전수 이관 아님). Phase 0에서 각 글 실측 후 결정.

### 레인 C — 신규 블로그 글 (콘텐츠 갭) 🟢 **성장**
검색 수요 있으나 미커버 주제 신규 창작. 앱 핵심기능 연계 우선.

- **C-1 (앱 연계·전환가치 高)**: 아직 안 다룬 앱 기능 각도
  - 예: "AI 여행 일정 수정하는 법 심화", "여행 예산 초과 막는 법", "혼자 vs 함께 여행 계획 차이"
- **C-2 (정보성·검색량 高)**: 도시 코스 확장("○○ N일 코스" 시리즈), 계절/테마 심화
- **효과**: 신규 유입 키워드 확대. 배치당 3~5편 권장(과확장 금지).

---

## 2. 실행 공식 (레인 공통 — 기존 6단계 재사용)

> 출처: [[blog_content_expense_split]] 검증된 공식

1. **콘텐츠 작성**: `claudedocs/blog-content/<slug>.<lang>.json` (ko/en/ja).
   스키마: slug, lang, title, metaTitle, description, ogDescription, publishedDate,
   category(`ai|destination|prep|budget|theme|tips`), sections[{h2,html}],
   adAfterSection, related[{href,text}], alternates{ko,en,ja}.
2. **인덱스 등록**: `claudedocs/blog-topics.json`의 `topics[]`에 추가 (누락 시 ko 인덱스 카드 안 뜸).
3. **빌드**: `python3 scripts/build_blog.py articles && python3 scripts/build_blog.py index`.
4. **sitemap**: `python3 scripts/generate-blog-manifest.py`.
5. **검증**: `python3 scripts/validate-content.py` + backend `npx tsc` + `npx jest app.controller`
   + **broken link 전수검증**(존재 파일 대조 — 필수).
6. **배포**: 블로그/가이드 HTML **선별 rsync**(전체 public rsync 금지) + sitemap 위해 backend rsync + `docker compose build backend && up -d`.

---

## 3. 콘텐츠 정직성 규칙 (위반 시 validate-content 실패 + 사용자 기만)

- **앱 기능 서술은 코드 먼저 조사**. 실제 구현만 서술.
  - 있음: 균등/개별 분할·최소송금 정산(greedy)·이메일 초대·EDITOR/VIEWER·shareToken 공유·AI 30회/월
  - 없음(→"앱이 안 하는 것"으로 명시): 자동송금·영수증 OCR·환율 자동변환·실시간 동시편집·댓글·초대 수락/거절
- **광고법 금지어 회피**(`blog-facts.md` 불변식): 과장·미구현 광고·AI 생성시간 약속 문구 금지.
- **회사명**: KO 표면 "에이아이소프트", 저작권 푸터는 로마자 `© 2026 AI Soft` 유지.
- **날짜**: datePublished 미래날짜 금지, 단일연도 2026.

---

## 4. broken link 근본 회피 (반복 교훈)

- 레거시 15개 ko-단일 글을 related로 걸 때 `-en`/`-ja` 붙이면 **broken**.
- 방어: `blog-topics.json`의 `meta.existingKoSlugs` 참조 회피 + **빌드 후 broken 전수검증**.
- **레인 B가 완료되면 이 위험 자체가 소멸** → 레인 B를 레인 C보다 먼저 하면 이후 배치가 편해짐.

---

## 5. 권장 스프린트 순서

| 순서 | 작업 | 산출 | 근거 |
|------|------|------|------|
| **S0** | Phase 0 검증: 가이드 빌드 경로·레거시 15글 품질 실측 | 판단 자료 | 계획 확정 전 필수 |
| **S1** | 레인 A (가이드 다국어) | en 15 + ja 20 = 35개 | 최대 효과·최소 리스크(번역) |
| **S2** | 레인 B (레거시 정본화) | JSON 15 + en/ja 30 | broken 위험 영구 제거 |
| **S3** | 레인 C (신규 3~5편×3언어) | 9~15개 | 성장 |

> 각 스프린트는 독립 배포 가능. 한 번에 다 안 해도 됨. S1만으로도 즉시 가치.

---

## 6. 성과 측정 (KPI)

- sitemap loc 증가분 (S1: +35, S2: +45, S3: +9~15 예상)
- Search Console 신규 색인 페이지 수·노출수(impressions)
- 도시 가이드 en/ja 유입 (신규 채널)
- 배치별 broken link = 0 유지

---

## 7. 리스크·주의

- **가이드 빌드 경로 미확인**: 블로그는 `build_blog.py`지만 가이드는 별도일 수 있음 → S0에서 확인 후 툴 정비 여부 결정. (가이드용 렌더러가 없으면 소규모 렌더러 추가 or 수기 — S0 결과로 판단)
- **rate-limit**: 대량 생성 시 tail에서 rate-limit 폭주([[blog_bulk_expansion]] 교훈). 배치 크기 제한 + verify 시 콘텐츠 보존 fallback.
- **서버≠git 드리프트**: backend rsync 시 `--delete` 신중(고아 파일 백업 후). sitemap 배포 시 재현 주의.
- **전체 public rsync 금지**: 미병합 landing 회귀 위험 → 항상 선별 rsync.
- **번역 품질**: 기계번역 티 나면 SEO/UX 손해 → 자연스러운 현지화 필요(특히 ja).

---

## 8. 다음 액션 (사용자 결정 필요)

이 계획 중 **어느 레인부터** 실행할지 결정해 주세요:
- **A만** (가이드 다국어) — 가장 빠른 SEO 효과
- **A+B** (다국어 + 부채상환) — 이후 작업 편해짐
- **전체(A+B+C)** — 최대 확장
- 또는 **S0(Phase 0 검증)만 먼저** 돌려 가이드 빌드 경로·레거시 품질 확인 후 재결정

---

## 9. S0 검증 결과 (2026-07-29 실측 완료) — 계획 확정

### 검증으로 뒤바뀐 사실
- **가이드는 수기 HTML** (`build_blog.py`는 블로그 전용, 가이드용 렌더러 없음). 가이드 다국어화는 고비용 → **별도 세션으로 미룸**.
- **블로그 툴체인은 저비용·자동화 유효** → 사용자 결정: **레인 B+C 우선**.
- 레거시 15글 전부 본문 4,500~8,800자·h2 6~13개 = **저품질 stub 없음 → 15개 전수 이관 가치 있음**.
- 레거시 글은 **hreflang이 없음** → JSON 이관 시 SEO 다국어 신호까지 자동 획득.

### 렌더러 개선 (완료)
- `build_blog.py`에 **optional `intro` 필드** 추가(`data.get('intro','')`). 원본의 "h1 → 제목없는 리드문 → h2" 구조 100% 보존. 기존 108개 글은 intro 키 없음 → **바이트 동일 확인**(회귀 0).

### 파일럿 완료: budget-travel-guide (ko)
- HTML→JSON 추출 → 재렌더 검증 통과: h1→intro→h2 순서 유지, h2 11개, 광고슬롯 보존, **hreflang ko/en/ja/x-default 자동 생성**(원본엔 없던 SEO 개선).
- related 링크는 **3국어 존재 확정 글로 교체**(broken 원천 차단).

### 남은 작업 (레인 B)
- 레거시 14글 ko JSON 이관 + 15글 전체 en/ja 생성(30개) + blog-topics.json 등록 + 빌드/검증/배포.
- 분량이 크므로 병렬 서브에이전트 처리 권장. 각 글마다 broken 전수검증 필수.

관련 메모리: [[blog_content_expense_split]], [[blog_bulk_expansion]], [[sitemap_manifest_automation]]
