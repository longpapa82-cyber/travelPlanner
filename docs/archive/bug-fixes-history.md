# 버그 수정 이력 (Bug Fixes History)

이 문서는 CLAUDE.md에서 분리된 상세한 버그 수정 이력을 포함합니다.

## 📌 목차
- [중복 여행 생성 버그 (Bug #1-9)](#중복-여행-생성-버그)
- [SSE → 폴링 전환 (Bug #13)](#bug-13-sse--폴링-전환)
- [관리자 AI 제한 해제 (Bug #14)](#bug-14-관리자-ai-제한-해제)
- [백엔드 i18n 지원 (Bug #15)](#bug-15-백엔드-i18n-지원)
- [브라우저 비밀번호 팝업 제거 (Bug #16)](#bug-16-브라우저-비밀번호-팝업-제거)
- [타임존 버그 (여행 상태)](#타임존-버그-여행-상태)
- [SSE Bug #10, #11, #12](#sse-bug-10-11-12)

---

## 중복 여행 생성 버그

**날짜**: 2026-03-21
**심각도**: 🔴 CRITICAL
**상태**: ✅ 완료

### 버그 발견
사용자가 AI 여행 생성 시 중복으로 생성되는 현상 발견.

### 발견된 9가지 버그

#### 버그 #1: 프론트엔드 더블탭
- **위치**: `frontend/src/screens/trips/CreateTripScreen.tsx:227`
- **원인**: `handleCreateTrip()`에 `isLoading` 체크 없음
- **수정**: `if (isLoading) return;` 가드 추가

#### 버그 #2: 백엔드 SELECT 쿼리
- **위치**: `backend/src/trips/trips.service.ts:93-117`
- **원인**: `.select('users')`가 컬럼값 미반환 → `user.aiTripsUsedThisMonth` = undefined
- **수정**: 명시적 컬럼 선택 + `currentCount` 변수 사용
- **배포**: 25-2차 (`a80c4faf`)

#### 버그 #3: SSE Fallback (근본 원인)
- **위치**: `frontend/src/services/api.ts:370-463`
- **원인**: SSE 성공(201) 후 스트림 중단 시 catch 블록에서 무조건 `this.createTrip()` fallback → 중복 생성
- **로그**: POST /api/trips/create-stream (289ms) + POST /api/trips (39ms) - 2개 API 호출
- **수정**: `sseRequestStarted` 플래그 추가, SSE 시작 후 fallback 절대 금지
- **배포**: 26차 (`8a5f164c`)

#### 버그 #4-9
상세 내용은 `docs/deployment-log-2026-03-21.md` 참조

### 핵심 교훈
- SSE Fallback 위험성: 성공한 요청(201)에 대한 재시도는 중복 생성 유발
- 로그 분석 중요성: 2개 엔드포인트 호출 발견으로 근본 원인 파악
- 체계적 진단: /sc:troubleshoot 명령으로 단계별 분석 효과적

---

## Bug #13: SSE → 폴링 전환

**날짜**: 2026-03-24
**심각도**: 🟢 MEDIUM
**상태**: ✅ 완료

### 배경
Railway SSE 근본적 한계로 Bug #10, #11, #12 모두 실패.

### 근본 원인
- Railway HTTP/2 프록시의 ~100KB 버퍼링 임계값
- Aggressive connection closure
- 모든 수정은 Node.js 레이어에서만 작동 → Railway 프록시 우회 실패

### 해결: 폴링 아키텍처 전환
**설계 원칙**:
- ✅ 100% 성공 보장
- ✅ Railway 독립적
- ✅ 재개 가능
- ✅ 디버깅 용이

**구현**:
1. 백엔드 JobsService (인메모리 Map, 1시간 TTL)
2. Polling 엔드포인트 (`/create-async`, `/job-status/:jobId`)
3. SSE 완전 제거 (94 lines 삭제)
4. 프론트엔드 `createTripWithPolling()` (1초 간격, 5분 타임아웃)

**배포**: versionCode 36 (2026-03-24)

### 예상 효과
- Railway 프록시 문제 100% 해결
- "Trip created but connection interrupted" 에러 소멸
- 모든 호스팅 플랫폼 호환

---

## Bug #14: 관리자 AI 제한 해제

**날짜**: 2026-03-24
**심각도**: 🟢 LOW
**상태**: ✅ 완료

### 문제
Bug #13 배포 후, 관리자 계정에서 "Monthly AI generation limit (3) reached" 에러.

### 근본 원인
1. DB: 관리자 role이 'user'로 설정
2. 코드: trips.service.ts가 role 체크 안함

### 수정
- `trips.service.ts`: role 필드 추가 선택, 관리자 무제한 로직
- 프로덕션 DB: `UPDATE users SET role = 'admin' WHERE email = 'longpapa82@gmail.com'`
- 환경 변수: `AI_TRIPS_FREE_LIMIT=3`, `AI_TRIPS_PREMIUM_LIMIT=30`

**배포**: 25차 (`7d389cd4`)

---

## Bug #15: 백엔드 i18n 지원

**날짜**: 2026-03-24
**심각도**: 🟢 LOW
**상태**: ✅ 완료

### 문제
한국어 설정으로 회원가입 실패 시 영어 메시지 표시.

### 수정
- `common/i18n.ts`: 12개 인증 번역 키 추가 (17개 언어)
- `auth.service.ts`: lang 매개변수 추가
- `auth.controller.ts`: Accept-Language 헤더 처리

**배포**: Commit `9fcb4775`

---

## Bug #16: 브라우저 비밀번호 팝업 제거

**날짜**: 2026-03-24
**심각도**: 🟢 LOW
**상태**: ✅ 완료

### 문제
회원가입 → 로그인 시 Google 비밀번호 저장 팝업 표시.

### 수정
5개 인증 화면에 `autoComplete` 속성 추가:
- `email`, `current-password`, `new-password`, `name`, `one-time-code`

**배포**: Commit `ccfafaf9`

---

## 타임존 버그 (여행 상태)

**날짜**: 2026-03-22
**심각도**: 🔴 CRITICAL
**상태**: ✅ 완료

### 문제
여행 상태(대기/진행중/완료)가 서버 시간 기준으로만 계산, 국제 여행 시 최대 14시간 오차.

### 수정
- `trip-progress.helper.ts`: `calculateTripStatus()` tripTimezoneOffset 매개변수 추가
- `trip-status.scheduler.ts`: itineraries 함께 로드, timezoneOffset 사용

**배포**: 32차 (`7be8d602`)

---

## SSE Bug #10, #11, #12

**날짜**: 2026-03-23~24
**심각도**: 🔴 CRITICAL
**상태**: ✅ 해결 (Bug #13으로 폴링 전환)

### Bug #10 (versionCode 33)
- `res.flush()` + 500ms delay
- ❌ Railway 프록시 레이어 우회 실패

### Bug #11 (versionCode 34)
- Heartbeat + 1KB padding
- ❌ Railway 프록시 레이어 우회 실패

### Bug #12 (versionCode 35)
- 10KB padding + 3s delay
- ❌ Railway 프록시 레이어 우회 실패

### 최종 결론
SSE는 Railway와 근본적으로 호환 불가 → Bug #13으로 폴링 전환.

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-03-27
**관련 문서**: CLAUDE.md, deployment-log-*.md
