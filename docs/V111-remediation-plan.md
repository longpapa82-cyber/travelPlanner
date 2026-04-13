# V111 Alpha 검수 대응 및 프로덕션 출시 계획

**작성일**: 2026-04-13
**작성자**: plan-q (Claude Opus 4.6)
**대상 버전**: versionCode 112+
**기준 문서**: `/Users/hoonjaepark/projects/travelPlanner/testResult.md` (V111 섹션 1~38줄)

---

## 📋 요약 (Executive Summary)

V111 Alpha 검수에서 **7건의 이슈**가 확인되었고, 이 중 **5건(#3, #4, #5, #6, #7)은 V109~V110에서 "수정 완료"로 보고되었음에도 재발**한 회귀 이슈입니다. 이는 단순한 로직 버그가 아니라 **수정이 실제 빌드에 반영되지 않았거나, 잘못된 레이어에 적용되었거나, 상태 소스(single source of truth)가 파편화되어 있다는 구조적 문제**를 시사합니다.

본 계획은 (1) **근본 원인 재조사 — "왜 반영되지 않았는가"를 먼저 해명**, (2) **이슈별 타겟 수정**, (3) **셀프루프로 0건까지 수렴**, (4) **6개 QA 레이어 프로덕션 검수**, (5) **프로덕션 오픈 체크리스트** 순으로 진행합니다. 예상 총 소요: **2~3일 (집중 투입 기준)**.

### ⚠️ 핵심 리스크
- **허위 "수정 완료" 보고**: V109 CLAUDE.md에는 "AuthContext getProfile() 추가로 구독 오표기 해결"로 기록되어 있으나 V111에서 동일 증상 재발. → 실제 실행 경로(빌드 아티팩트 → 디바이스 설치 → UI 렌더)의 어느 단계에서 단절되었는지 확인 필수.
- **코치마크 위치 3회 연속 재발 (V109, V110, V111)**: 좌표 계산 로직뿐만 아니라 **측정 타이밍(onLayout vs measureInWindow), 상위 컨테이너 변경(SafeArea/Header 높이), 디바이스 해상도 의존성**까지 포함해 재조사 필요.
- **AI 카운터 "1/3" 하드코딩 의심**: 구독 여부·실제 값과 무관하게 동일 문자열이 표시된다는 점은 **i18n 문자열에 하드코딩된 변수 또는 별개의 UI 컴포넌트가 구독 상태를 구독하지 않는 것**을 시사.

---

## 🎯 이슈 전수 목록

| # | 이슈 | 심각도 | 재발 이력 | 의심 영역 |
|---|------|--------|-----------|-----------|
| V111-1 | 이메일 인증 에러 메시지 개발자 언어("유효하지 않은 인증 토큰입니다. (4)") + **전체 앱 메시지 점검** | P1 | 신규 | Backend ExceptionFilter, Frontend i18n auth.json, errorCode→message 매핑 |
| V111-2 | 동의 화면 [동의하고 시작하기] 버튼 하단 부착 | P2 | 신규 | ConsentScreen.tsx 레이아웃 (SafeArea bottom, paddingBottom) |
| V111-3 | 홈 코치마크 박스 위치 불일치 | P1 | V109~V111 3회 연속 | CoachMark.tsx 측정 로직, HomeScreen 버튼 ref, SPOT_PADDING |
| V111-4 | 수동 여행 생성 시 "이번 달 AI 자동 생성 1/3회 남음" 오표기 | P0 | V109~V111 3회 연속 | CreateTripScreen 상단 배너, PremiumContext quota, i18n 보간 변수 |
| V111-5 | 광고 재생 중 오표기 메시지 광고에 가려지고 미사라짐 + 내용 오류 | P0 | 신규 (내용 오류는 #4와 연동) | InterstitialAd 표시 중 Toast/Banner z-index, dismissOnAd 로직 |
| V111-6 | 구독 화면에 구독일/종료일/월간·년간 미표기 | P0 | V109~V111 재발 | SubscriptionScreen UI 렌더, subscriptionStartedAt/planType 필드 실제 주입 여부 |
| V111-7 | 구독자도 3/3 형식 AI 카운터 표기 미반영 | P1 | V109~V111 재발 | PremiumContext quota 계산, 구독자 분기 로직 |

---

## 🔬 Phase 1: 근본 원인 분석 (RCA)

**목표**: "왜 V109~V110 수정이 반영되지 않았는가"를 **코드 레벨 증거**로 해명. 추측 금지.

**예상 소요**: 4~6시간
**에이전트**: `feature-troubleshoot` (병렬 실행 가능)
**산출물**: `docs/V111-rca-findings.md` (이슈별 증거 기반 RCA 보고서)

### 1.0 선결 조사: 빌드-배포 파이프라인 건전성 (순차, 30분)
V109~V110의 수정이 실제 Alpha 빌드 아티팩트에 들어갔는지부터 확인해야 이슈별 RCA가 의미 있음.

- [ ] **Git blame**: CLAUDE.md V109 수정 항목(AuthContext getProfile, SubscriptionScreen 필드 추가, CreateTripScreen focus listener)의 커밋 SHA를 `git log --follow` 로 확인
- [ ] **빌드 아티팩트 매칭**: 커밋 SHA vs Alpha에 업로드된 AAB의 빌드 시점(EAS build log) 대조 — 수정 커밋이 빌드 전에 존재했는지 확인
- [ ] **APK 디컴파일 샘플 검증** (선택): `bundletool` + `apktool` 로 현재 Alpha AAB에서 JS 번들 추출 → 수정 코드 문자열(`getProfile`, `subscriptionStartedAt`) 포함 여부 grep
- [ ] **Metro 캐시 / Hermes 바이트코드 이슈 확인**: EAS 빌드 시 `--clear-cache` 플래그 사용 여부

**검증 기준**: "수정 커밋이 Alpha AAB에 포함되어 있다" 또는 "포함되어 있지 않다"를 명확히 판정. 포함되지 않았다면 이슈별 RCA는 불필요하고 Phase 2는 **재빌드 및 재업로드**로 축소됨.

### 1.1 이슈별 RCA (병렬 실행 — feature-troubleshoot 7개 인스턴스)

#### V111-1: 에러 메시지 개발자 언어
**조사 대상**:
- `backend/src/users/users.service.ts` — `verifyEmail()` 에서 throw하는 예외 메시지
- `backend/src/common/filters/all-exceptions.filter.ts` — errorCode 매핑
- `frontend/src/i18n/locales/*/auth.json` — `invalidToken`, `verifyFailed` 키
- `frontend/src/screens/auth/VerifyEmailScreen.tsx` — 에러 핸들링 `t(error.code)` 경로
- **전수 점검**: `grep -rEn "throw new (Bad|Unauthorized|NotFound|Conflict)Exception\s*\(\s*['\"]" backend/src` — 하드코딩 한국어/영문 raw 메시지 목록화
- **전수 점검**: `grep -rEn "Alert\.alert\s*\(\s*['\"]" frontend/src` — 하드코딩 메시지

**확인 포인트**: 
- "(4)" 라는 숫자 코드가 어디서 붙는가 (아마도 백엔드 에러 코드 enum value)
- i18n 키가 있는데 왜 fallback으로 raw 메시지가 노출되는가
- 17개 언어 모두 키가 존재하는가

**산출물**: 개발자 언어로 표출되는 전체 메시지 인벤토리 (파일:라인, 영역, 제안 i18n 키)

#### V111-2: 동의 화면 버튼 하단 부착
**조사 대상**: `frontend/src/screens/consent/ConsentScreen.tsx`
- ScrollView `contentContainerStyle`, 버튼 컨테이너의 `paddingBottom`, `useSafeAreaInsets()` 사용 여부
- 이전 수정(2026-04-07 SafeArea 적용)이 올바르게 적용되었는지 확인
- 스크린샷(image-150.png)과 실제 레이아웃 비교

**확인 포인트**: 상단 여백이 과도하고 하단이 0에 붙어있는지, `justifyContent`가 `space-between`인지, SafeArea bottom inset이 반영되었는지.

#### V111-3: 코치마크 위치 불일치 ⚠️ 3회 재발
**조사 대상**:
- `frontend/src/components/tutorial/CoachMark.tsx` — 측정 로직 (`measureInWindow` vs `measure`, ref 타이밍)
- `frontend/src/components/tutorial/WelcomeModal.tsx`
- `frontend/src/screens/main/HomeScreen.tsx` — 대상 버튼에 ref 부여 방식, layout effect 타이밍
- `TutorialContext.tsx` — 코치마크 노출 조건/타이밍
- V107 수정 메모("코치마크 onLayout"), V109 수정 메모("SPOT_PADDING 12, TOOLTIP_GAP 24")가 실제 현재 파일에 존재하는지 확인

**확인 포인트**:
1. 측정 시점: 버튼 마운트 완료 전에 측정하는가? `InteractionManager.runAfterInteractions` 미사용?
2. 좌표계: `measureInWindow`는 status bar 포함, `pageY`는 제외 — 혼용 여부
3. 상위 컨테이너 변경: SafeAreaView, Header 높이, 배너 광고 로드로 인한 레이아웃 shift 후 재측정 누락
4. 대상 버튼이 `FlatList`/`ScrollView` 내부에 있어 렌더 프레임이 지연되는가
5. 디바이스별 해상도/폰트 스케일 차이 (테스터 기기 DPI 확인)

**산출물**: 재발 원인 해명 보고서 (반드시 "이전 수정이 놓친 조건"을 명시)

#### V111-4 + V111-5 + V111-7: AI 카운터 3종 세트 ⚠️ 연동 이슈
**조사 대상**:
- `frontend/src/contexts/PremiumContext.tsx` — `aiGenerationQuota`, `aiGenerationUsed`, `remainingAiGenerations` 필드 정의와 계산 로직
- `frontend/src/screens/trips/CreateTripScreen.tsx` — 상단 배너 렌더 부분 (`"이번 달 AI 자동 생성 X/3회 남음"` 문자열)
- `frontend/src/i18n/locales/*/trips.json` — 해당 키 (`trips.aiQuotaBanner` 등) — **보간 변수(`{{remaining}}`)가 하드코딩 `1`로 되어 있는지** 최우선 확인
- `backend/src/users/users.service.ts` `getProfile()` — 구독자에 대해 quota를 어떻게 반환하는가 (무제한이라면 `-1` 또는 `Infinity`?)
- `backend/src/ai/ai.service.ts` — 월별 카운터 증가 로직
- 광고 중 배너 표시: `frontend/src/components/ads/*`, `AdManager`, Toast/Snackbar 컴포넌트

**확인 포인트**:
1. **하드코딩 용의자 #1**: `trips.json` 의 `aiQuotaBanner` 값이 `"이번 달 AI 자동 생성 1/3회 남음"` 으로 **숫자가 리터럴로 박혀있는지**. V109 수정 시 i18n 파일 보간 구문(`{{remaining}}/{{total}}`)으로 변경했다고 주장했으나 실제 파일 확인 필요.
2. **하드코딩 용의자 #2**: CreateTripScreen에서 `t('trips.aiQuotaBanner', { remaining: 1, total: 3 })` 처럼 **변수 자체가 하드코딩**되어 있는지.
3. 구독자 분기: `isPremium ? render3of3 : renderQuota` 가 아니라 **구독자도 동일 배너를 그리는지**.
4. 광고 중 배너 z-index + dismiss 로직: `ToastAndroid`/`react-native-toast-message` 의 position, interstitial 전환 시 unmount 핸들러.
5. `getProfile()` 호출 후 PremiumContext가 실제로 rerender 되는지 (useMemo/selector가 stale ref 반환?)

**산출물**: 
- 증거 코드 스니펫 (파일:라인:문자열)
- "V109 수정이 어디서 단절되었는가" 명시
- 단일 fix가 3개 이슈를 동시에 해결하는지 또는 각각 별도 fix 필요한지 판정

#### V111-6: 구독 화면 정보 미표기 ⚠️ 재발
**조사 대상**:
- `frontend/src/screens/main/SubscriptionScreen.tsx` — V109 주장 수정 (`subscriptionStartedAt`, `subscriptionPlanType` 렌더) 이 실제 파일에 존재하는지
- `backend/src/users/users.service.ts` `getProfile()` 응답 DTO
- `backend/src/migrations/1744300000000-AddSubscriptionPlanFields.ts` — 마이그레이션 실제 프로덕션 적용 여부 (`\d users` 컬럼 확인)
- 실제 구독자 DB row: Hetzner Postgres에서 해당 테스터 계정의 `subscription_started_at`, `subscription_plan_type` 값 확인
- RevenueCat webhook handler — 구독 이벤트 발생 시 이 필드들을 실제로 update 하는가

**확인 포인트**:
1. DB에 컬럼은 존재하지만 값이 NULL일 가능성 (webhook update 누락)
2. getProfile이 필드를 반환하지만 frontend DTO 타입에 누락되어 버려지는 가능성
3. SubscriptionScreen이 **옛 버전 UI** 그대로이고 V109 수정 코드가 실제로는 커밋되지 않았을 가능성

**산출물**: "DB → API → Context → UI" 4단계 중 어디에서 데이터가 끊겼는지 단계별 판정

### 1.2 RCA 종합 및 우선순위 확정 (순차, 30분)
- 7개 이슈의 근본 원인을 1개 테이블로 취합
- "동일 근본 원인" 그룹화 (예: #4, #5, #7이 단일 PremiumContext fix로 해결되는지)
- Phase 2 수정 순서 확정 (공통 원인 먼저)

---

## 🛠️ Phase 2: 이슈별 수정 (Targeted Fixes)

**목표**: Phase 1 RCA 결과에 따른 타겟 수정. 추측 기반 수정 금지, 반드시 RCA 증거에 기반.

**예상 소요**: 6~10시간
**에이전트**: `feature-troubleshoot` (수정), `tdd-guide` (수정 전 테스트 작성)
**산출물**: 이슈별 커밋, 로컬 `typecheck + jest` 통과

### 실행 전략
- **Phase 2.A (병렬 가능)**: 독립적 UI 수정 — V111-2 (버튼 여백), V111-1 (i18n 키 추가)
- **Phase 2.B (순차)**: 공통 원인 이슈 — V111-4, V111-5, V111-7 (PremiumContext + i18n + 배너 z-index) 
- **Phase 2.C (단독)**: V111-3 (코치마크) — 측정 타이밍 이슈는 다른 수정과 충돌 가능성
- **Phase 2.D (단독)**: V111-6 (구독 화면) — Backend + Frontend 양쪽 수정 필요 가능성

### 2.1 V111-1: 에러 메시지 i18n 전수 점검 (Phase 2.A 병렬)
**수정 파일**:
- `backend/src/users/users.service.ts`, `auth.service.ts` — 예외 throw 시 **errorCode만 전달**, 메시지는 클라이언트가 생성
- `backend/src/common/filters/all-exceptions.filter.ts` — errorCode → i18n key 매핑 일관성
- `frontend/src/i18n/locales/*/auth.json` — 17개 언어 × 키 추가
- `frontend/src/screens/auth/VerifyEmailScreen.tsx` — errorCode 기반 `t()` 호출로 변경

**검증 방법**:
- `grep -rEn "throw new .*Exception\s*\(\s*['\"]\S" backend/src` → 0건
- `grep -rEn "Alert\.alert\([^,]*['\"]유효|실패|에러" frontend/src` → 0건 (또는 t() 호출)
- Jest: auth.service.spec.ts 에러 코드 반환 테스트 추가
- 수동: 잘못된 토큰으로 verifyEmail 호출 → 사용자 친화적 메시지

**예상 시간**: 2~3시간 (17개 언어 전수 점검 포함)

### 2.2 V111-2: 동의 화면 여백 (Phase 2.A 병렬)
**수정 파일**: `frontend/src/screens/consent/ConsentScreen.tsx`
**수정 전략**: 
- ScrollView `contentContainerStyle.flexGrow: 1` + `justifyContent: 'space-between'` 또는 명시적 `paddingBottom: insets.bottom + 24`
- 상단 여백 축소
- 스크린샷 회귀 테스트 추가 (Phase 4에서)

**검증**: Expo Go에서 다양한 디바이스(Pixel 4/6, 에뮬레이터 small/large) 확인

**예상 시간**: 30분

### 2.3 V111-3: 코치마크 위치 (Phase 2.C 단독) ⚠️ 3회 재발 — 신중 접근
**수정 전략**: 단순 숫자 조정 금지. 측정 로직 자체를 재작성.

1. **측정 시점 고정**: `onLayout` 콜백 + `InteractionManager.runAfterInteractions` + 한 프레임 지연(`requestAnimationFrame`)
2. **측정 API 통일**: `measureInWindow` 로 일관, status bar 포함 좌표계
3. **레이아웃 안정화 대기**: 배너 광고 로드 완료 이벤트 후 재측정
4. **재측정 트리거**: orientation change, font scale change, window resize
5. **fallback**: 측정 실패 시 코치마크 표시 지연 (기존처럼 잘못된 위치에 표시하지 않음)

**검증**:
- 실기기 3종 이상 (Pixel 4a, Pixel 7, Galaxy S22 에�) 에서 스폿 정확도 확인
- 배너 광고 로드 전/후 모두 정확한 위치
- 다크/라이트 모드 동일 결과
- 스크린샷 회귀 테스트 (각 디바이스)

**예상 시간**: 2~3시간 (3회 재발인 만큼 충분히 투자)

### 2.4 V111-4 + 5 + 7: AI 카운터 3종 세트 (Phase 2.B 순차)
**수정 순서** (RCA에서 확정된 순):

1. **i18n 하드코딩 제거**: `trips.json` 17개 언어에서 `aiQuotaBanner` 를 `"이번 달 AI 자동 생성 {{remaining}}/{{total}}회 남음"` 보간 형태로 통일
2. **PremiumContext 단일 소스화**: `useAiQuota()` 훅 신설 — `{ remaining, total, isUnlimited, isPremium }` 반환
3. **CreateTripScreen 배너 리팩토링**: 
   - 구독자: `isUnlimited` 일 때 `"AI 자동 생성 무제한"` 또는 요청대로 `3/3`
   - 비구독자: `{remaining}/{total}`
4. **광고 중 배너 문제**:
   - 해당 Toast/Banner를 `InterstitialAd.addEventListener('opened', () => hide())` 로 자동 dismiss
   - z-index는 광고 Activity가 OS 레벨에서 오버레이하므로 건드릴 필요 없음 — **dismiss가 핵심**
5. **회귀 방지 테스트**: 
   - `CreateTripScreen.test.tsx` 에 "비구독자 2/3 표시", "구독자 3/3 표시", "하드코딩 1 금지" 스냅샷
   - `PremiumContext.test.tsx` 에 quota 계산 단위 테스트

**검증**:
- TypeScript 0 에러
- Jest 신규 테스트 통과
- 수동: 비구독 계정 (1회 사용 후 2/3), 구독 계정 (3/3 또는 무제한)
- 수동: 여행 생성 → 광고 재생 → 배너 자동 사라짐 확인

**예상 시간**: 3~4시간

### 2.5 V111-6: 구독 화면 정보 표기 (Phase 2.D 단독)
**수정 전략** (RCA에서 확정된 단절 지점에 따라 분기):

**Case A**: DB에 값이 NULL인 경우
- RevenueCat webhook handler 에서 `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE` 이벤트 시 `subscriptionStartedAt`, `subscriptionPlanType` update 추가
- Backfill 스크립트: RevenueCat API에서 기존 구독자 조회 → DB 채우기

**Case B**: API 응답에 포함되는데 frontend DTO 누락
- `frontend/src/types/user.ts` 또는 `api/profile.ts` 에 필드 추가
- SubscriptionScreen 렌더 부분 추가

**Case C**: V109 주장 수정이 실제로 커밋되지 않은 경우
- 해당 수정을 실제로 작성

**검증**:
- 테스터 계정 DB row 직접 조회 → 값 확인
- `curl .../api/users/me/profile` → JSON에 필드 존재 확인
- SubscriptionScreen에서 구독일/종료일/플랜 타입 렌더
- 다국어 레이블 확인 (월간/년간/monthly/yearly)

**예상 시간**: 2시간

### 2.6 수정 후 로컬 검증 (순차, 30분)
- [ ] Backend: `pnpm typecheck && pnpm test`
- [ ] Frontend: `pnpm typecheck && pnpm test`
- [ ] 수정된 i18n 파일 17개 언어 키 존재 검증 스크립트 실행
- [ ] Git diff 전체 리뷰

---

## 🔁 Phase 3: Self-Heal Loop (셀프루프)

**목표**: 이슈 0건, TS 0 에러, 회귀 테스트 통과까지 반복.

**반복 종료 조건** (AND):
1. TypeScript: Backend + Frontend 각각 0 에러
2. Jest: Backend + Frontend 각각 통과 (기존 커버리지 이상)
3. `auto-qa` 에이전트 결과: P0 0건, P1 0건
4. 이슈 추적 테이블: V111 7개 이슈 + 신규 발견 모두 ✅

**최대 반복**: 5회
**에스컬레이션**: 5회 초과 시 중단 → 사용자에게 현황 보고 후 재계획 수립

### 루프 사이클 (각 반복)
```
1. Targeted fix 적용 (feature-troubleshoot)
2. 로컬 typecheck + jest
3. auto-qa 에이전트 실행 (Backend + Frontend 회귀 전수)
4. 신규/잔존 이슈 목록화
5. 신규 이슈 있으면 → feature-troubleshoot RCA → 1번으로
6. 없으면 루프 종료
```

### 각 루프 산출물
- `docs/V111-loop-[N].md`: 반복 N번째 수정 내역, 발견 이슈, 해결 여부

**예상 소요**: 2~6시간 (루프 1~3회 예상)

---

## 🧪 Phase 4: 프로덕션 출시 전 6-Layer QA

**목표**: P0 0건, P1 0건, 모든 레이어 GO 판정.

**병렬 실행**: 4.1 ~ 4.6 은 모두 **독립 실행 가능 → 6개 에이전트 동시 실행**
**예상 소요**: 3~5시간 (병렬)

### 4.1 auto-qa: 기능 회귀 전수
**범위**: Backend 412+ tests, Frontend 200+ tests, 통합 스모크
**기준**: 통과율 ≥ 98%, P0 0건
**산출물**: `docs/V112-auto-qa-report.md`

### 4.2 final-qa: P0/P1 최종 확인
**범위**: V111 7개 이슈 + V107~V110 회귀 이슈 전체 재확인
**기준**: P0/P1 0건
**산출물**: `docs/V112-final-qa-report.md`

### 4.3 security-qa: OWASP + 개인정보
**범위**:
- OWASP Top 10 (SQL injection, XSS, CSRF, SSRF, IDOR, Auth bypass, XXE, Deserialization, Known vulns, Logging)
- JWT (만료, refresh rotation, jti 검증)
- Rate limiting (모든 auth/generate 엔드포인트)
- 2FA (backup code 해싱, lockout)
- 개인정보 보호 (이메일 마스킹, 감사 로그)
- Consent 감사 로그 무결성

**기준**: CRITICAL 0, HIGH 0
**산출물**: `docs/V112-security-qa-report.md`

### 4.4 publish-qa: Google Play 정책
**범위**:
- 데이터 안전 선언 최신화 (새로 추가된 필드 포함)
- 권한 사용 정당성 (카메라, 위치, 알림)
- **광고 정책 (AdMob 정책 위반 재검토 상태 확인 — 4/14 예상)**
- 콘텐츠 등급
- IAP 정책 (subscription cancellation, restore purchases)
- 대상 API 레벨 (최신 요구 충족)
- 개인정보 처리방침 링크 정확성

**기준**: Blocker 0, WARN ≤ 2 (해결 가능한)
**산출물**: `docs/V112-publish-qa-report.md`

### 4.5 code-reviewer + code-analyzer: 품질
**범위**:
- 린트 0 경고
- TypeScript strict 준수
- 새로 추가된 코드의 복잡도, 중복, 네이밍
- Dead code, unused imports
- Magic numbers → constants

**기준**: 블로킹 이슈 0
**산출물**: `docs/V112-code-review.md`

### 4.6 gap-detector: 설계-구현 갭
**범위**:
- CLAUDE.md에 기록된 V111 수정 주장 vs 실제 커밋된 코드
- 명세 (testResult.md 요구사항) vs 실제 동작
- 이전 버전 회귀 이슈 시스템적 탐색

**기준**: 주장-구현 갭 0
**산출물**: `docs/V112-gap-detector.md`

### 4.7 Go/No-Go 판정 (순차, 30분)
- 6개 레이어 리포트 통합
- **GO 조건**: P0 0, P1 0, 6개 레이어 모두 PASS
- **NO-GO**: Phase 3 재진입

---

## 🚀 Phase 5: 프로덕션 출시 체크리스트

**목표**: 단계적 출시 1% → 10% → 100%.
**예상 소요**: 1~2시간 (준비) + 단계적 관찰 기간

### 5.1 빌드 설정 (필수 변경)
- [ ] **`eas.json` 에서 `EXPO_PUBLIC_USE_TEST_ADS` 제거** ⚠️ CLAUDE.md 명시 필수 항목
- [ ] `eas.json` production profile 의 `track: production` 확인 (현재는 alpha)
- [ ] `eas.json` `releaseStatus: draft` (수동 출시 제어)
- [ ] `app.config.js` versionCode 증가 (현재 110/111 → 112+)
- [ ] AdMob App ID 프로덕션 ID 확인 (`ca-app-pub-7330738950092177~5475101490`)
- [ ] 광고 단위 ID 모두 프로덕션 (배너/전면/앱오프닝/보상형)

### 5.2 AdMob 정책 준수
- [ ] **AdMob 정책 위반 검토 상태 재확인** (2026-04-14 예상 — 본 계획 실행 시점에 이미 결과 도착했을 가능성)
- [ ] 53% 광고 제한 해제 확인
- [ ] `app-ads.txt` 업로드 및 mytravel-planner.com 에서 접근 가능 확인
- [ ] AdMob Play Store 연결 (프로덕션 트랙 출시 후 자동)

### 5.3 법적/정책 문서
- [ ] `privacy.html` / `privacy-en.html` 최신 수집 항목 반영
- [ ] `terms.html` 버전 일치 (frontend 상수와)
- [ ] Play Console 앱 콘텐츠 선언 10개 재확인 (특히 데이터 안전)
- [ ] OSS `licenses.html` 최신화

### 5.4 Backend 배포 (Hetzner VPS)
- [ ] SSH `ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127`
- [ ] `git pull` + `docker compose build && docker compose up -d` (restart 금지 — 502 방지)
- [ ] `curl https://mytravel-planner.com/api/health` 200 확인
- [ ] DB 마이그레이션 적용 확인 (`\d users` 에서 신규 컬럼)
- [ ] 로그 tail 5분 — 에러 0건
- [ ] Rate limit, CSP 헤더 정상

### 5.5 Frontend 빌드 & 업로드
- [ ] `eas build --platform android --profile production --auto-submit --non-interactive`
- [ ] Play Console에서 draft 상태로 수신 확인
- [ ] Alpha 트랙에서 **라이선스 테스터 1일 최종 회귀 테스트**
- [ ] 이슈 0건 확인 후 프로덕션 트랙 승격

### 5.6 단계적 출시
- [ ] 1% 롤아웃 시작 → 24시간 관찰 (크래시율 < 0.5%, ANR < 0.3%)
- [ ] 10% 롤아웃 → 48시간 관찰
- [ ] 100% 롤아웃
- [ ] Firebase Crashlytics, Play Console Vitals 모니터링 대시보드 열어두기

### 5.7 롤백 계획
**트리거**: 크래시율 > 1%, P0 이슈 사용자 제보, 결제 실패율 > 5%
**절차**:
1. Play Console 롤아웃 정지 (Halt rollout)
2. 이전 AAB 재프로모션 또는 긴급 hotfix 빌드
3. Backend 롤백: `git checkout [이전 태그] && docker compose up -d`
4. 사용자 공지 (인앱 공지사항 + 스토어 설명)
5. 24시간 내 원인 RCA + 재출시 계획

---

## 📊 RICE 우선순위 매트릭스 (수정 순서 가이드)

| 이슈 | Reach | Impact | Confidence | Effort | RICE | 순서 |
|------|-------|--------|------------|--------|------|------|
| V111-4 (AI 카운터 오표기) | 10 | 10 | 9 | 3 | **300** | 1 |
| V111-6 (구독 화면 미표기) | 7 | 10 | 8 | 2 | **280** | 2 |
| V111-5 (광고 중 배너) | 10 | 8 | 8 | 2 | **320** | 3 (#4와 동시) |
| V111-7 (구독자 3/3) | 3 | 6 | 9 | 1 | **162** | 4 (#4와 동시) |
| V111-1 (에러 메시지) | 10 | 6 | 9 | 4 | **135** | 5 |
| V111-3 (코치마크) | 5 | 6 | 6 | 3 | **60** | 6 |
| V111-2 (버튼 여백) | 10 | 3 | 10 | 1 | **300** | 7 (quick win) |

**해석**: #4, #5, #7은 공통 근본 원인으로 묶어 먼저 해결. #2는 30분짜리 quick win으로 병렬 처리. #3은 3회 재발이라 신중 접근하되 impact는 중간.

---

## 🗺️ 로드맵 (타임라인)

| Day | Phase | 주요 작업 | 산출물 |
|-----|-------|-----------|--------|
| **Day 1 오전** | Phase 1 | RCA (빌드 파이프라인 + 7개 이슈 병렬) | `V111-rca-findings.md` |
| **Day 1 오후** | Phase 2.A+B | 에러 메시지 i18n, 동의 버튼, AI 카운터 3종 | 커밋 3~5개 |
| **Day 2 오전** | Phase 2.C+D | 코치마크, 구독 화면 | 커밋 2개 |
| **Day 2 오후** | Phase 3 | 셀프루프 (1~3회) | `V111-loop-*.md` |
| **Day 3 오전** | Phase 4 | 6-Layer QA 병렬 + Go/No-Go | 6개 리포트 |
| **Day 3 오후** | Phase 5 | 빌드, Alpha 테스트, 프로덕션 승격 | AAB, Play Console 승격 |

**총 예상**: 2~3일 (집중 투입 기준)

---

## ⚠️ 리스크 및 고려사항

### R1: 빌드 파이프라인 이슈일 가능성 (🔴 HIGH)
- **시나리오**: V109~V110 수정 코드는 정상이지만 EAS 빌드/캐시/업로드 과정에서 누락
- **대응**: Phase 1.0 선결 조사에서 판별. APK 디컴파일로 실제 번들 내 코드 존재 확인.
- **만약 맞다면**: Phase 2 대부분 생략하고 `--clear-cache` 재빌드로 해결 가능

### R2: 코치마크 4회 재발 (🟡 MEDIUM)
- **시나리오**: Phase 2.3 수정 후에도 V112에서 또 재발
- **대응**: 측정 로직을 아예 삭제하고 **고정 위치 툴팁 + 화살표**로 디자인 변경 (측정 의존성 제거)
- **판단 기준**: V112 Alpha에서 재발 시 즉시 디자인 변경

### R3: AdMob 정책 검토 지연 (🟡 MEDIUM)
- **시나리오**: 4/14 예상 결과가 지연되어 프로덕션 출시가 광고 없이 진행되어야 함
- **대응**: 프로덕션 출시는 광고 여부와 독립적으로 진행 가능 (테스트 광고 제거만 필수). 광고는 검토 통과 후 자동 활성화.

### R4: Hetzner VPS 배포 중 다운타임 (🟢 LOW)
- **대응**: `docker compose restart` 금지 (CLAUDE.md 기록), `up -d` 사용. Cloudflare 프록시 덕분에 수 초 다운타임은 사용자 경험에 미미.

### R5: 회귀 이슈 추가 발견 (🟡 MEDIUM)
- **시나리오**: Phase 4 QA에서 V111에 없던 신규 회귀 이슈 발견
- **대응**: Phase 3 셀프루프로 복귀. 최대 5회 반복 안에 수렴 못하면 출시 연기.

### R6: CLAUDE.md 기록의 신뢰성 (🔴 HIGH)
- **시나리오**: V109 기록이 "수정했다"고 적혀 있지만 실제로는 커밋되지 않은 경우
- **대응**: Phase 1.0 `git blame` 필수. 기록-실제 불일치 발견 시 사용자에게 즉시 보고.

---

## 📝 TaskCreate 제안 (승인 후 즉시 실행)

```
T1. [Phase 1.0] 빌드 파이프라인 건전성 조사 — git blame V109 커밋 + Alpha AAB 디컴파일 검증
T2. [Phase 1.1] feature-troubleshoot 병렬 7개 — V111-1~7 근본 원인 분석
T3. [Phase 1.2] RCA 종합 + 우선순위 확정 → docs/V111-rca-findings.md
T4. [Phase 2.A] 에러 메시지 i18n 전수 점검 + 수정 (V111-1)
T5. [Phase 2.A] 동의 화면 버튼 여백 수정 (V111-2)
T6. [Phase 2.B] PremiumContext + i18n + 카운터 배너 3종 수정 (V111-4/5/7)
T7. [Phase 2.C] 코치마크 측정 로직 재작성 (V111-3)
T8. [Phase 2.D] 구독 화면 필드 수정 Backend+Frontend (V111-6)
T9. [Phase 2.6] 로컬 typecheck + jest 전체
T10. [Phase 3] 셀프루프 (auto-qa 반복, 최대 5회)
T11. [Phase 4] 6-Layer QA 병렬 실행 (auto/final/security/publish/code-review/gap-detector)
T12. [Phase 4.7] Go/No-Go 판정
T13. [Phase 5.1] eas.json EXPO_PUBLIC_USE_TEST_ADS 제거 + versionCode 증가
T14. [Phase 5.4] Backend Hetzner VPS 배포 (docker compose up -d)
T15. [Phase 5.5] EAS production 빌드 + Alpha 업로드 + 1일 최종 회귀
T16. [Phase 5.6] 프로덕션 트랙 승격 1% → 10% → 100% (48h+24h 관찰)
```

---

## ✅ 자가 검증 체크리스트

- [x] 모든 이슈가 사용자 요구(testResult.md)에 트레이스됨
- [x] MVP 우선 (버그 수정 = MVP)
- [x] 우선순위 근거 명시 (RICE + 재발 이력)
- [x] 의존성 매핑 (공통 근본 원인 그룹화)
- [x] 실행 가능성 (파일 경로, 에이전트, 시간 예측 구체화)
- [x] 정직한 트레이드오프 (R1~R6 리스크 명시, 불확실성 표기)
- [x] 재발 이슈에 대한 "왜 이번엔 다른가" 제시 (Phase 1.0 필수, 측정 로직 재작성, 빌드 검증)
- [x] 롤백 계획 명시

---

**다음 액션**: 사용자 승인 후 Phase 1 즉시 착수. Phase 1.0 (빌드 파이프라인 조사) 결과에 따라 전체 계획 축소 가능성 있음.
