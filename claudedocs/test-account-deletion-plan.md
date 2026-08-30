# 테스트 계정 삭제 상세 계획 (Production) — 개정 확정본

> 작성일: 2026-08-30 · 대상: mytravel-planner.com 운영 DB (`travelplanner-postgres-1`)
> 최초 선택: Activity heuristic + Direct SQL + Production (최고위험 조합)
> **→ "추천 단계"로 개정**: 명시 ID 명단 고정 + `usersService.removeByAdmin()` 경유 삭제.
> 실측으로 위험 대부분 소거됨 (아래 §0.1).

---

## ✅ 실행 완료 기록 (2026-08-30 04:36 UTC)

- **삭제 완료: 테스트 계정 82개 전원** (전체 유저 195 → 113, 정확히 −82).
- 경로: `removeByAdmin()` × 82 (트랜잭션 · error_logs PII 익명화 · CASCADE FK 삭제 · Redis 30일 블랙리스트 · RevenueCat/Apple 정리).
- 대상 도메인: `test.com` 71 · `example.com` 6 · `cloudtestlabaccounts.com` 4 · `mytravel-planner.com` 1.
- 검증: 테스트계정 잔존 0 · CASCADE 고아(trips) 0 · error_logs PII 잔존 0 · 서버 HTTPS 200.
- **백업(롤백 보험)**: 서버 `/root/backup-pre-testdel-20260830-0436.dump` (2.6M, `pg_restore`).
- 명단 CSV(`test-account-deletion-manifest.csv`)는 삭제 계정 이메일 PII 박제 회피 위해 정리 시 제거. 개별 계정 기록은 위 백업 dump가 담당.
- ⚠️ `cloudtestlabaccounts.com`은 Google Play 자동리뷰가 재생성할 수 있음(정상).
- 일회성 스크립트(`src/scripts/delete-test-accounts.ts`)는 정리 시 제거 — 다음 정상 배포의 `nest build`가 dist에서 자연 제거.

---

## 0.1 실측 결과 (2026-08-30, 읽기 전용 SELECT로 확정)

- 전체 유저 **195명**. 명백한 테스트 도메인 계정 = **82명** (`claudedocs/test-account-deletion-manifest.csv`에 ID 고정).
  - `test.com` 71 · `example.com` 6 · `cloudtestlabaccounts.com` 4 (Google Play 자동리뷰) · `mytravel-planner.com` 1(demo)
- 명단 82명 위험 플래그: **RevenueCat 연결 0 · Apple 로그인 0 · premium 0 · admin 0** → 외부서비스 정리(RC/Apple) **불필요**.
- ⚠️ **명단에서 의도적으로 제외**: `privaterelay.appleid.com`(12) = Apple 로그인 **실사용자**, `gmail/naver/kakao/nate/daum`(실사용자 영역). 도메인만으로 "테스트" 판정 금지 — 화이트리스트로만 좁힘.
- ⚠️ `cloudtestlabaccounts.com` 4개는 Google Test Lab이 **자동 재생성**할 수 있음(삭제해도 다시 나타날 수 있음 — 정상).

### 실측 FK 지도 (마이그레이션 grep보다 정확)
- ✅ CASCADE(자동삭제): trips, collaborators, follows(follower/following), trip_likes, announcement_reads, user_consents, consent_audit_logs, **expenses(paidByUserId)**, **expense_splits**, **notifications**
- ⚠️ SET NULL: affiliate_clicks (행 남고 userId만 NULL)
- 🔴 FK 없음(수동/서비스 처리): **error_logs**(userId·userEmail — `remove()`가 익명화), analytics_events, api_usage, audit_logs, processed_webhook_events (운영 통계·PII 아님 → 방치 무방)

---

## 0. 위험 요약 (왜 이 계획이 이렇게 무거운가)

| 선택 | 얻는 것 | 잃는 것 (계획이 보완해야 할 것) |
|------|---------|-------------------------------|
| Activity heuristic | 명단 없이 자동 식별 | 실사용자 오삭제 가능 → **dry-run 카운트 + 명단 육안검수 필수** |
| Direct SQL | 빠름, 앱 배포 불필요 | `remove()`의 후처리 건너뜀 → **RevenueCat/Redis/Apple/error_logs 수동 보완 필수** |
| Production DB | 실제 대상 정리 | 되돌릴 수 없음 → **백업 스냅샷 + 트랜잭션 + 명시적 롤백 절차 필수** |

`remove()`(backend/src/users/users.service.ts:425)가 자동으로 하던 것 중 **Direct SQL이 건너뛰는 것**:
1. `error_logs` PII 익명화 (FK 없음 → CASCADE 안 됨)
2. Redis `deleted_user:{id}` 30일 블랙리스트 (refresh token 재발급 차단)
3. RevenueCat subscriber `$deleted_at` 마킹 + `deleteSubscriber` (phantom 구독 차단)
4. Apple refresh token revoke (iOS Guideline 5.1.1(v))

