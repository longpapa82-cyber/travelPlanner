# Obsidian Dependency Graph 생성 계획 (Read-Only Plan)

> **이 문서는 계획서입니다.** 실제 `obsidian.md` 생성은 이 계획에 대한 사용자 승인 후 별도 단계로 진행합니다.
> **절대 어떤 소스 코드도 수정하지 않습니다.** 모든 작업은 읽기 전용입니다.

---

## 0. 목적 및 배경

사용자는 myTravel(실제: travelPlanner) 프로젝트의 **전체 개발 소스 코드 간 import/dependency 그래프**를 Obsidian의 `[[wiki-link]]` 문법으로 표현한 문서를 생성하고자 합니다. 목표는 Obsidian의 Graph View에서 노드-엣지 형태로 프로젝트 구조를 시각화하는 것입니다.

### 산출물
- **1차 산출물(이 단계)**: `docs/obsidian-graph-plan.md` (본 문서, 계획 전용)
- **2차 산출물(승인 후 실행 단계)**: `docs/obsidian-graph/obsidian.md` (+ 선택적으로 `docs/obsidian-graph/backend.md`, `frontend.md`, `shared.md` 등 카테고리 MOC)

### 수정 대상 파일
- `docs/obsidian-graph-plan.md` **만** 생성 (이 문서)
- 2차 단계에서는 `docs/obsidian-graph/` 폴더 하위 파일**만** 생성
- 그 외 **모든** 프로젝트 파일은 읽기 전용

---

## 1. Safety First — 읽기 전용 보장

### 1.1 허용 도구 (White-list)
| 도구 | 용도 | 허용 여부 |
|---|---|---|
| `Glob` | 파일 인벤토리 수집 | O |
| `Grep` | import 패턴 추출 | O |
| `Read` | 개별 파일 내용 확인 (필요 시) | O |
| `Write` | `docs/obsidian-graph/` 하위 파일 생성만 | 제한적 O |
| `Edit` | **금지** (기존 코드 변경 불가) | X |
| `Bash` (수정 명령) | `rm`, `mv`, `sed -i`, `git add/commit`, `git restore` 등 | X |
| `Bash` (읽기 전용) | `git status`, `git diff`, `wc -l` | O |

### 1.2 제외 디렉토리/파일 패턴 (절대 읽지 않음)
```
**/node_modules/**
**/dist/**
**/build/**
**/coverage/**
**/.git/**
**/uploads/**
**/*.env*
**/tripplanner-*.json              # Service Account key (보안)
**/*-service-account*.json         # 보안
**/*.png **/*.jpg **/*.jpeg **/*.gif **/*.webp
**/*.lock **/package-lock.json **/yarn.lock
**/.expo/** **/.next/**
```

### 1.3 작업 전후 변경 0건 검증
- **Step 0 (사전)**: `git status --short > /tmp/obsidian-pre.txt`
- **Step 최종 (사후)**: `git status --short > /tmp/obsidian-post.txt`
- **검증**: `diff /tmp/obsidian-pre.txt /tmp/obsidian-post.txt` → `docs/obsidian-graph/` 하위 신규 파일 외에 차이가 없어야 함
- 기존 파일 수정 건이 0임을 확인하기 전까지는 완료로 간주하지 않음

### 1.4 보안 절대 규칙
- `.env*`, Service Account JSON, `uploads/` 하위 파일은 **Glob 결과에서 필터링**하고 **절대 Read 하지 않음**
- 만약 Grep 결과에 민감 정보가 포함될 조짐이 보이면 즉시 중단하고 사용자에게 보고

---

## 2. 출력 위치 결정

### 2.1 권장 위치
```
docs/obsidian-graph/
├── obsidian.md           # 메인 MOC (Map of Content) + 전체 인덱스
├── backend.md            # (옵션) Backend 카테고리 MOC
├── frontend.md           # (옵션) Frontend 카테고리 MOC
└── shared.md             # (옵션) 공용 유틸/타입 카테고리 MOC
```

**이유**:
- 프로젝트 내부(`docs/`)에 두면 git으로 추적/리뷰/롤백 가능
- Obsidian Vault를 프로젝트 루트로 열면 그대로 Graph View 작동
- 별도 Vault로 복사하려면 `docs/obsidian-graph/` 폴더만 복사하면 됨

