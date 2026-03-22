# 앱 테스트 가이드 - 여행 계획 중복 생성 버그 수정 검증

**날짜**: 2026-03-21
**대상 버그**: 여행 계획 중복 생성 및 할당량 체크 오류
**테스트 환경**: 로컬 개발 서버 (http://localhost:3001/api)
**필수 조건**: 백엔드 서버 실행 중, 프론트엔드 앱 빌드 완료

---

## 📋 테스트 개요

### 수정 내용
1. **프론트엔드**: 더블 탭 방지 가드 (`isLoading` 체크)
2. **백엔드**: 트랜잭션 기반 원자적 할당량 체크 + 행 잠금
3. **백엔드**: 할당량 증가 순서 변경 (여행 생성 전)

### 검증 목표
- ✅ 싱글 탭: 1개 생성
- ✅ 더블 탭: 1개만 생성 (중복 차단)
- ✅ 할당량 도달: 에러 + 생성 안 됨
- ✅ 동시 요청: 첫 번째만 성공

---

## 🧪 테스트 시나리오

### 시나리오 1: 정상 여행 생성 (싱글 탭)

**목적**: 기본 기능이 정상 작동하는지 확인

**전제 조건**:
- 테스트 계정으로 로그인
- `aiTripsUsedThisMonth < 3` (할당량 여유 있음)

**테스트 절차**:
1. 앱 실행 → 로그인
2. "새 여행 만들기" 탭 이동
3. 여행 정보 입력:
   - 여행지: "서울"
   - 시작일: 오늘
   - 종료일: 3일 후
   - 모드: "AI 생성"
4. "여행 만들기" 버튼 **한 번** 탭
5. 로딩 인디케이터 확인
6. 생성 완료 대기 (AI 생성 시간 ~30초)

**예상 결과**:
- ✅ 1개의 여행만 생성됨
- ✅ "여행 목록" 탭에서 1개 확인
- ✅ 서버 로그에 1개 생성 기록만 존재

**실패 조건**:
- ❌ 2개 이상 생성
- ❌ 에러 발생
- ❌ 생성 실패

**검증 SQL**:
```sql
SELECT id, title, "createdAt", "aiStatus"
FROM trips
WHERE "userId" = 'YOUR_USER_ID'
ORDER BY "createdAt" DESC
LIMIT 5;
```

---

### 시나리오 2: 더블 탭 방지 (핵심 테스트)

**목적**: 프론트엔드 가드가 중복 요청을 차단하는지 확인

**전제 조건**:
- 테스트 계정으로 로그인
- `aiTripsUsedThisMonth < 3`

**테스트 절차**:
1. "새 여행 만들기" 탭 이동
2. 여행 정보 입력 (시나리오 1과 동일)
3. "여행 만들기" 버튼 **빠르게 2번** 탭 (더블 탭)
   - ⚡ **중요**: 1초 이내에 연속 탭
4. 로딩 인디케이터 확인
5. 생성 완료 대기

**예상 결과**:
- ✅ **1개의 여행만 생성됨** (2개가 아님!)
- ✅ 두 번째 탭이 무시됨 (`isLoading` 가드)
- ✅ 서버 로그에 1개 POST 요청만 기록

**실패 조건**:
- ❌ 2개 생성 (프론트엔드 가드 실패)
- ❌ 서버 에러
- ❌ 할당량 1 증가 (2가 아님)

**서버 로그 확인**:
```bash
# 터미널에서 백엔드 로그 확인
# "POST /api/trips" 요청이 1개만 있어야 함
```

**검증 SQL**:
```sql
-- 5초 이내 중복 생성 확인
SELECT
  "userId",
  title,
  "createdAt",
  LAG("createdAt") OVER (PARTITION BY "userId" ORDER BY "createdAt") as prev_created,
  EXTRACT(EPOCH FROM ("createdAt" - LAG("createdAt") OVER (PARTITION BY "userId" ORDER BY "createdAt"))) as seconds_diff
FROM trips
WHERE "userId" = 'YOUR_USER_ID'
ORDER BY "createdAt" DESC
LIMIT 10;

-- seconds_diff가 5 미만인 레코드가 없어야 함
```

---

### 시나리오 3: 할당량 도달 테스트

**목적**: 할당량 초과 시 에러 + 생성 안 됨 확인

**전제 조건**:
- 테스트 계정으로 로그인
- `aiTripsUsedThisMonth = 3` (할당량 소진)
  - 방법: 여행 3개 생성 또는 수동으로 DB 업데이트

**DB 설정** (수동 할당량 조작):
```sql
UPDATE users
SET "aiTripsUsedThisMonth" = 3
WHERE email = 'YOUR_TEST_EMAIL@example.com';
```

**테스트 절차**:
1. 할당량 3/3 상태 확인
2. "새 여행 만들기" 탭 이동
3. 여행 정보 입력
4. "여행 만들기" 버튼 탭

**예상 결과**:
- ✅ 에러 메시지 표시: "이번 달 AI 여행 생성 한도를 초과했습니다"
- ✅ **여행이 생성되지 않음** (중요!)
- ✅ 할당량 3에서 증가하지 않음
- ✅ 서버 응답: `403 Forbidden`

**실패 조건**:
- ❌ 에러 표시 + 여행 생성됨 (버그 #3 재발)
- ❌ 할당량이 4로 증가
- ❌ 서버 500 에러

**검증 SQL**:
```sql
-- 할당량과 여행 개수가 일치하는지 확인
SELECT
  u.email,
  u."aiTripsUsedThisMonth",
  COUNT(t.id) as actual_ai_trips
FROM users u
LEFT JOIN trips t ON u.id = t."userId" AND t."aiStatus" IN ('completed', 'generating', 'failed')
WHERE u.email = 'YOUR_TEST_EMAIL@example.com'
GROUP BY u.id, u.email, u."aiTripsUsedThisMonth";

-- aiTripsUsedThisMonth = actual_ai_trips 이어야 함
```

---

### 시나리오 4: 할당량 리셋 후 재생성

**목적**: 할당량 리셋 후 정상 작동 확인

**전제 조건**:
- 시나리오 3 완료 (할당량 3/3)

**테스트 절차**:
1. 할당량 수동 리셋:
```sql
UPDATE users
SET "aiTripsUsedThisMonth" = 0
WHERE email = 'YOUR_TEST_EMAIL@example.com';
```
2. 앱 재시작 (또는 로그아웃 → 로그인)
3. "새 여행 만들기" 버튼 탭
4. 생성 완료 대기

**예상 결과**:
- ✅ 정상 생성
- ✅ 할당량 0 → 1 증가

---

### 시나리오 5: 네트워크 지연 시뮬레이션 (고급)

**목적**: 네트워크 지연 상황에서도 중복 생성 방지 확인

**전제 조건**:
- Chrome DevTools Network Throttling 설정:
  - Slow 3G 또는 Custom (2초 지연)

**테스트 절차**:
1. Chrome DevTools 열기 (F12)
2. Network 탭 → Throttling: "Slow 3G"
3. 여행 정보 입력
4. "여행 만들기" 버튼 **3번 연속 빠르게** 탭
5. 네트워크 탭에서 요청 개수 확인

**예상 결과**:
- ✅ 1개 요청만 전송됨
- ✅ 나머지 2번 탭 무시됨
- ✅ 1개 여행만 생성

**실패 조건**:
- ❌ 3개 요청 전송
- ❌ 서버에서 3개 모두 처리 시도

---

## 📊 검증 체크리스트

### 프론트엔드 검증
- [ ] 더블 탭 시 `console.log`로 "Duplicate call blocked" 확인 (개발 모드)
- [ ] 로딩 중 버튼 비활성화 확인
- [ ] 에러 메시지 정확히 표시
- [ ] 생성 완료 후 목록 자동 새로고침

### 백엔드 검증
- [ ] 서버 로그에 트랜잭션 시작/커밋 기록
- [ ] `SELECT FOR UPDATE` 쿼리 실행 확인
- [ ] 할당량 증가가 여행 생성 **전**에 실행
- [ ] 롤백 시 할당량도 원복

### 데이터베이스 검증
```sql
-- 1. 중복 생성 확인 (5초 이내)
SELECT
  "userId",
  COUNT(*) as duplicate_count
FROM (
  SELECT
    "userId",
    "createdAt",
    LAG("createdAt") OVER (PARTITION BY "userId" ORDER BY "createdAt") as prev_created,
    EXTRACT(EPOCH FROM ("createdAt" - LAG("createdAt") OVER (PARTITION BY "userId" ORDER BY "createdAt"))) as seconds_diff
  FROM trips
  WHERE "aiStatus" != 'none'
) sub
WHERE seconds_diff < 5 AND seconds_diff IS NOT NULL
GROUP BY "userId";

-- 결과: 0 rows (중복 없음)

-- 2. 할당량 정확성 확인
SELECT
  u.email,
  u."aiTripsUsedThisMonth" as quota_used,
  COUNT(t.id) as actual_trips,
  u."aiTripsUsedThisMonth" - COUNT(t.id) as difference
FROM users u
LEFT JOIN trips t ON u.id = t."userId" AND t."aiStatus" IN ('completed', 'generating', 'failed')
GROUP BY u.id, u.email, u."aiTripsUsedThisMonth"
HAVING u."aiTripsUsedThisMonth" != COUNT(t.id);

-- 결과: 0 rows (모두 일치)
```

---

## 🚨 알려진 제약사항

### 테스트 불가능한 시나리오
1. **진정한 동시 요청 (Concurrent Requests)**
   - 단일 클라이언트로는 시뮬레이션 불가능
   - 필요 시 Postman/curl로 동시 요청 테스트:
   ```bash
   # 터미널 1
   curl -X POST http://localhost:3001/api/trips \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"destination":"서울","startDate":"2026-03-22","endDate":"2026-03-25","mode":"ai"}' &

   # 터미널 2 (즉시 실행)
   curl -X POST http://localhost:3001/api/trips \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"destination":"서울","startDate":"2026-03-22","endDate":"2026-03-25","mode":"ai"}' &
   ```
   - **예상**: 1개만 성공, 1개는 대기 → 할당량 에러

2. **분산 서버 환경**
   - 현재: 단일 서버 → `SELECT FOR UPDATE` 작동
   - 프로덕션 다중 서버: 추가 검증 필요 (동일 DB 사용 시 정상 작동 예상)

---

## 🎯 테스트 통과 기준

### 필수 통과 (P0)
- ✅ 시나리오 1: 정상 생성
- ✅ 시나리오 2: 더블 탭 방지
- ✅ 시나리오 3: 할당량 에러 + 생성 안 됨

### 권장 통과 (P1)
- ✅ 시나리오 4: 할당량 리셋 후 재생성
- ✅ 시나리오 5: 네트워크 지연 시 중복 방지

### 선택 통과 (P2)
- ✅ 동시 요청 테스트 (curl/Postman)

---

## 📝 테스트 보고서 템플릿

```markdown
# 테스트 실행 보고서

**테스터**: [이름]
**날짜**: [YYYY-MM-DD]
**환경**: [로컬/프로덕션]
**커밋**: [Git 해시]

## 시나리오 1: 정상 생성
- 결과: [PASS/FAIL]
- 비고: [특이사항]
- 스크린샷: [첨부]

## 시나리오 2: 더블 탭 방지
- 결과: [PASS/FAIL]
- 생성된 여행 개수: [1/2]
- 서버 로그: [확인/미확인]

## 시나리오 3: 할당량 에러
- 결과: [PASS/FAIL]
- 에러 메시지: [정확/부정확]
- 여행 생성 여부: [생성됨/생성 안 됨]

## 데이터베이스 검증
- 중복 생성: [0 rows/발견]
- 할당량 일치: [일치/불일치]

## 전체 평가
- P0 통과율: [X/3]
- P1 통과율: [X/2]
- **최종 판정**: [PASS/FAIL]

## 발견된 이슈
1. [이슈 설명]
2. [이슈 설명]
```

---

## 🔧 문제 해결

### 문제 1: 서버가 시작되지 않음
**증상**: `EADDRINUSE: address already in use :::3001`

**해결**:
```bash
lsof -ti:3001 | xargs kill -9
npm run start:dev
```

### 문제 2: 할당량이 증가하지 않음
**원인**: 캐시된 사용자 정보

**해결**:
- 앱 재시작
- 로그아웃 → 로그인
- Redis 캐시 초기화: `redis-cli FLUSHALL`

### 문제 3: 더블 탭이 차단되지 않음
**확인 사항**:
1. 프론트엔드 빌드 최신 버전 확인
2. `CreateTripScreen.tsx:227` 가드 코드 확인
3. React Native 개발 서버 재시작

### 문제 4: 트랜잭션 롤백 확인 방법
**DB 로그 활성화**:
```typescript
// backend/src/config/database.config.ts (개발 환경)
logging: true, // SQL 쿼리 로그 출력
```

**확인**:
- 로그에 `START TRANSACTION`, `COMMIT`, `ROLLBACK` 표시
- 에러 발생 시 `ROLLBACK` 자동 실행 확인

---

## 📚 참고 문서

- **버그 수정 보고서**: `docs/bug-fix-duplicate-trip-creation.md`
- **배포 진행 로그**: `docs/deployment-log-2026-03-21.md`
- **진단 SQL 스크립트**: `scripts/diagnose-user-data.sql`
- **Alpha 테스트 가이드**: `docs/alpha-testing-guide.md`

---

## ✅ 다음 단계

### 로컬 테스트 통과 후
1. [ ] 테스트 보고서 작성
2. [ ] 발견된 이슈 수정
3. [ ] 프로덕션 배포 준비

### 프로덕션 배포 후
1. [ ] 프로덕션 모니터링 (중복 생성 제로 확인)
2. [ ] 사용자 피드백 수집
3. [ ] 성능 메트릭 확인 (응답 시간, 트랜잭션 오버헤드)

---

**작성자**: Claude (SuperClaude SC Mode)
**검토**: 2026-03-21
**문서 버전**: 1.0