→ 이 4가지를 아래 계획에 **수동 단계로** 포함한다.

---

## 1. FK Cascade 지도 (users 삭제 시 자동/수동 구분)

`grep FOREIGN KEY backend/src/migrations/*.ts` 검증 결과:

### ✅ ON DELETE CASCADE — users 삭제 시 자동 삭제됨
- `trips` → (그 하위 `itineraries`, `expenses`, `expense_splits`, `collaborators` 도 trip cascade로 연쇄)
- `collaborators` (userId)
- `follows` (followerId, followingId)
- `trip_likes`
- `announcement_reads`
- `user_consents`
- `consent_audit_logs`

### ⚠️ ON DELETE SET NULL — 행은 남고 userId만 NULL
- `affiliate_clicks` (통계 보존 목적. 테스트 계정 클릭이 통계에 섞여도 무방하면 그대로 두거나, 원하면 명시적 DELETE)

### 🔴 FK 없음 — 자동으로 아무 일도 안 일어남 (수동 처리 필수)
- `error_logs.userId` (plain varchar) → **익명화 필요** (삭제 아님, PII만 제거)
- `notifications`, `analytics_events`, `viral_posts`, `api_usage`, `audit_logs`, `processed_webhook_events` → 각 테이블의 userId 컬럼 존재 여부/FK를 **삭제 전 실측**하여 잔존 여부 확인 (아래 1.1)

### 1.1 삭제 전 실측 쿼리 (반드시 먼저 실행)
```sql
-- users를 참조하지만 CASCADE 아닌 테이블을 전수 확인
SELECT
  tc.table_name, kcu.column_name, rc.delete_rule
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = rc.constraint_name
WHERE ccu.table_name = 'users'
ORDER BY rc.delete_rule, tc.table_name;

-- FK 없이 userId를 들고 있는 테이블 탐지 (스키마 드리프트 대비)
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name IN ('userId','user_id','userEmail')
  AND table_schema = 'public'
ORDER BY table_name;
```
→ 결과가 위 지도와 다르면(마이그레이션 추가로 새 테이블 생겼을 수 있음) 계획을 갱신한 뒤 진행.

---

## 2. 테스트 계정 식별 (Activity Heuristic)

### 2.1 후보 WHERE 절 초안 (⚠️ 실행 전 반드시 조정)
아래는 **출발점**일 뿐. 실제 heuristic은 QA 계정 특성에 맞춰 좁혀야 한다.
```sql
-- 예시 heuristic: 본인이 QA 중 만든 계정 특징
--   · 이메일 도메인/로컬파트 패턴
--   · 실제 결제 없음 (free tier + sandbox)
--   · 실제 trip 활동이 거의 없음
-- ⚠️ 각 조건을 OR가 아닌 AND로 교집합 → 오탐 최소화
SELECT id, email, provider, "subscriptionTier", "subscriptionIsSandbox",
       "revenuecatAppUserId" IS NOT NULL AS has_rc,
       "createdAt", "lastActiveAt",
       (SELECT count(*) FROM trips t WHERE t."userId" = u.id) AS trip_count
FROM users u
WHERE 1=1
  -- AND email LIKE '%@<QA_도메인>%'          -- 조정
  -- AND ("subscriptionIsSandbox" = true OR "subscriptionTier" = 'free')
  -- AND u.role = 'user'                       -- 관리자 계정 절대 제외
ORDER BY "createdAt";
```

### 2.2 절대 제외 (안전장치)
- `role = 'admin'` 및 서비스 관리자 이메일(`SERVICE_ADMIN_EMAILS`, `ADMIN_EMAILS`: longpapa82@gmail.com 등)
- `subscriptionTier = 'premium'` AND `subscriptionIsSandbox = false` (실결제 흔적)
- `revenuecatAppUserId`가 실제 스토어 구매와 연결된 계정
→ WHERE에 `AND role = 'user' AND NOT (subscriptionTier='premium' AND subscriptionIsSandbox=false)` 명시.

### 2.3 명단 고정 (heuristic → 명시 ID로 전환)
heuristic로 뽑은 결과를 **육안 검수 후 ID 배열로 고정**한다. 삭제 쿼리는 heuristic을 재실행하지 말고 **고정된 ID 목록**만 사용 (실행 사이 신규 가입자가 heuristic에 걸리는 것 방지).
```sql
-- 2.1 결과를 검수 후 아래에 ID를 붙여 고정
-- \set target_ids '''id1'',''id2'',''id3'''
```

---

## 3. 실행 절차 (추천 단계 — `remove()` 경유, 순서 엄수)