### 2.2 대안: 외부 Obsidian Vault
사용자가 이미 별도 Vault를 운영 중이라면 다음 중 선택:
- **옵션 A (권장)**: 일단 `docs/obsidian-graph/`에 생성 → 사용자가 수동으로 Vault에 복사/심볼릭 링크
- **옵션 B**: 사용자가 절대 경로(`/Users/hoonjaepark/ObsidianVault/travelPlanner/`)를 제공 → 해당 경로에 직접 생성 (단, 이 경우 프로젝트 git 기록에는 남지 않음)

**결정 필요**: Step 0 승인 시 사용자가 A/B 중 선택. 미지정 시 A 기본값.

---

## 3. 수집 전략 — Phase A ~ E

### Phase A. 파일 인벤토리
**목표**: 분석 대상 TypeScript 소스 파일 전체 목록 확보

**도구**: `Glob`
**패턴**:
```
backend/src/**/*.ts         # NestJS TypeScript 전체
frontend/src/**/*.{ts,tsx}  # React Native TSX 포함
frontend/App.tsx            # 루트 엔트리
```

**제외 후처리** (코드에서 필터):
- `*.spec.ts`, `*.test.ts`, `*.test.tsx`, `__tests__/**` → 그래프에서 제외할지 사용자 결정 필요 (기본: 제외, 테스트는 별도 서브 그래프 옵션)
- `*.d.ts` → 제외

**예상 규모 (실측 기반 추정)**:
| 영역 | 파일 수 (대략) |
|---|---|
| backend/src (테스트 제외) | ~120 |
| backend/src (테스트 포함) | ~150 |
| frontend/src (테스트 제외) | ~180 |
| frontend/src (테스트 포함) | ~200 |
| **합계 (테스트 제외, 기본)** | **~300** |

**성공 기준**: 파일 경로 배열 확보, 제외 패턴 적용 확인.

---

### Phase B. Import 관계 추출
**목표**: 각 파일의 `import ... from '...'` 구문에서 의존 대상 경로 추출

**도구**: `Grep` (`output_mode: "content"`, `-n: true`)
**패턴**: `^import\s+.*\s+from\s+['"]([^'"]+)['"]`

보조 패턴:
- `^import\s+['"]([^'"]+)['"]` (side-effect import: `import 'polyfill'`)
- `require\(['"]([^'"]+)['"]\)` (일부 JS 호환 코드)

**정규화 규칙**:
1. **상대 경로 (`./`, `../`)** → 현재 파일 디렉토리 기준으로 절대 프로젝트 경로로 변환
2. **tsconfig paths alias** (예: `@/common/...`) → tsconfig.json의 `paths` 읽어서 실제 경로로 치환
3. **확장자 복원**: `import './foo'` → `./foo.ts` 또는 `./foo/index.ts` (파일 존재 여부로 결정)
4. **외부 패키지**: `@nestjs/common`, `react-native` 등은 별도 분류 (선택적 노드화)

**Barrel re-export 처리**:
- `export { X } from './x'` 형태의 `index.ts`는 경유 노드로 그대로 표시 (단순화)
- 정밀 분석 모드(옵션)에서는 barrel을 pass-through로 해석

**성공 기준**: 각 파일 → [대상 파일 리스트] 매핑(JSON/Map 형태로 메모리 내 생성).

---

### Phase C. 노드 분류 (Grouping)
**목표**: 그래프 가독성을 위해 노드를 카테고리로 태깅

**분류 규칙**:
| 카테고리 | 경로 패턴 | Obsidian tag |
|---|---|---|
| Backend Module | `backend/src/{module}/**` (module = auth, trips, users, ...) | `#backend/{module}` |
| Backend Common | `backend/src/common/**` | `#backend/common` |
| Backend Config | `backend/src/config/**` | `#backend/config` |
| Backend Migration | `backend/src/migrations/**` | `#backend/migration` |
| Frontend Screen | `frontend/src/screens/**` | `#frontend/screen` |
| Frontend Component | `frontend/src/components/**` | `#frontend/component` |
| Frontend Service | `frontend/src/services/**` | `#frontend/service` |
| Frontend Context | `frontend/src/contexts/**` | `#frontend/context` |
| Frontend Hook | `frontend/src/hooks/**` | `#frontend/hook` |
| Frontend Navigation | `frontend/src/navigation/**` | `#frontend/navigation` |
| Frontend Util | `frontend/src/utils/**`, `frontend/src/common/**` | `#frontend/util` |
| Frontend i18n | `frontend/src/i18n/**` | `#frontend/i18n` |
| External | `node_modules` 상주 패키지 | `#external` (옵션) |

