# V171 Alpha 테스트 결과 — 근본 원인 분석 및 수정 계획

- **작성일**: 2026-04-24
- **대상 버전**: V171 (versionCode 171) → **V172 (versionCode 172)**
- **브랜치**: `main`
- **테스트 계정**: `longpapa82@gmail.com` (Alpha License Tester)
- **보고자**: 사용자 (testResult.md L1~21)

---

## 📋 Executive Summary

V171 Alpha에서 **3개 영역 6개 이슈**가 보고되었다. 전체 영향도는 **CRITICAL**이며, 특히 **"여행 생성 실패 시에도 AI 카운터 차감"** 이슈는 결제 분쟁 및 환불 클레임 리스크가 있어 **P0 차단**으로 분류한다.

| ID | 영역 | 심각도 | 핵심 원인 | P 등급 |
|----|------|--------|----------|--------|
| 1-A | 기간 버튼 선택 시 startDate=오늘 | HIGH | `setDurationDays`는 이미 내일부터 설정되지만, **`minimumDate`가 오늘로 이전 수정되었는지 확인 필요** → 실제로는 **버그가 아닐 수 있음** (재현 확인 필수) | P1 |
| 1-B | 수동 입력과 버튼 선택 상호 배제 | MEDIUM | `duration === option.days` 비교 로직 이해 문제 — 실제로는 DatePicker와 버튼 모두 `startDate/endDate` state 공유 → **실제 코드상 둘 다 동작해야 함**. 재현 시나리오 확인 필요 | P1 |
| 1-C | **AI 생성 실패 시 카운터 차감** | **CRITICAL** | Phase A에서 quota increment 후 commit → Phase B에서 AI 실패 시 rollback 되지 않음. 주석(L641)에서 "correct behavior"라고 명시했으나 UX상 잘못된 판단 | **P0** |
| 1-D | 재진입 시 이전 정보 유지 | LOW | `focus` listener로 초기화 구현됨. 특정 네비게이션 경로(goBack vs navigate)에서 focus 이벤트가 발생하지 않을 가능성 | P2 |
| 2 | 4/25 ErrorLog 신규 누적 | HIGH | V170 배포 후 신규 5xx. admin ErrorLog 화면 조회 + Sentry 조회 필요 | P1 |
| 3 | longpapa82 구독 상태 지속 | MEDIUM | `isAdmin=true`(ADMIN_EMAILS)이지만 `trips.service.ts` quota bypass는 `role='admin'` (DB) 기준 → **분기 불일치** 가능성. DB role 컬럼 실측 필요 | P1 |

---

## Phase 1. 근본 원인 분석

### Issue 1-A. 기간 버튼 선택 시 startDate=오늘 (P1)

**증상**: 사용자가 [당일], [1박 2일], [3일] 버튼을 눌렀을 때 출발일이 오늘로 세팅됨 → `handleCreateTrip`의 검증 `if (start <= today)` 에서 차단 → "startDateFuture" 에러 토스트.

**코드 위치**: `frontend/src/screens/trips/CreateTripScreen.tsx:235-245`

```tsx
const setDurationDays = useCallback((days: number) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow);
  const end = new Date(tomorrow);
  end.setDate(end.getDate() + days - 1);
  setStartDate(start.toISOString().split('T')[0]);
  setEndDate(end.toISOString().split('T')[0]);
  ...
}, []);
```

**분석 결과**: 코드상으로는 이미 `tomorrow.setDate(tomorrow.getDate() + 1)` 로 **내일부터 설정**되고 있다. 사용자 보고와 코드가 불일치 — 가능성:
1. **UI 시각 버그**: `DatePickerField`가 내일 날짜를 "오늘"로 잘못 렌더링 (timezone 이슈 가능)
2. **검증 오독**: 사용자가 버튼을 누른 후 DatePicker를 **한 번 더 탭** 하여 오늘로 수동 변경하고 있을 가능성
3. **L1247 `minimumDate={minStartDate}` 문제**: `minStartDate`는 내일이지만 DatePicker iOS/Android 네이티브가 로컬 타임존 변환 시 오늘로 렌더링할 수 있음

**근본 원인 후보**:
- **Timezone drift**: `start.toISOString().split('T')[0]`는 UTC 기준. 사용자가 KST(+9) 23시에 버튼을 누르면 tomorrow는 UTC 기준 오늘 15시 → `toISOString()` = 오늘 날짜. → **실제 root cause 가능성 높음**.

**수정 방향**:
- **ISO 날짜를 로컬 타임존 기준으로 포매팅**. `formatLocalDate(date: Date): string`을 추가하여 `YYYY-MM-DD` 로컬 문자열 반환.

---

### Issue 1-B. 수동 입력 시 버튼 해제 + "기간 미입력" 인식 (P1)

**증상**: 사용자가 DatePickerField로 날짜를 직접 선택했을 때 상단 버튼이 **파란색(isSelected)**에서 **해제**되고, 이 상태에서 [여행 생성] 버튼을 누르면 "기간이 입력되지 않음" 에러가 발생한다는 보고.

**코드 위치**: `frontend/src/screens/trips/CreateTripScreen.tsx:1189-1207, 1238-1266, 288-300`

