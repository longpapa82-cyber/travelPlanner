# V112 Group B RCA — 핵심 기능 마비 (3건)

**Date**: 2026-04-14
**Status**: RCA 완료, 수정 계획 수립 대기

---

## #6 — 30일 자동생성 무한로딩 + [취소] 후 횟수 손실 (CRITICAL)

### Root cause chain (3 independent defects compounding)

**Defect A — 쿼터가 AI 실행 전 차감되고 실패 시 롤백 안 됨 (CRITICAL, 사용자가 보고한 직접 원인)**
- `backend/src/trips/trips.service.ts:142-151` — `aiTripsUsedThisMonth++` 가 AI 생성 블록 **이전**에 실행됨
- 라인 356-375 — AI 블록 내부 try/catch가 실패를 **삼키고** fallback으로 빈 itineraries + `aiStatus='failed'` 저장
- 라인 379 — 무조건 `commitTransaction()` → **쿼터 차감 커밋됨**
- **로그 증거** (4/14 10:22): `Incremented AI trip quota for user b937a561 ... 1 -> 2` at 10:22:39, 첫 AI call log at 10:22:57 → 쿼터 차감이 AI 호출 **이전**

**Defect B — OpenAI streaming timeout/abort 부재 (CRITICAL)**
- `backend/src/trips/services/ai.service.ts:837-873 streamCompletion()` — `openai.chat.completions.create({stream: true})`에 `signal`, `timeout` 둘 다 없음
- for-await 루프는 OpenAI SDK 기본값 10분까지 hang 가능
- `generateParallelItineraries` (line 693) 는 30일 여행에 **30개 일별 순차 호출** 발생 (BATCH_SIZE=5 → 6 batches)
- 실제 로그: 각 호출 13-28초 × 30 = **happy path 4-6분**, stall 시 8-15분
- Frontend `createTripWithPolling` (`api.ts:406`) — `maxPolls=300` (5분 캡) → **backend 완료 전에 client polling timeout**

**Defect C — 취소는 클라이언트 전용, 백엔드 잡은 계속 실행 (CRITICAL)**
- `CreateTripScreen.tsx:314-319` + `api.ts:408-414` — Cancel은 `clearInterval`만 함
- Backend에 `DELETE /trips/jobs/:jobId` 엔드포인트 없음
- `jobs.service.ts` — 취소 메서드 자체가 없음
- `trips.controller.ts:96-100` — `setImmediate` fire-and-forget, `req.aborted` 리스너 없음
- 결과: Cancel 후에도 백엔드는 수 분 더 실행 → 성공 또는 fallback → 고아 trip DB에 커밋 + 쿼터 소비

**Defect D — 재클릭 경로**
- Cancel 후 `isCreatingRef = false` 리셋되나 클라이언트 쿼터 state는 stale
- 재클릭 → 새 `create-async` POST → 쿼터 **또** 증가 (limit 미달 시) + 이전 잡도 여전히 실행 중
- "여행 생성 실패" 토스트는 두 번째 잡의 에러, 그 사이 첫 잡이 조용히 빈 trip 커밋