**성공 기준**: 모든 노드가 1개 이상의 카테고리 태그 획득.

---

### Phase D. Obsidian 문법 변환
**목표**: 각 파일 노드 → Obsidian 링크 문법으로 직렬화

**노드 ID 규칙** (파일 경로 → 노트 제목):
- `backend/src/auth/auth.service.ts` → `[[backend.auth.auth.service]]` (점 구분) 또는 `[[backend/auth/auth.service]]` (슬래시 유지)
- **권장**: 슬래시 유지 → Obsidian에서도 폴더 구조 가독성 유지 (`[[backend/auth/auth.service]]`)
- 확장자 `.ts`, `.tsx`는 노드 이름에서 생략

**표현 형식 선택** (3가지 옵션):

#### 옵션 D-1: 단일 파일, 헤딩 + 링크 목록 (권장, 저비용)
```markdown
## [[backend/auth/auth.service]]
Tags: #backend/auth
Imports:
- [[backend/users/users.service]]
- [[backend/common/utils/sanitize]]
- [[backend/config/jwt.config]]

## [[backend/auth/auth.controller]]
Tags: #backend/auth
Imports:
- [[backend/auth/auth.service]]
- [[backend/auth/dto/login.dto]]
...
```
- **장점**: 단일 파일, 구현 간단, Graph View에서 헤딩 기반 링크로 작동
- **단점**: 파일이 수천 줄(300 파일 × 평균 5 import ≈ 1500~2000줄) → Obsidian 로드 느릴 수 있음
- **Graph View 동작**: Obsidian은 **헤딩 링크**(`[[note#heading]]`)는 그래프에서 별도 노드로 보지 않음. 이 방식은 **모든 import가 `obsidian.md` 하나의 노드에서 나가는 형태**가 되어 진짜 그래프가 아님 → **부적합**

#### 옵션 D-2: 파일당 1개 노트 (진짜 그래프, 권장)
```
docs/obsidian-graph/
├── obsidian.md                              # MOC 인덱스
├── nodes/
│   ├── backend/auth/auth.service.md
│   ├── backend/auth/auth.controller.md
│   ├── frontend/screens/main/HomeScreen.md
│   └── ... (~300개)
```
각 노트 내용:
```markdown
---
tags: [backend/auth]
aliases: [auth.service]
---
# backend/auth/auth.service

**Path**: `backend/src/auth/auth.service.ts`

## Imports
- [[backend/users/users.service]]
- [[backend/common/utils/sanitize]]
- [[backend/config/jwt.config]]

## Imported By
- [[backend/auth/auth.controller]]
- [[backend/auth/strategies/jwt.strategy]]
```
- **장점**: Obsidian Graph View가 **완전한 그래프**로 렌더링 (각 파일이 독립 노드). 양방향 링크(Imported By) 자동 역추적 가능. MOC 패턴 자연스러움
- **단점**: ~300개 파일 생성 → 디렉토리 구조 관리 필요. 생성 시간 약간 증가
- **Graph View 동작**: **진짜 파일-파일 그래프** ✅
- **권장도**: ⭐⭐⭐ **최적**

#### 옵션 D-3: 카테고리당 1개 노트 (타협안)
- `backend-auth.md`, `backend-trips.md`, `frontend-screens.md` ... ~20개
- 각 노트에 카테고리 내부 파일 목록 + cross-category 링크
- **Graph View 동작**: 카테고리 수준 그래프 (파일 단위 아님)
- **권장도**: ⭐ (사용자가 원한 "소스 코드 연결 구조"와 거리 있음)

**결정**: **옵션 D-2 (파일당 1개 노트)**를 기본 권장. 사용자가 파일 수 폭발이 부담스럽다고 판단하면 D-3 전환 옵션 제공.

---