```tsx
// L1190: 버튼 선택 상태 계산
const isSelected = duration === option.days;

// L269-275: duration 계산
const calculateDuration = useCallback((): number | null => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}, [startDate, endDate]);

// L288: 검증
if (!startDate || !endDate) {
  errors.dates = t('create.alerts.datesRequired');
}
```

**분석 결과**: **단일 진실 소스(single source of truth)인 `startDate/endDate` state**가 버튼 선택과 DatePicker에서 모두 업데이트되므로, **코드상으로는 둘 다 정상 동작해야 한다**. 버튼의 isSelected 표시가 해제되는 것은 단지 **duration 일치 여부**에 따른 시각 효과일 뿐이며, 제출 시점에는 `startDate/endDate`만 검증된다.

**근본 원인 가설**:
1. **사용자 혼동 시나리오**: 사용자가 [1박 2일] → DatePicker에서 시작일만 변경 → endDate는 그대로 → duration 바뀜 → 버튼 해제됨 → **사용자가 '상태가 초기화되었다고 오해'** 하고 생성 시도 → 성공하지만 UX 혼란
2. **실제 버그 시나리오**: DatePicker에서 `endDate`만 바꾸면 `startDate`가 reset 되는 경쟁 조건 (확인 필요)
3. **Timezone 조합 이슈**: 1-A와 같은 timezone drift로 `startDate="2026-04-24"`, `endDate="2026-04-25"` 저장되지만 `new Date(startDate)` 파싱 시 `T00:00:00 UTC`로 취급되어 검증 로직에서 `start <= today`로 차단

**수정 방향**:
- 1-A 수정(로컬 타임존 포매팅)으로 동시 해결 가능성 높음
- 추가로: **수동 입력 시 해당하는 duration 버튼을 auto-select** 하도록 `isSelected` 로직 유지 (UX 개선)
- 에러 메시지 개선: `t('create.alerts.startDateRequired')` → 구체적으로 어떤 필드가 잘못됐는지 표시

---

### Issue 1-C. **[P0] 여행 생성 실패 시에도 AI 카운터 차감**

**증상**: AI 여행 생성이 실패했는데 `aiTripsUsedThisMonth`가 증가 → 재시도 시 "3/3 limit reached" 결제 압박 발생.

**코드 위치**: `backend/src/trips/trips.service.ts:122-656`

```ts
// L150-232: Phase A — quota increment + trip creation (inside transaction)
const phaseARunner = this.dataSource.createQueryRunner();
await phaseARunner.startTransaction();

try {
  // L214-221: Increment quota BEFORE AI generation
  if (user.users_role !== 'admin') {
    await phaseARunner.manager
      .createQueryBuilder()
      .update('users')
      .set({ aiTripsUsedThisMonth: () => 'aiTripsUsedThisMonth + 1' })
      .where('id = :userId', { userId })
      .execute();
  }

  // L236-243: Create trip with aiStatus='generating'
  const trip = phaseARunner.manager.create(Trip, { ... aiStatus: 'generating' });
  savedTrip = await phaseARunner.manager.save(trip);

  // L246: Phase A COMMITS — quota decremented, trip saved
  await phaseARunner.commitTransaction();
} catch (error) {
  await phaseARunner.rollbackTransaction(); // ✅ Handles DB errors only
  throw error;
}

// L262-552: Phase B — AI generation (NO transaction, external API calls 10-144s)
try {
  const aiItineraries = await aiPromise;
  finalAiStatus = 'success';
} catch (error) {
  finalAiStatus = 'failed';
  // ❌ Fallback: empty itineraries. Quota already charged.
  itineraryData = buildEmptyItineraries(weatherMap);
}

// L640-651: Pipeline catch-all
} catch (error) {
  // 🚨 L641-642 comment: "Phase A is already committed — quota stays decremented (correct behavior)."
  // This is WRONG from UX perspective — user did not receive the service they were charged for.
  await markTripFailed(`Pipeline error: ${getErrorMessage(error)}`);
  throw error;
}
```

**근본 원인**: 
- **트랜잭션 경계가 경제적 의미와 분리되어 있음**. Phase A는 "DB 일관성" 목적으로 quota↔trip row 생성을 원자적으로 묶었으나, **유저 관점에서 가치는 AI itinerary 생성이 성공해야 제공됨**.
- 현재 설계(L641 주석)는 "trip row는 남았으니 quota도 차감 유지가 맞다"는 논리이나, **실제로는 aiStatus='failed' 상태로 itinerary가 빈 상태인 trip은 사용자 관점에서 '실패'이므로 환불(refund) 처리가 맞다**.

**의도된 설계 vs 실제 UX 불일치**:
| 관점 | 현재 동작 | 기대 동작 |
|------|----------|----------|
| DB 정합성 | ✅ 완벽 (trip↔quota 원자적) | 유지 |
| 유저 UX | ❌ "실패했는데 왜 차감?" | quota 복원 |
| 결제 분쟁 | ❌ Google Play 환불 요청 발생 가능 | 차단 |

**수정 전략 (2가지 중 택1)**:

