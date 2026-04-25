# V115 Backend 수정 요약

## 파일별 변경

### 1. `backend/src/email/email.service.ts`
- `verificationUrl`: `/verify-email?token=` → `/app/verify?token=`
- `resetUrl`: `/reset-password?token=` → `/app/reset?token=`
- **이유**: V114-1 — `/app/*` 경로를 App Links 전용으로 예약

### 2. `backend/src/auth/auth.service.ts`
- `PendingVerificationResponse`에 `action: 'created' | 'refreshed'` discriminator 추가
- `register()` 내부에서 create 경로 `action='created'`, refresh 경로 `action='refreshed'`
- **신규** `registerForce()` 메서드: 미인증 row hard delete 후 register 재호출
- **이유**: V114-8 — 미인증 재가입 UX 2-way 분기 지원

### 3. `backend/src/auth/auth.controller.ts`
- **신규** `POST /auth/register-force` 엔드포인트
- `@Throttle({ medium: { ttl: 600000, limit: 1 } })` — 1회/10분
- 요청 body에 `confirmReset: true` 없으면 `CONFIRM_RESET_REQUIRED` 거부
- `BadRequestException` import 추가

### 4. `backend/src/users/users.service.ts`
- **신규** `hardDeleteUnverifiedUser(userId)`: EMAIL + unverified 인 row만 삭제, verified/social 은 거부
- **신규** `DEPRECATED_CONSENTS` 리스트에 `PRIVACY_OPTIONAL`
- `getConsentsStatus()`에서 `allConsentTypes`에 `DEPRECATED_CONSENTS` 필터 적용
- `updateConsents()`에서 deprecated type은 silently skip
- **이유**: V114-4c, V114-8

### 5. `backend/src/app.controller.ts`
- **신규** `GET /api/version` 엔드포인트
- `{ apiVersion, minAppVersionCode: 100, recommendedAppVersionCode: 115, releaseNotesUrl, timestamp }`
- **이유**: V114-9 무중단 배포/force update 경로

### 6. `backend/src/admin/admin.controller.ts`
- `ErrorLogController.createErrorLog()`에 `isExpectedFlowError()` 필터 추가
- `IGNORED_PATTERNS` (quota/cancel/throttle 관련)은 DB에 기록 안 함
- **이유**: V114-7 — error_logs 노이즈 정리

### 7. `backend/src/auth/auth.controller.spec.ts`
- `mockPendingVerificationResponse`에 `action: 'created'` 필드 추가

### 8. `backend/src/auth/auth.service.spec.ts`
- register 응답 expectation에 `action: 'created'` 추가

### 9. `backend/src/email/email.service.spec.ts`
- 5건의 URL 기대값을 `/app/verify`, `/app/reset`로 일괄 갱신

## 검증 결과

- **TypeScript**: 0 errors
- **Jest**: 23/23 suites, 429/429 tests PASS
- **Backward compat**: `action` 필드 optional 아니라 required지만 기존 client가 이 필드를 무시하면 영향 없음. legacy 응답 형태는 유지.
- **Breaking changes**: 없음. 신규 필드 추가 + 신규 엔드포인트만.

## 남은 Phase 12 체크

- 프로덕션 `.env`의 `FRONTEND_URL`이 `https://mytravel-planner.com` 그대로인지
- Docker image 재빌드 필요 (`docker compose build backend`)
- DB 마이그레이션 없음 (엔티티 변경 없음)