### Phase E. 메인 MOC (obsidian.md) 구조
**목표**: 사용자가 진입했을 때 전체 구조 파악 가능한 허브 노트

**내용**:
```markdown
# myTravel (travelPlanner) Dependency Graph

생성일: 2026-04-14
파일 수: ~300
Import 엣지 수: (실측 후 기입)

## Categories

### Backend
- [[backend]] (Backend 전체 MOC)
- #backend/auth — 인증/인가 모듈
- #backend/trips — 여행 도메인
- #backend/users — 사용자 관리
- ...

### Frontend
- [[frontend]] (Frontend 전체 MOC)
- #frontend/screen — 화면 컴포넌트
- #frontend/component — 재사용 UI
- ...

## Entry Points (루트 노드)
- [[backend/main]]
- [[frontend/App]]

## Top Hub Files (피인용 상위 10)
(Phase B 결과에서 imported-by 카운트 내림차순)
1. [[backend/common/utils/sanitize]] (N회)
2. [[frontend/services/api]] (N회)
...

## 사용법
- Obsidian Vault로 `docs/obsidian-graph/` 폴더를 열어주세요.
- Graph View (⌘G) → Filters에서 태그로 필터링하면 Backend/Frontend만 볼 수 있습니다.
- 각 노트의 "Imported By" 섹션은 역방향 참조입니다.
```

---

## 4. 규모 추정 및 위험

### 4.1 규모
| 항목 | 추정치 |
|---|---|
| 분석 파일 수 | ~300 (테스트 제외) |
| 평균 import 수 / 파일 | 5~8 |
| 총 엣지 수 | 1,500 ~ 2,400 |
| 생성 노트 수 (옵션 D-2) | ~300 + 인덱스 3~5 |
| 총 신규 파일 용량 | ~500KB ~ 1MB |

### 4.2 위험
| 위험 | 영향 | 완화책 |
|---|---|---|
| 파일 300개 생성 시간 | 중 (Write 호출 300회) | 배치 생성 스크립트 대신 **집약 단일 파일 생성 Python 없이 Write 도구로**; 단 Write 300회는 허용 범위. 대안: 옵션 D-2 대신 D-1 또는 D-3 | 
| tsconfig paths alias 해석 오류 | 중 | tsconfig.json 먼저 Read → alias map 구축 → 못 찾는 import는 `unresolved` 태그 | 
| barrel re-export 정확도 | 저 | 기본은 barrel을 일반 노드로 처리. 정밀 모드는 옵션 | 
| 외부 패키지 노드 폭발 | 중 | 기본: 외부 패키지는 **노드화하지 않음**. 옵션으로 태그만 부여 | 
| `.env`, Service Account JSON 실수 Read | 높음 (보안) | Glob 단계 제외 패턴 + Read 호출 전 경로 검증 | 
| 기존 파일 실수 수정 | 높음 (데이터 손실) | Write 대상 경로가 `docs/obsidian-graph/` prefix인지 매 호출 전 검증 | 
| obsidian.md 단일 파일 비대화 (옵션 D-1 선택 시) | 저 | D-2로 분산 |

### 4.3 성능 예측
- Glob 2회 (backend, frontend): ~1초
- Grep import 추출: 파일당 1회 = 300회 → **병렬 배치**로 ~2~3분 (또는 단일 multiline Grep 1회로 축약)
- Write 생성: 옵션 D-2는 ~300회 Write → 5~10분
- 사후 git diff 검증: ~1초

**총 소요 예상**: 10~20분

---

## 5. 단계별 실행 계획 (Step 1 ~ Step 7)

> 각 Step은 **사용자 승인 후** 개별 실행합니다. 한 번에 일괄 실행하지 않습니다.

### Step 1. 사전 안전 확인
- **도구**: `Bash` (읽기 전용)
- **명령**:
  - `git status --short > /tmp/obsidian-pre.txt`
  - `git rev-parse HEAD > /tmp/obsidian-pre-commit.txt`
  - `cat backend/tsconfig.json` (paths alias 파악)
  - `cat frontend/tsconfig.json` (paths alias 파악)
- **예상 출력**: 현재 working tree 상태 스냅샷, tsconfig paths 맵
- **롤백**: 없음 (읽기만)
- **성공 기준**: 스냅샷 파일 생성, tsconfig paths 2개 확보
- **중단 조건**: 없음