**Option A (권장): Saga 패턴 — AI 실패 시 quota 복원**
- Phase B의 `catch (error) { finalAiStatus = 'failed'; }` 블록에 **quota 복원 로직 추가**
- Phase C 또는 별도 short transaction에서 `aiTripsUsedThisMonth: () => 'GREATEST(aiTripsUsedThisMonth - 1, 0)'`
- 장점: 최소 변경, 기존 3-Phase 구조 유지
- 단점: 복원 자체가 실패하면 이중 장부 (추가 idempotent compensation 필요)

**Option B: quota increment을 Phase C 직전으로 이동**
- Phase A: 기존 trip row 생성만
- Phase B: AI 생성 (실패 시 fallback itinerary)
- **Phase C 직전**: quota increment (AI 성공 시만) 또는 AI 실패 시 스킵
- 장점: 설계가 경제적 의미와 일치
- 단점: Phase A↔quota 원자성 상실 → race condition 재발 가능 (단, row-level lock으로 방어 가능)

**결정**: **Option A** (saga 패턴). 이유: (1) 기존 race condition 방어 구조 유지, (2) compensation이 idempotent 하게 쉽게 구현 가능, (3) `aiStatus='failed'` 플로우에만 영향.

**구현 세부**:
```ts
// L543 부근, catch 블록 내부:
} catch (error) {
  if (error instanceof TripCancelledError || signal?.aborted) {
    // Compensation: restore quota on cancel too (user didn't receive service)
    if (!isManualMode && user.users_role !== 'admin') {
      await this.restoreAiQuota(userId, savedTrip.id, 'cancelled');
    }
    ...
    throw error;
  }
  
  finalAiStatus = 'failed';
  
  // Compensation: restore quota on AI failure
  if (!isManualMode && user.users_role !== 'admin') {
    await this.restoreAiQuota(userId, savedTrip.id, 'ai_failed');
  }
  ...
}
```

```ts
// 새 헬퍼 메서드 — idempotent 보장
private async restoreAiQuota(userId: string, tripId: string, reason: string): Promise<void> {
  try {
    // Only restore if this trip hasn't already been compensated
    // (idempotency: mark trip with quotaRefunded=true after successful compensation)
    const result = await this.tripRepository.manager
      .createQueryBuilder()
      .update('trips')
      .set({ quotaRefunded: true })
      .where('id = :tripId AND quotaRefunded = false', { tripId })
      .execute();
    
    if (result.affected === 0) {
      this.logger.warn(`Quota already refunded for trip ${tripId}, skipping`);
      return;
    }
    
    await this.userRepository
      .createQueryBuilder()
      .update('users')
      .set({ aiTripsUsedThisMonth: () => 'GREATEST("aiTripsUsedThisMonth" - 1, 0)' })
      .where('id = :userId', { userId })
      .execute();
    
    this.logger.log(`[Saga] Refunded AI quota for user ${userId} (trip ${tripId}, reason: ${reason})`);
  } catch (err) {
    this.logger.error(`[Saga] Failed to refund AI quota for trip ${tripId}: ${getErrorMessage(err)}`);
    // Don't throw — compensation failure should not mask original error
  }
}
```

**스키마 추가**: `trips.quotaRefunded BOOLEAN DEFAULT FALSE` 컬럼 — idempotency 가드.

---

### Issue 1-D. 재진입 시 이전 정보 유지 (P2)

**코드 위치**: `frontend/src/screens/trips/CreateTripScreen.tsx:743-784`

```tsx
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    setDestination('');
    setStartDate('');
    setEndDate('');
    setNumberOfTravelers(1);
    // ... 모든 필드 초기화
  });
  return unsubscribe;
}, [navigation]);
```

**분석**: `focus` 리스너는 **화면이 포커스를 얻을 때마다** 실행된다. 하지만:
1. **탭 네비게이션에서 같은 탭을 다시 누르면** focus 이벤트가 발생하지 않을 수 있음 (React Navigation 버전 의존)
2. **Deep link로 직접 진입** 시 focus보다 먼저 useEffect(mount)가 실행되어 `route.params`의 값이 초기화보다 먼저 세팅될 수 있음
3. **V124~V168 유사 이력**: "새 여행 만들기 화면 진입 시 이전 입력이 남아있음" — V166에서도 "간헐적"으로 보고됨

**근본 원인 가설**: **`focus` 이벤트는 Stack 네비게이션 push/pop 시에만 신뢰 가능**. Tab 이동이나 Modal dismiss 후 같은 스크린은 focus가 안 뜰 수 있음.

**수정 방향**:
- `focus` 리스너 + **mount 시점 1회 초기화**를 함께 적용 (이중 보장)
- 또는 **`useFocusEffect` + `useCallback`** 로 전환 (React Navigation 공식 권장 패턴)

---

### Issue 2. 4/25 ErrorLog 신규 누적 (P1)

**조치**: 본 계획서 작성 시점에는 DB 접근 불가. 다음 작업 필요:

1. **SSH → 프로덕션 서버**: `ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127`
2. **Postgres 접근**: `docker compose exec postgres psql -U travelplanner`
3. **쿼리 실행**:
   ```sql
   SELECT id, timestamp, severity, "errorType", "errorMessage", path, "userId", "statusCode"
   FROM error_log
   WHERE timestamp >= '2026-04-25'::date
   ORDER BY timestamp DESC
   LIMIT 100;
   ```