**Defect E — 폼 미초기화 (#5와 연결)**
- `CreateTripScreen.tsx:492` — 성공 경로만 form state 초기화
- Cancel/AbortError 경로 (506-518) 는 `isLoading/isCreatingRef` 만 flip, `destination/dates/preferences` 유지
- 수동 생성이 초기화되는 것처럼 보이는 이유: 수동은 <2초에 성공 → unmount → 새 mount 시 fresh state
- 즉, 자동이 초기화되는 게 아니라 **자동-취소 경로는 초기화 코드에 도달조차 못 함**

### Evidence
- `trips.service.ts:142-150` 쿼터 increment BEFORE AI
- `trips.service.ts:356-375` AI catch 조용히 fallback
- `trips.service.ts:379` 무조건 `commitTransaction()`
- `ai.service.ts:845-855` signal/timeout 부재
- `ai.service.ts:693-732` 30일 → 30 sequential calls
- `trips.controller.ts:96-100` setImmediate fire-and-forget
- `jobs.service.ts:1-124` 취소 메서드 없음
- `api.ts:406` maxPolls=300 (5분 캡)
- **로그**: 2026-04-14 10:22:39 quota increment, 10:22:57 첫 AI call

### Fix direction (priority order)

1. **쿼터 증가를 AI 성공 후로 이동** (`trips.service.ts:142-151`)
   - Best: `if` 블록 안 line 350 (aiStatus='success' 설정 직후, commit 전)
   - Alternative: 증가-후-롤백 유지하되 AI catch(356)를 **rethrow**로 변경 → 외부 catch(383)가 rollbackTransaction 실행
   - 어느 경로든: **silent fallback 372-374는 쿼터 유지 금지**
   - AI 실패 시 "빈 trip 생성하겠습니까?" 를 사용자 선택으로

2. **OpenAI streaming timeout + AbortSignal** (`ai.service.ts:837`)
   - `{signal: abortSignal}` 두 번째 인자로 전달
   - for-await 루프를 `setTimeout(45_000)` 과 race, 타임아웃 시 `stream.controller.abort()`
   - 30일 × 45s × 6 batches = 최악 4.5분, 평균 2분
   - Outer-level 전체 예산 180s on `generateAllItineraries`

3. **백엔드 진짜 취소 구현**
   - `DELETE /trips/jobs/:jobId` → `JobsService.cancelJob(jobId)` AbortController flip
   - Signal을 `tripsService.create → aiService.generateAllItineraries → streamCompletion` 까지 전달
   - Cancel 시: rollbackTransaction (쿼터 + trip row 전부), job status `cancelled`
   - Frontend `handleCancelCreation` 이 DELETE 호출 후 `controller.abort()`

4. **Frontend polling budget 정렬** (`api.ts:406`)
   - `maxPolls` 300→600 (10분) OR backend 하드 180s 문서화 후 300 유지
   - 진행률 표시: `current_day / total_days` (backend에 이미 dayNumber loop 있음)

5. **폼 초기화 수정** (`CreateTripScreen.tsx:314-319, 506-518`)
   - `resetForm()` helper 추출 → AbortError catch, error toast, navigation away 모두에서 호출

6. **30일 chunking 개선** (`ai.service.ts:693`)
   - 30-call 루프 → 7-10일 chunk (3-4 calls)
   - 총 지연 5분 → 30-60초
   - Promise.all 진짜 병렬화 가능, rate-limiting 감소

### Regression tests
- Unit: `trips.service.spec.ts` — AI throw 시 quota 유지, partial failure 시 orphan trip 없음, cancel 시 rollback
- Integration: POST → immediate DELETE → quota 유지 + no orphan + cancelled status
- E2E: 30일 happy path <300s quota -1, 취소 시 quota unchanged

### Files
- `backend/src/trips/trips.service.ts` (60-397)
- `backend/src/trips/trips.controller.ts` (83-167)
- `backend/src/trips/jobs.service.ts` (전체, 취소 메서드 추가 필요)
- `backend/src/trips/services/ai.service.ts` (446-758, 837-896)
- `backend/src/trips/services/weather.service.ts` (날씨는 red herring, 5일 캡)
- `frontend/src/services/api.ts` (377-490)
- `frontend/src/screens/trips/CreateTripScreen.tsx` (306-680)

---

## #8 — 구독자 20/30 4회차 재발 (CRITICAL UI 버그, V109~V112 연속)

### Definitive root cause

**두 개의 독립된 root cause가 겹쳐있고, 이전 수정은 한 층씩만 건드려서 증상이 계속 재발함.**

**Root cause #1 (UI layer — V109/V110/V111에서 한 번도 건드리지 않음)**
- `frontend/src/screens/trips/CreateTripScreen.tsx:1576-1592`
- `isPremium || isAdmin` 이면 **하드코딩 마케팅 문자열** `"프리미엄: 월 30회 AI 자동 생성 가능"` (line 1580) 렌더링
- 즉, `t('create.aiInfo.remaining', { remaining, total })` 는 premium 브랜치에서 **단 한 번도 호출되지 않음**
- **"X/30 남음" 포맷이 premium 렌더 경로에 존재하지 않음**
- `ProfileScreen.tsx:482` 도 동일 문제 + `total: 3` 하드코딩

**Root cause #2 (backend contract)**
- `backend/src/subscription/subscription.service.ts:87-100` — premium 사용자에게 `aiTripsLimit: -1`, `aiTripsRemaining: -1` 반환 ("unlimited" sentinel)
- Frontend가 premium에서 X/Y를 렌더링하려고 해도 `-1/-1` 받음 → "생성 가능 횟수 확인 중..." 로 fallback (`CreateTripScreen:1582`)
- `PremiumContext.tsx:120-124` 는 로컬 상수 `AI_TRIPS_PREMIUM_LIMIT = 30` 으로 clamp 하지만, `getSubscriptionStatus()` 엔드포인트 (SubscriptionScreen 사용) 는 여전히 `-1` 반환

**결합된 결과**:
- Backend `-1` + CreateTripScreen 하드코딩 "월 30회" + ProfileScreen 하드코딩 `total: 3` + **3개 다른 source of truth**
- = 4 버전 동안 잘못된 파일을 고친 이유

### Why previous fixes failed

| Version | Commit | What was changed | Why it didn't work |
|---|---|---|---|
| V109 | 95ebf855 | `AuthContext.tsx` 에 `getProfile()` 호출 추가 | free user의 `aiTripsUsedThisMonth` undefined는 고쳤지만, premium 사용자는 어떤 값이든 **JSX가 X/Y 템플릿으로 분기조차 안 함** |
| V110 | c6c682d5 | form-reset, coachmark, thumbnails | AI counter 렌더 경로에 있는 파일 **0개** 건드림 |
| V111 | 4cb7ba55 | RevenueCat webhook 복구로 `subscriptionTier='premium'` 저장 정상화 | 필수였으나 직교 — `subscriptionTier='premium'` 이 정상 도착해도 line 1580은 여전히 마케팅 문자열 출력 |

각 수정은 **데이터 파이프라인**만 공격 (auth → profile → subscriptionTier → context). 아무도 CreateTripScreen 1576라인의 `if (isPremium || isAdmin) { return 마케팅 string }` 를 보지 못함.

### Affected files (duplication map)

AI 쿼터를 렌더링하는 모든 위치 — 공유 렌더러 없음:

1. `CreateTripScreen.tsx:1576-1592` — **주 버그 위치**, "이번 달 AI 자동 생성 X/Y회 남음" 배너, 1580에 하드코딩 premium 문자열
2. `CreateTripScreen.tsx:459-466` — post-ad 토스트, `remaining: 1, total` 리터럴 (`!isPremium` 게이트)
3. `CreateTripScreen.tsx:617, 839` — limit-reached fallback `aiTripsLimit > 0 ? aiTripsLimit : 3` (`>0`으로 backend `-1` 조용히 삼킴)
4. `ProfileScreen.tsx:482` — `total: 3` 하드코딩 + `!isPremium` 게이트
5. `SubscriptionScreen.tsx:29,161` — 진행률 바는 `aiTripsRemaining`, limit/used 텍스트는 `getSubscriptionStatus()` 응답 (`-1`)
6. `PaywallModal.tsx:229-231` — `t('promo.aiWarning', {remaining})` — `{{total}}` 슬롯 **없음**
7. `PremiumContext.tsx:121` — 로컬 상수 `AI_TRIPS_PREMIUM_LIMIT = 30`, **3번째 source of truth**
8. `backend/src/subscription/subscription.service.ts:87-100` — `-1` sentinel 발생지
9. `frontend/src/i18n/locales/*/premium.json` (`aiWarning`) — 17개 언어가 `"{{remaining}}회 남음"`, `{{total}}` 슬롯 없음
10. `frontend/src/i18n/locales/*/trips.json` (`aiInfo.remaining`) — 올바른 `{{remaining}}/{{total}}` 템플릿, premium 브랜치가 호출 안 함

### Fix direction (단일 source of truth)

1. **Backend**: `-1` sentinel 제거. 양쪽 tier 모두 실제 숫자 반환:
   - `aiTripsLimit: isPremium ? AI_TRIPS_PREMIUM_LIMIT : AI_TRIPS_FREE_LIMIT`
   - `aiTripsRemaining = max(0, limit - used)`
   - `AI_TRIPS_PREMIUM_LIMIT = 30` 을 **shared constant** 로 (`subscription.service.ts`에서 정의, `/api/config` 엔드포인트로 노출 또는 frontend 로 공유)
   - 옵션: discriminated union `{kind: 'unlimited'} | {kind: 'metered'; limit; used; remaining}`

2. **Frontend**: `CreateTripScreen.tsx:1576-1581` 의 `if (isPremium || isAdmin)` 브랜치 **삭제**. Premium/free 공통으로 `t('create.aiInfo.remaining', {remaining, total})` 렌더링. `>0 ? : 3` fallback (460/617/839/1589/1590) 전부 제거.

3. **Frontend**: `ProfileScreen.tsx:482` 의 `total: 3` 하드코딩 제거. context의 `aiTripsLimit` 사용. `!isPremium` 게이트 제거.

4. **Frontend**: `<AiQuotaLabel />` 단일 컴포넌트 추출. CreateTripScreen, ProfileScreen, SubscriptionScreen, PaywallModal, post-ad toast 모두 사용. **하나의 렌더러, 하나의 i18n 키**.

5. **i18n**: 17개 언어의 `premium.aiWarning` 에 `{{total}}` 슬롯 추가, OR PaywallModal이 `trips.json`의 `create.aiInfo.remaining` 사용.

6. **PremiumContext**: `AI_TRIPS_PREMIUM_LIMIT` 로컬 상수 삭제. Backend 응답의 `aiTripsLimit` 사용. Source of truth #3 제거.

### Regression test (4 버전 전에 잡았어야 할 것)

```tsx
describe('CreateTripScreen AI quota banner', () => {
  it.each([
    ['free, 2 used',     { isPremium: false, aiTripsUsed: 2 }, '이번 달 AI 자동 생성 1/3회 남음'],
    ['free, 0 used',     { isPremium: false, aiTripsUsed: 0 }, '이번 달 AI 자동 생성 3/3회 남음'],
    ['premium, 10 used', { isPremium: true,  aiTripsUsed: 10 }, '이번 달 AI 자동 생성 20/30회 남음'],
    ['premium, 0 used',  { isPremium: true,  aiTripsUsed: 0 },  '이번 달 AI 자동 생성 30/30회 남음'],
  ])('renders %s correctly', (_, ctx, expected) => {
    render(<CreateTripScreen />, { wrapper: makePremiumWrapper(ctx) });
    expect(screen.getByText(expected)).toBeOnTheScreen();
  });
});
```

Premium 행이 **V109에서 실패**했을 것 — output `"프리미엄: 월 30회 AI 자동 생성 가능"`. 한 번의 실패 assertion이 AuthContext/webhook/profile-loading 대신 CreateTripScreen:1580 으로 수정을 라우팅했을 것 → 버그가 4 버전 동안 추적되지 않고 1회에 사망.

---

## #10 — 4/14 오류 로그 분석

### Error Count & Summary (2026-04-14 00:00-24:00 KST)

**Total: 4 기록**

| # | Time | Category | Account | Type | Notes |
|---|---|---|---|---|---|
| E1 | 10:26:19 | Frontend Trip | hoonjae723 | error | "Monthly AI generation limit (3) reached" |
| E2 | 10:25:35 | Frontend Trip | hoonjae723 | error | "Trip creation cancelled" |
| E3 | 10:15:32 | Backend Auth | web anonymous | warning | "회원가입에 실패했습니다" |
| E4 | 10:16:03 | Backend Auth | web anonymous | warning | "회원가입에 실패했습니다" |

48시간 컨텍스트: 53개 기록, 대부분 analytics/destination-recommendations 경고. **5xx critical 0건**.

### Top 5 critical errors + hypothesis

**E1. `Monthly AI generation limit (3) reached`**
- **진짜 유형**: 비즈니스 규칙 throw, 시스템 버그 아님
- **가설**: **false positive in error_logs**. PaywallError를 `severity=error`로 로깅 중 → 정보/경고로 분류해야 함
- **반복성**: Yes, 매 쿼터 소진 사용자마다 노이즈

**E2. `Trip creation cancelled`**
- **진짜 유형**: 사용자 취소, 에러 아님
- **가설**: AbortController signal reject → frontend가 예외로 로깅
- **반복성**: Yes, 모든 abort에서
- **연결**: E2 → E1 순서는 쿼터 막힌 재시도 루프 시사 (#6 이슈와 연결)

**E3+E4. `회원가입에 실패했습니다`**
- **진짜 유형**: `BadRequestException` from `auth.service.ts:85`
- **가설**: **V112 #1 (웹 우회 가입) + #3 (미인증 가입) 과 교차**. Web client가 여전히 register 시도 중. 31초 간격은 동일 사용자 재시도. **Generic error message가 실제 원인을 숨김**
- **반복성**: Yes, web flow가 V111/V112 backend tightening과 정렬 안 됨

**E5 (broader). 30× `GET /api/analytics/destination-recommendations` 경고**
- 4xx warnings, 고볼륨
- 가설: auth/throttle 401/429 또는 empty-result 404
- **데이터셋 중 신호 대비 잡음 비율 최고**

### Cross-reference with V112 known issues

| V112 Issue | Related Error | Link |
|---|---|---|
| #1 웹 우회 가입 | E3, E4 | Web register endpoint이 요청 수락하지만 validation 실패 → web flow 잠금 필요 확인 |
| #3 미인증 가입 | E3, E4 | Generic 400이 "emailVerified=false" 리젝션 은폐 가능성 |
| #6 30일 무한로딩 | None | 매칭 서버 에러 없음 → 클라이언트 쿼리 stuck |
| RevenueCat webhook (V111-4) | E1 | 쿼터 enforcement 정상 작동 — webhook fix 검증됨 |

### Prevention plan

**P0 (V113 즉시)**
1. **Frontend error logger filter** — `PaywallError`, `QuotaExceededError`, `AbortError`, `CancelledError` 를 `error_logs` ingestion에서 제외. E1, E2 + 미래 노이즈 해결.
2. **Auth register error specificity** — generic `회원가입에 실패했습니다` 를 discriminated codes로 교체 (`EMAIL_EXISTS`, `EMAIL_NOT_VERIFIED`, `CONSENT_MISSING`, `WEAK_PASSWORD`). 사용자 메시지는 generic 유지하되 서버 로그에 discriminant 기록. E3, E4 근본 원인 가시성 확보 + #1/#3 진단 unblock.

**P1 (V113 sprint)**
3. **`destination-recommendations` 4xx investigation** — 48h에 30 경고는 최대 실제 신호. Throttle 또는 empty-cache fallback 버그 가능.
4. **Severity taxonomy** — `info` (expected business), `warning` (4xx user input), `error` (5xx system), `critical` (data loss). `AllExceptionsFilter` 매핑 업데이트.

**P2 (기술 부채)**
5. Register endpoint negative tests (each rejection branch), ai.service quota-exhausted unit test (`PaywallError` assertion), CreateTripScreen abort test (no error log emitted).
6. Admin error log 화면: `severity=warning` 기본 숨김, "User Behavior" 탭과 "System Errors" 탭 분리.

### Summary
- **Real system bugs on 4/14**: 0
- **Logging hygiene bugs**: 2 (E1, E2 false positives)
- **Backend visibility gap**: 1 (E3/E4 generic auth error, intersects V112 #1/#3)
- **No correlation with V112 #6**: Issue가 client-side, frontend 보고 없이는 error_logs에 안 뜸
- **RevenueCat webhook**: E1을 통해 healthy 확인

### Files
- `backend/src/auth/auth.service.ts` (line 85)
- `backend/src/common/filters/all-exceptions.filter.ts` (severity taxonomy)
- `frontend/src/screens/trips/CreateTripScreen.tsx` (PaywallError/AbortError 로깅 제외)
- `frontend/src/services/errorLogger.ts` (global error reporter exclusion list)