### Step 2. 파일 인벤토리 수집
- **도구**: `Glob`
- **명령**:
  - `backend/src/**/*.ts`
  - `frontend/src/**/*.{ts,tsx}`
  - 추가: `frontend/App.tsx`
- **후처리**: `.spec.ts`, `.test.ts`, `__tests__/`, `.d.ts` 제외
- **예상 출력**: 파일 경로 배열 ~300개
- **롤백**: 없음
- **성공 기준**: backend 100+ , frontend 150+ 확보
- **중단 조건**: 만약 결과가 0이거나 1000 초과 시 제외 규칙 재검토

### Step 3. Import 그래프 추출
- **도구**: `Grep` (`multiline: true`, `-n: true`, `output_mode: "content"`)
- **전략 A (권장)**: 전체 파일에 대해 단일 Grep 호출
  - `pattern: "^import[\\s\\S]*?from\\s+['\"]([^'\"]+)['\"]"`
  - `path: "backend/src"` 또는 `"frontend/src"`
  - `glob: "*.{ts,tsx}"`
- **전략 B (fallback)**: 파일별 개별 Read → 정규식 추출
- **정규화**:
  - 상대 경로 → 절대 프로젝트 경로
  - tsconfig alias 치환
  - 확장자/index.ts 해석
- **예상 출력**: `Map<파일, {imports: string[], external: string[]}>`
- **롤백**: 없음 (메모리 내 데이터)
- **성공 기준**: 파일 95%+ 에서 import 구문 최소 1건 추출 (단, 순수 타입 파일은 0건 가능)
- **중단 조건**: alias 치환 실패율이 20% 초과 시 사용자 보고 후 중단

### Step 4. 데이터 정규화 및 그룹핑
- **도구**: 내부 처리 (도구 호출 없음)
- **작업**:
  1. 각 파일을 카테고리로 분류 (Phase C 규칙)
  2. Imported-By 역인덱스 구축
  3. Hub ranking (피인용 Top 10)
  4. Entry points 식별 (`main.ts`, `App.tsx`, `app.module.ts`)
- **예상 출력**: 내부 데이터 구조 완성
- **롤백**: 없음
- **성공 기준**: 카테고리 미지정 파일 0건
- **중단 조건**: 없음

### Step 5. obsidian.md 및 노드 파일 렌더링
- **도구**: `Write`
- **작업**:
  1. `docs/obsidian-graph/obsidian.md` 메인 MOC 작성 (Phase E)
  2. 옵션 D-2 선택 시: `docs/obsidian-graph/nodes/{category}/{file}.md` 각 파일 작성
  3. (옵션) `backend.md`, `frontend.md` 카테고리 MOC
- **Write 경로 검증**: 모든 경로가 `docs/obsidian-graph/` 로 시작하는지 매 호출 전 확인
- **예상 출력**: ~300개 신규 파일
- **롤백**: `rm -rf docs/obsidian-graph/` (사용자 승인 후)
- **성공 기준**: 지정 경로 외 수정 0건
- **중단 조건**: Write 실패 1건이라도 발생 시 즉시 중단하고 현재 상태 보고

### Step 6. 사후 검증 (변경 0건 확인)
- **도구**: `Bash` (읽기 전용), `Grep`
- **명령**:
  - `git status --short > /tmp/obsidian-post.txt`
  - `diff /tmp/obsidian-pre.txt /tmp/obsidian-post.txt`
  - `git diff HEAD --stat` → `docs/obsidian-graph/` 외 파일이 변경 목록에 있으면 FAIL
- **예상 출력**: 변경 목록이 `docs/obsidian-graph/` 하위로만 구성됨
- **롤백**: 이상 감지 시 `git restore <영향 파일>` (사용자 승인 후)
- **성공 기준**: 의도치 않은 변경 0건
- **중단 조건**: 의도치 않은 변경 1건 이상 감지 → 즉시 사용자 보고

### Step 7. Obsidian Vault 확인 가이드
- **도구**: 없음 (사용자 안내 메시지)
- **안내**:
  1. Obsidian 앱 실행
  2. `Open folder as vault` → `/Users/hoonjaepark/projects/travelPlanner/docs/obsidian-graph` 선택
  3. `obsidian.md` 열기
  4. 그래프 뷰 단축키 `⌘G`
  5. Filters → Tags → `#backend` 또는 `#frontend` 로 서브그래프 확인
  6. Hub note 클릭 → Backlinks 패널에서 Imported-By 확인