4. **집계 쿼리**:
   ```sql
   SELECT "errorType", "statusCode", COUNT(*) AS count, MIN(timestamp) AS first, MAX(timestamp) AS last
   FROM error_log
   WHERE timestamp >= '2026-04-25'::date
   GROUP BY "errorType", "statusCode"
   ORDER BY count DESC;
   ```
5. **Sentry 대시보드 확인**: `aisoft-p7.sentry.io` — V171 (4/23 배포) 이후 신규 이슈 필터.

**체크리스트**:
- [ ] Top 3 에러 타입 식별
- [ ] 각 에러의 발생 빈도 및 영향 사용자 수
- [ ] 신규 회귀 vs 기존 이슈 분류
- [ ] 각 건별 P0/P1/P2 분류 후 수정 결정

---

### Issue 3. longpapa82 구독 상태 지속 (P1)

**현재 가설 3가지 검증 절차**:

**가설 1**: `longpapa82@gmail.com`이 `ADMIN_EMAILS` env에 포함 → UI에서 `isAdmin=true`로 무한 구독 표시
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 'grep ADMIN_EMAILS /root/travelPlanner/backend/.env'
```

**가설 2**: `users.role='admin'` → `trips.service.ts` quota bypass 활성
```sql
SELECT id, email, role, "subscriptionTier", "subscriptionExpiresAt", "subscriptionStartedAt", "aiTripsUsedThisMonth"
FROM users WHERE email = 'longpapa82@gmail.com';
```

**가설 3**: RevenueCat sandbox에서 License Tester가 갱신되어 `subscriptionExpiresAt`이 미래 값으로 갱신됨
- RevenueCat 대시보드에서 해당 사용자의 구매/갱신 이벤트 타임라인 확인
- `subscription_logs` 테이블 (있다면) 확인

**발견된 분기 불일치 (추가 리스크)**:

| 위치 | 분기 기준 | 영향 |
|------|----------|------|
| `subscription.service.ts:100` | `email` in `ADMIN_EMAILS` env | UI에 `isAdmin=true` 표시 |
| `trips.service.ts:183,214,223` | `user.users_role === 'admin'` (DB) | 실제 AI 생성 시 quota bypass |
| `admin.guard.ts:21` | `email` in `ADMIN_EMAILS` OR `role='admin'` | 관리자 API 접근 권한 |

→ **longpapa82가 env에는 있지만 DB role='user'인 경우**: 프로필에서 "관리자"로 보이지만 실제 AI 생성 시 **quota가 차감됨**. 사용자가 3회 초과 시 실패.

**수정 방향**:
- `trips.service.ts`의 admin 판정도 **email 기반으로 통일** (또는 세 곳 모두 DB role 기반으로 통일)
- 일관성 확보: `isUserAdmin(user)` 헬퍼를 `subscription.service.ts` 또는 `auth/guards/admin.guard.ts`에서 export → `trips.service.ts`에서도 import

---

## Phase 2. 수정 계획 (파일/라인/함수 단위)

### P0 — 즉시 차단 (1-C)

#### 수정 2.1: DB 스키마 — `trips.quotaRefunded` 컬럼 추가
- **파일**: `backend/src/migrations/<timestamp>-AddTripQuotaRefunded.ts` (신규)
- **엔티티**: `backend/src/trips/entities/trip.entity.ts`
  ```ts
  @Column({ type: 'boolean', default: false, name: 'quotaRefunded' })
  quotaRefunded: boolean;
  ```
- **Migration up**:
  ```sql
  ALTER TABLE trips ADD COLUMN IF NOT EXISTS "quotaRefunded" BOOLEAN NOT NULL DEFAULT FALSE;
  ```

#### 수정 2.2: `SubscriptionService.decrementAiTripCount` 메서드 추가
- **파일**: `backend/src/subscription/subscription.service.ts`
- **위치**: L149 `incrementAiTripCount` 바로 아래
- **구현**:
  ```ts
  async decrementAiTripCount(userId: string): Promise<void> {
    // GREATEST 가드: 0 미만으로 내려가지 않도록
    await this.userRepository
      .createQueryBuilder()
      .update('users')
      .set({ aiTripsUsedThisMonth: () => 'GREATEST("aiTripsUsedThisMonth" - 1, 0)' })
      .where('id = :userId', { userId })
      .execute();
  }
  ```

#### 수정 2.3: `TripsService.restoreAiQuota` saga 메서드 추가
- **파일**: `backend/src/trips/trips.service.ts`
- **위치**: `markTripFailed` 헬퍼 근처 (L272~284)
- **구현**: 위 Phase 1 Issue 1-C 섹션 코드 참조
- **호출 지점**: 
  - L526-534 (AI 생성 cancel)
  - L536-552 (AI 생성 실패 — fallback 진입 시)
  - L644 (pipeline-level catch)

#### 수정 2.4: quota 차감 bypass — admin 판정 통일
- **파일**: `backend/src/trips/trips.service.ts:183,214,223`
- **기존**: `user.users_role === 'admin'`
- **변경**: SELECT에 `email` 추가 + `isAdminBypass = role === 'admin' || ADMIN_EMAILS.includes(email.toLowerCase())`
- **공통 헬퍼**: `backend/src/common/utils/admin-check.ts` (신규)
  ```ts
  const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  
  export function isAdminUser(email?: string | null, role?: string | null): boolean {
    if (role === 'admin') return true;
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
  }
  ```

### P1 — 출시 전 수정 (1-A, 1-B, 2, 3)

#### 수정 2.5: Timezone-safe 날짜 포매팅 (1-A 근본 수정)
- **파일**: `frontend/src/utils/dateFormat.ts` (신규 또는 기존)
- **추가 함수**:
  ```ts
  /**
   * Format Date as YYYY-MM-DD in LOCAL timezone (not UTC).
   * Fixes timezone drift: KST 23:00 → toISOString() gives tomorrow's UTC date
   */
  export function formatLocalYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  ```
- **적용 위치**: `CreateTripScreen.tsx:242-243`
  ```tsx
  setStartDate(formatLocalYmd(start));
  setEndDate(formatLocalYmd(end));
  ```
- **적용 위치**: `CreateTripScreen.tsx:291-299` (검증 시 today 비교에도 동일 로직 적용)
- **Grep 대상**: 전 프로젝트에서 `toISOString().split('T')[0]` 검색 → 모든 여행 관련 날짜 처리 일괄 교체
  ```bash
  grep -rn "toISOString().split('T')\[0\]" frontend/src/
  ```

#### 수정 2.6: 수동 입력과 버튼의 UX 일치 (1-B)
- **파일**: `frontend/src/screens/trips/CreateTripScreen.tsx:1190`
- **변경**: `isSelected` 판정에 **사용자가 수동 입력했는지 추적**하는 플래그 불필요 (이미 duration 기반 비교로 OK). 하지만 **에러 메시지 개선**:
  ```tsx
  if (!startDate && !endDate) {
    errors.dates = t('create.alerts.datesRequired');
  } else if (!startDate) {
    errors.dates = t('create.alerts.startDateOnly');
  } else if (!endDate) {
    errors.dates = t('create.alerts.endDateOnly');
  }
  ```
- **i18n 추가** (17개 언어): `create.alerts.startDateOnly`, `create.alerts.endDateOnly`

#### 수정 2.7: `useFocusEffect`로 초기화 전환 (1-D)
- **파일**: `frontend/src/screens/trips/CreateTripScreen.tsx:743-784`
- **변경**: `navigation.addListener('focus', ...)` → `useFocusEffect(useCallback(() => { ... }, []))`
- **이유**: React Navigation 공식 권장. Tab/Stack 모두에서 일관되게 동작.
- **추가**: mount 시점 1회 초기화 useEffect는 유지 (이중 보장)

#### 수정 2.8: ErrorLog 4/25 대응 (2)
- 위 Phase 1 Issue 2 조사 절차에 따라 **admin 콘솔 또는 SSH 쿼리로 실측 후 개별 PR**
- 본 계획서 Phase 4에는 포함하지 않음 (별도 트랙)

#### 수정 2.9: longpapa82 구독 상태 조사 (3)
- **검증 순서**:
  1. `.env` ADMIN_EMAILS 확인
  2. DB `users` 테이블 `role` 확인
  3. RevenueCat 대시보드에서 최근 갱신 이력 확인
- 조사 결과에 따라 분기 처리:
  - **ADMIN**인 경우: 정상 동작, 단 수정 2.4로 일관성 확보
  - **stale cache**인 경우: V155 패턴 (PremiumContext reconciliation) 재점검
  - **서버 expiresAt이 미래**인 경우: RevenueCat webhook 처리 로직 재점검

### P2 — 추후 개선

#### 수정 2.10: 결제/quota 관련 observability 강화
- `api_usage` 로그에 `quotaRefunded=true` 이벤트 추가
- admin 대시보드에 "환불된 AI quota" 통계 섹션 추가

---

## Phase 3. 전체 검수 계획

### 3.1 단위 테스트 (백엔드)

**파일**: `backend/src/trips/trips.service.spec.ts`, `trips.service.ai-limits.spec.ts`

**신규 테스트 케이스**:
```ts
describe('TripsService - AI quota saga (V172)', () => {
  it('AI 생성 실패 시 quota를 복원해야 한다', async () => {
    // Given: free user, aiTripsUsed=2, limit=3
    // When: AI generation throws → fallback path
    // Then: aiTripsUsed === 2 (복원됨, not 3)
  });

  it('AI 생성 cancel 시 quota를 복원해야 한다', async () => {
    // Given: free user, aiTripsUsed=2
    // When: signal.aborted during AI generation
    // Then: aiTripsUsed === 2
  });

  it('quota 복원은 idempotent 해야 한다', async () => {
    // Given: trip.quotaRefunded=true
    // When: restoreAiQuota 재호출
    // Then: aiTripsUsed 변동 없음
  });

  it('admin 유저는 실패 시에도 quota 복원 스킵 (차감 자체를 안했으므로)', async () => {
    // Given: role='admin'
    // When: AI fails
    // Then: restoreAiQuota not called, aiTripsUsed unchanged
  });

  it('ADMIN_EMAILS env 포함 유저도 quota 차감 안됨', async () => {
    // Given: email in ADMIN_EMAILS, role='user'
    // When: AI generation
    // Then: aiTripsUsed unchanged (수정 2.4 검증)
  });
});
```

**커버리지 목표**: 80% 이상 (CLAUDE.md 기준)

### 3.2 단위 테스트 (프론트엔드)

**파일**: `frontend/src/utils/__tests__/dateFormat.test.ts` (신규)

```ts
describe('formatLocalYmd', () => {
  it('KST 23:00에서 tomorrow는 내일 로컬 날짜여야 한다', () => {
    // Given: system time = KST 2026-04-24 23:00
    // When: tomorrow = new Date(); tomorrow.setDate(25)
    // Then: formatLocalYmd(tomorrow) === '2026-04-25'
    // (toISOString().split('T')[0]은 '2026-04-25'이지만 경계값에서 오답 가능성)
  });
  
  it('다양한 timezone에서도 로컬 날짜 반환', () => {
    // Parameterized test for UTC, KST, PST, JST
  });
});
```

### 3.3 통합 테스트 (e2e 시나리오)

**매트릭스 (9 케이스)**:

| # | Duration 입력 방식 | Date 수정 방식 | 기대 결과 |
|---|-----|-----|-----|
| 1 | [당일] 버튼 | 수정 없음 | 내일 시작, 1일 여행 생성 성공 |
| 2 | [1박 2일] 버튼 | 수정 없음 | 내일~모레, 2일 여행 생성 성공 |
| 3 | [3일] 버튼 | 수정 없음 | 내일~3일 후, 3일 여행 생성 성공 |
| 4 | 버튼 선택 후 | DatePicker로 startDate 변경 | 변경된 startDate 기준 생성 성공 |
| 5 | 버튼 선택 후 | DatePicker로 endDate 변경 | duration 재계산, 생성 성공 |
| 6 | 버튼 없이 | DatePicker로 양쪽 직접 입력 | 생성 성공 |
| 7 | [1주일] 버튼 | 수정 없음 | 7일 여행 생성 성공 |
| 8 | [2주일] 버튼 | 수정 없음 | 14일 여행 생성 성공 |
| 9 | [한달] 버튼 | 수정 없음 | 30일 여행 생성 성공 (long trip warning 토스트 노출 확인) |

**AI quota saga 통합 테스트**:
| # | 시나리오 | 선행 조건 | 조작 | 검증 |
|---|-----|-----|-----|-----|
| Q1 | AI 정상 성공 | aiTripsUsed=0 | AI 생성 | aiTripsUsed=1 |
| Q2 | AI 실패 (OpenAI timeout) | aiTripsUsed=2 | AI 생성 (강제 타임아웃) | aiTripsUsed=2, aiStatus='failed' |
| Q3 | AI 실패 후 재시도 | Q2 이후 | AI 재생성 | aiTripsUsed=1 (Q1의 정상 차감만 남음) |
| Q4 | 유저 cancel | aiTripsUsed=0 | 생성 중 취소 | aiTripsUsed=0 |
| Q5 | 이중 복원 방지 | Q2 이후 | restoreAiQuota 직접 재호출 | aiTripsUsed 변동 없음 |

### 3.4 회귀 테스트 (V155~V171 기존 불변식)

**CLAUDE.md 기반 13개 불변식 + V172 추가**:
- [#16~#18] V169 구독 동기화 (단일 진실 소스)
- [#13] Android KAV 금지 원칙 (V159)
- [#14] Animated cleanup 원칙
- [#15] 에러 메시지 i18n 원칙
- **[#19 추가 후보]**: AI quota 차감은 saga 패턴으로 실패/취소 시 자동 복원한다.
- **[#20 추가 후보]**: 사용자 권한(admin) 판정은 `email in ADMIN_EMAILS OR role='admin'`의 단일 헬퍼로 통일한다.
- **[#21 추가 후보]**: 프론트엔드에서 날짜 포매팅은 반드시 `formatLocalYmd` (로컬 타임존) 사용, `toISOString().split('T')[0]` 금지.

**체크리스트 (각 build 후)**:
- [ ] 인원수 동기화 (V155, V165, V167, V169 패턴)
- [ ] Android KAV OOM 재발 없음
- [ ] 이메일 한글 자모 경고 정상
- [ ] 구독 만료 reconciliation 정상
- [ ] Sentry 크래시 보고 정상

### 3.5 수동 QA 체크리스트

**테스트 환경**: Alpha 테스터 기기 (Pixel 6a / Galaxy S22) + License Tester 계정

**기본 플로우**:
- [ ] 로그인 → 새 여행 만들기 → [1박 2일] → 생성 성공 (duration=2, startDate=내일)
- [ ] 새 여행 만들기 재진입 → 모든 필드 초기값 확인
- [ ] [3일] 버튼 → DatePicker로 endDate 변경 → 생성 성공
- [ ] DatePicker로 직접 입력 → 생성 성공
- [ ] AI 모드 + 네트워크 끊고 AI 생성 시도 → 실패 → **quota 복원 확인** (프로필 메뉴에서 remaining 체크)
- [ ] AI 모드 + 취소 버튼 → **quota 복원 확인**
- [ ] 수동 모드 생성 → quota 차감 없음 확인

**경계값**:
- [ ] 자정 직전 (23:55) 버튼 선택 → 다음 날짜로 넘어가는 시점에도 내일 날짜 정상
- [ ] 월말 (4/30) [1박 2일] → 5/1 까지 생성 성공

**구독 상태**:
- [ ] longpapa82 로그인 → 프로필에서 구독 표시 확인
- [ ] DB에서 `aiTripsUsedThisMonth` 값 확인 후 앱에서 동일한 값 표시되는지 확인
- [ ] 다른 계정 (신규 가입자) 로그인 → AI 3회 사용 → 4회째 paywall 정상 노출

---

## Phase 4. 커밋 / 로컬 빌드 / Alpha 배포 계획

### 4.1 커밋 전략

**단일 커밋 (권장)**: `fix(v172): AI 자동 생성 실패 시 quota 복원 + 날짜 timezone drift + 재진입 초기화`

**이유**: P0 (quota refund)와 P1 (timezone) 모두 "여행 생성 실패" 증상을 개선하는 단일 영역. 별도 커밋 시 Alpha 배포 단위가 쪼개져 검수 부담 증가.

**커밋 메시지 초안**:
```
fix(v172): AI 생성 실패 시 quota 복원 saga + 날짜 timezone drift 근본 해결