> 명단이 이미 고정(CSV 82명)되고 RC/Apple 위험이 0이므로,
> `usersService.remove()`를 각 ID에 대해 호출하면 **error_logs 익명화·Redis 블랙리스트·(해당 시) RC/Apple 정리가 전부 자동**으로 처리됨. 사람이 SQL로 손댈 여지 제거.

### STEP 1 — 백업 (되돌릴 수 없음에 대한 유일한 보험)
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "docker exec travelplanner-postgres-1 pg_dump -U postgres -d travelplanner \
   -Fc -f /tmp/backup-pre-testdel-$(date +%Y%m%d-%H%M).dump"
# 파일 크기 확인 후 로컬로 scp 보관
```
→ 백업 성공·크기 확인 전에는 다음 단계 진행 금지.

### STEP 2 — 명단 재검증 (실행 직전, drift 방지)
```sql
-- CSV의 82개 ID가 여전히 존재하고, 그 사이 위험 플래그가 안 생겼는지 확인
SELECT count(*) AS still_present,
       count(*) FILTER (WHERE role='admin') AS now_admin,
       count(*) FILTER (WHERE "subscriptionTier"='premium') AS now_premium
FROM users WHERE id IN (:manifest_ids);
-- still_present=82, now_admin=0, now_premium=0 이어야 진행
```

### STEP 3 — `remove()` 경유 삭제 (관리자 스크립트 or 임시 커맨드)
두 방법 중 택1:

**3-A. 일회성 NestJS 스크립트 (권장)** — `remove()`를 그대로 호출:
```ts
// backend/scripts/delete-test-accounts.ts (일회성, 실행 후 삭제)
// manifest CSV의 id 배열을 읽어 순차 호출.
for (const id of ids) {
  try { await usersService.remove(id); log(`ok ${id}`); }
  catch (e) { log(`FAIL ${id}: ${e.message}`); }  // 실패 수집, 중단 안 함
}
```
> email provider 계정은 `remove(id)`가 비밀번호를 요구 → 스크립트는 **관리자 컨텍스트 우회 경로**가 필요.
> 간단히는 `remove()`의 password 검증을 건너뛰는 내부 메서드(`removeByAdmin(id)`)를 추가하거나,
> 스크립트에서 서비스의 내부 삭제 트랜잭션만 재사용. (아래 §3.1 참고)

**3-B. 이미 있는 admin 재인증 경로가 있으면** 그 위에 bulk 호출.

### STEP 4 — 검증
```sql
SELECT count(*) FROM users WHERE id IN (:manifest_ids);                 -- 0
SELECT count(*) FROM error_logs
  WHERE "userId" IN (:manifest_ids) AND "userEmail" IS NOT NULL;        -- 0 (익명화됨)
SELECT count(*) FROM trips WHERE "userId" IN (:manifest_ids);           -- 0 (CASCADE)
```
+ 서버 healthy, HTTPS 200 확인. + Redis에 `deleted_user:{id}` 세팅됐는지 표본 확인.

---

## 3.1 필요한 코드 준비물
`remove(id, password?)`는 email 계정에 password를 강제하므로, 관리자 일괄 삭제용으로 **password 검증만 생략한 내부 경로**가 필요:
- 옵션 A: `removeByAdmin(id: string)` 신설 — password 분기 건너뛰고 동일 트랜잭션+후처리 재사용.
- 옵션 B: 스크립트에서 `remove()`의 트랜잭션 본문(익명화→delete→blacklist→RC→Apple)을 재사용하는 얇은 래퍼.
→ TDD로 `removeByAdmin`이 CASCADE·익명화·blacklist를 수행하는지 테스트 후 배포.

---

## 4. 롤백 절차
- STEP 3 실행 전: 아무 변경 없음.
- 실행 후: `remove()`는 계정별 독립 트랜잭션 → 부분 실패 시 **성공분만 삭제**되고 실패분은 남음(로그로 식별). 전체 원복이 필요하면 **STEP 1 백업에서 `pg_restore`**.
- 외부 서비스(RC/Apple)는 명단상 대상 0이라 롤백 고려 불필요.

---

## 5. 체크리스트
- [x] 실측으로 FK 지도 최신화 (§0.1)
- [x] 명단을 명시 ID로 고정 (CSV 82명, admin/실결제/Apple 실사용자 제외 확인)
- [ ] `removeByAdmin` 준비 + 테스트 (§3.1)
- [ ] STEP1 백업 완료·크기 확인
- [ ] STEP2 실행 직전 재검증 (still_present=82)
- [ ] STEP3 `remove()` 경유 삭제 (성공/실패 로그 수집)
- [ ] STEP4 검증 쿼리 전부 0 + Redis 블랙리스트 표본 + 서버 healthy