- **성공 기준**: 사용자가 Graph View에서 노드 덩어리 확인

---

## 6. 롤백 / 복구 시나리오

### 시나리오 A: `docs/obsidian-graph/` 폴더만 삭제하고 싶음
```bash
rm -rf docs/obsidian-graph/
# docs/obsidian-graph-plan.md (이 계획서)는 유지
```
→ 사용자 명시적 승인 필요.

### 시나리오 B: 실수로 다른 파일이 수정된 경우
```bash
git status                          # 피해 파악
git diff <파일경로>                  # 변경 내용 확인
git restore <파일경로>               # 복구
```
→ 사용자 승인 후 실행. **자동 실행 금지**.

### 시나리오 C: 계획서 자체도 되돌리고 싶음
```bash
rm docs/obsidian-graph-plan.md
```

### 시나리오 D: Step 5 도중 Write 실패
- 즉시 중단
- 이미 생성된 파일 목록 보고
- 사용자가 삭제 승인 시 `rm -rf docs/obsidian-graph/`

---

## 7. 승인 게이트

| 게이트 | 승인 주체 | 승인 전까지 금지 사항 |
|---|---|---|
| **G0. 계획 검토** (현재) | 사용자 | Step 1~7 실행 금지 |
| **G1. Step 1 승인** | 사용자 | Step 2 이후 금지 |
| **G2. Step 2~4 결과 보고 후 승인** | 사용자 | Step 5 (파일 생성) 금지 |
| **G3. Step 5 완료 후 검증 승인** | 사용자 | 작업 종료 선언 금지 |

각 게이트에서 사용자가 "진행"이라고 명시적으로 응답하지 않으면 대기.

---

## 8. 사용자 결정 필요 사항 (Step 1 전 확인)

계획 승인 전 다음 선택지에 대해 답변을 요청합니다:

### Q1. 출력 위치
- [ ] **A** (권장): `docs/obsidian-graph/` 프로젝트 내부
- [ ] **B**: 외부 Obsidian Vault 절대 경로 (사용자 입력)

### Q2. 노드 표현 방식
- [ ] **D-2** (권장): 파일당 1개 `.md` 노트 (~300개, 진짜 그래프)
- [ ] **D-1**: 단일 `obsidian.md` (간단, 하지만 그래프 아님)
- [ ] **D-3**: 카테고리당 1개 노트 (~20개, 요약 그래프)

### Q3. 테스트 파일 포함 여부
- [ ] **제외** (권장 기본값): `*.spec.ts`, `*.test.ts`, `__tests__/` 제외
- [ ] **포함**: 별도 `#test` 태그로 분리

### Q4. 외부 npm 패키지 노드화
- [ ] **제외** (권장): `@nestjs/common` 등은 그래프에 표시 안 함
- [ ] **포함**: `#external` 태그로 노드화 (그래프 폭발 위험)

### Q5. Barrel (index.ts re-export) 처리
- [ ] **단순** (권장): barrel을 일반 노드로 처리
- [ ] **정밀**: barrel을 pass-through로 해석 (구현 복잡도 ↑)

---

## 9. 다음 행동

현재 이 계획서만 작성된 상태이며, **어떤 소스 코드도 수정하지 않았고 obsidian.md도 생성하지 않았습니다**.

사용자가 다음 중 하나로 응답해주세요:

1. **"계획 승인, Q1~Q5는 모두 권장값(A, D-2, 제외, 제외, 단순)으로. Step 1 진행해줘"** → Step 1 실행
2. **"Q1=B, 경로는 /path/to/vault. 나머지 권장값. Step 1 진행"** → 옵션 조정 후 Step 1 실행
3. **"계획 수정 필요: ..."** → 계획서 재작성
4. **"중단"** → 작업 종료

Step 1 이후 각 Step은 순차적으로 사용자 승인을 받으며 진행됩니다.

---

**문서 버전**: 1.0
**작성일**: 2026-04-14
**상태**: 계획 수립 완료, 사용자 승인 대기 중 (G0 게이트)