## V172 핵심 수정

### P0 [CRITICAL] AI 자동 생성 실패 시 quota 차감 (결제 분쟁 리스크)
- 기존: Phase A에서 quota +1 commit 후 Phase B AI 실패 → quota 유지 (차감된 채 남음)
- 수정: Saga 패턴 — AI 실패/취소 시 `restoreAiQuota()` 로 복원
- idempotency: `trips.quotaRefunded` 컬럼 추가, 이중 복원 방지
- 영향 파일: backend/src/trips/trips.service.ts, subscription.service.ts, trip.entity.ts
- 마이그레이션: 1777100000000-AddTripQuotaRefunded.ts

### P0 admin 판정 분기 통일
- 기존: trips.service.ts는 DB role, subscription.service.ts는 ADMIN_EMAILS env → 불일치
- 수정: `isAdminUser(email, role)` 공통 헬퍼로 통일 (backend/src/common/utils/admin-check.ts)

### P1 [HIGH] 날짜 timezone drift (버튼 선택 시 startDate=오늘)
- 기존: `toISOString().split('T')[0]` — KST 23시대에 tomorrow가 UTC 기준 오늘로 계산
- 수정: `formatLocalYmd()` 로컬 타임존 포매터 (frontend/src/utils/dateFormat.ts)
- 적용: CreateTripScreen, EditTripScreen 전수 교체

### P2 [LOW] 새 여행 만들기 재진입 시 이전 정보 유지
- 기존: `navigation.addListener('focus')` — Tab 전환 시 미실행 케이스
- 수정: `useFocusEffect` + mount 시점 1회 초기화 이중 보장

## V172 신규 불변식
#19 AI quota는 saga로 실패/취소 시 자동 복원
#20 admin 판정은 isAdminUser() 단일 헬퍼 통일
#21 날짜는 formatLocalYmd() 사용, toISOString().split('T')[0] 금지

## 테스트
- Frontend TS: 0 errors
- Backend TS: 0 errors
- Backend Jest: XXX/XXX (신규 quota saga 테스트 5건 추가)
- 수동 QA: 9 케이스 매트릭스 + quota saga 5 시나리오 통과
```

**대상 파일 (예상)**:
- `backend/src/trips/trips.service.ts`
- `backend/src/trips/entities/trip.entity.ts`
- `backend/src/subscription/subscription.service.ts`
- `backend/src/common/utils/admin-check.ts` (신규)
- `backend/src/migrations/<timestamp>-AddTripQuotaRefunded.ts` (신규)
- `backend/src/trips/trips.service.spec.ts`
- `frontend/src/utils/dateFormat.ts` (신규 또는 기존)
- `frontend/src/screens/trips/CreateTripScreen.tsx`
- `frontend/src/screens/trips/EditTripScreen.tsx` (해당하는 경우)
- `frontend/app.json` (versionCode 171 → 172)
- `frontend/locales/*/trips.json` (startDateOnly, endDateOnly 키 17개 언어)

### 4.2 버전 번호

**frontend/app.json**:
```diff
-      "versionCode": 171,
+      "versionCode": 172,
```

**주의**: `version` 필드는 `1.0.0` 유지 (Alpha 동안 major/minor bump 불필요).

**EAS auto-increment 사용 여부**: 현재 프로젝트는 `app.json`에 명시적 versionCode — 수동 bump 방식. `eas.json`에서 `autoIncrement` 비활성이므로 **수동 명시 필수**.

### 4.3 로컬 빌드 절차

**백엔드 먼저 배포 (quota 복원 API가 프론트보다 먼저 활성화되어야 함)**:

```bash
# 1. 백엔드 빌드 및 테스트
cd /Users/hoonjaepark/projects/travelPlanner/backend
npm run build
npm run test

# 2. 마이그레이션 점검
npm run typeorm migration:show

# 3. SSH 배포 (CLAUDE.md 절차)
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127
cd /root/travelPlanner/backend
# 로컬에서 rsync 동기화
rsync -avz --exclude node_modules \
  /Users/hoonjaepark/projects/travelPlanner/backend/src/ \
  root@46.62.201.127:/root/travelPlanner/backend/src/

# 4. 컨테이너 재빌드 + 배포 (restart 금지 — up -d 사용)
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  'cd /root/travelPlanner/backend && docker compose build && docker compose up -d'

# 5. 마이그레이션 자동 실행 여부 확인 (migrationsRun: true 설정 시) 또는 수동
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  'cd /root/travelPlanner/backend && docker compose exec backend npm run typeorm migration:run'

# 6. 배포 검증
curl https://mytravel-planner.com/api/health
# quotaRefunded 컬럼 확인
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  'docker compose exec postgres psql -U travelplanner -c "\d trips" | grep quotaRefunded'
```

**프론트엔드 빌드**:
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# 1. 타입 체크
npx tsc --noEmit

# 2. 린트
npm run lint

# 3. 단위 테스트
npm test

# 4. AAB 빌드 (local, production profile)
eas build --platform android --profile production --local \
  --output ./build-v172.aab

# 5. 빌드 결과 확인
ls -la ./build-v172.aab
```

### 4.4 Alpha 배포

```bash
# 1. Play Console 제출 (비공개 테스트 Alpha 트랙)
eas submit --platform android --profile production \
  --path ./build-v172.aab --non-interactive

# 2. Play Console 웹에서 확인
# https://play.google.com/console/...
# - Alpha 트랙에 versionCode 172 업로드 확인
# - 출시 노트 작성:

# Release notes (ko):
# - AI 여행 생성 실패 시 자동 생성 횟수 복원 (결제 보호)
# - 여행 기간 버튼 선택 시 출발일 오류 수정 (timezone 버그)
# - 새 여행 만들기 재진입 시 정보 초기화 보강
# - 관리자 권한 판정 일관성 개선
```

### 4.5 배포 후 검증

**Smoke Test (배포 직후 5분 내)**:
- [ ] `https://mytravel-planner.com/api/health` 200 OK
- [ ] 테스터 기기에서 V172 업데이트 수신
- [ ] 로그인 → 새 여행 만들기 → [당일] 버튼 → 생성 성공
- [ ] AI 생성 실패 시뮬레이션 (네트워크 끊기) → quota 복원 확인
- [ ] Sentry 대시보드에서 V172 크래시 0건 확인

**Monitoring (배포 후 24시간)**:
- [ ] ErrorLog 신규 이슈 모니터링
- [ ] Sentry P0 이슈 발생 시 즉시 조치
- [ ] aiTripsUsedThisMonth 분포 확인 (음수 없음, limit 초과 없음)

### 4.6 롤백 기준

**즉시 롤백 (Play Console 이전 버전으로 승격)**:
- ANR > 2% (V159 수정된 KAV 이슈 재발)
- 크래시율 > 1%
- Sentry P0 신규 이슈 1건 이상
- quota 값이 음수로 기록되는 케이스 발견
- 마이그레이션 실패로 백엔드 500 에러 > 5%

**즉시 롤백 절차**:
```bash
# Play Console 웹: Alpha 트랙에서 V171 재활성화 + V172 비활성화
# 또는 새 AAB (V173)로 hotfix 배포

# 백엔드는 마이그레이션 down 필요 시:
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  'cd /root/travelPlanner/backend && docker compose exec backend npm run typeorm migration:revert'
```

### 4.7 프로덕션 승격 일정 (V172 안정화 후)

1. **D+0**: Alpha 배포 (V172)
2. **D+1~D+2**: Alpha 테스터 피드백 수집, P0 이슈 0건 확인
3. **D+3**: Alpha → Production 1% 단계적 출시
4. **D+5**: 1% → 5% (ANR, 크래시율, Sentry 기준 충족 시)
5. **D+7**: 5% → 20%
6. **D+10**: 20% → 50%
7. **D+14**: 50% → 100%

---

## 📎 부록: 조사 결과 요약표

| Issue | 코드 위치 | 근본 원인 | 수정 파일 | P 등급 |
|-------|----------|----------|----------|-------|
| 1-A startDate=오늘 | CreateTripScreen:242 | `toISOString()` UTC 변환 | dateFormat.ts, CreateTripScreen.tsx | P1 |
| 1-B 수동 입력 vs 버튼 | CreateTripScreen:1190,288 | 실제 버그 아닌 UX 혼동 (+ 1-A 영향) | CreateTripScreen.tsx, i18n | P1 |
| 1-C quota 차감 | trips.service.ts:214 | Phase A commit 후 Phase B 실패 시 복원 없음 | trips.service.ts, subscription.service.ts, trip.entity.ts, migration | **P0** |
| 1-D 재진입 초기화 | CreateTripScreen:743 | `focus` 리스너 Tab 전환 미보장 | CreateTripScreen.tsx (useFocusEffect) | P2 |
| 2 ErrorLog 4/25 | admin UI / DB | 조사 필요 | — | P1 |
| 3 구독 상태 지속 | admin 판정 분기 불일치 | trips.service는 role, subscription.service는 email | common/utils/admin-check.ts | P1 |

---

**최종 업데이트**: 2026-04-24
**다음 마일스톤**: V172 Alpha 배포 → D+3 Production 1% 승격
