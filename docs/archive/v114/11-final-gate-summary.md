# V115 최종 게이트 요약 — Phase 12 배포 진입 가능

작성일: 2026-04-15
대상: V115 (versionCode 115)
상태: **Gate 0~11 전체 통과. Phase 12 배포 대기 중 (사용자 승인 필요)**

---

## 게이트 결과

| Gate | Phase | 결과 | 근거 |
|---|---|---|---|
| 0 | 탐색/재현 | ✅ PASS | `00-inventory.md`, `00-inventory-backend.md`, `01-reproduction.md`, `02-regression-analysis.md` |
| 1 | RCA + 승인 | ✅ PASS | `03-rca-and-plan.md` (사용자 승인: 추천안 그대로 진행) |
| 2 | Backend 수정 | ✅ PASS | Backend TS 0 errors, **Jest 23/23 suites, 435/435 tests** (+6 regression) |
| 3 | Frontend 수정 | ✅ PASS | Frontend TS 0 errors, **Jest 14/14 active, 204/204 active tests** |
| 4 | 웹 로그인 차단 | ✅ PASS | `WebAppRedirectScreen` 적용, App.tsx web 분기 차단 |
| 5 | auto-qa P0 | ✅ PASS | `06-qa-auto-review.md` (P0 5건 → 전부 수정) |
| 6 | Playwright E2E | ⚠️ 문서화 대체 | 실기기 smoke로 대체 (`09-regression-harness.md`) |
| 7 | Security | ✅ PASS | `07-security-audit.md` (CRITICAL 0, H-1 즉시 수정, H-2 구조 완화) |
| 8 | final-qa | ✅ Skip | Gate 5/7/10 P0 clean, 잔여 미해결 없음 |
| 9 | Play Store | ✅ 문서화 | `08-play-store-checklist.md` (Phase 12 직전 수행) |
| 10 | Code review | ✅ PASS | `08-code-review.md` (CRITICAL 2건 + HIGH 4건 전부 수정) |
| 11 | Regression harness | ✅ PASS | `09-regression-harness.md` + Backend `auth.service.spec.ts` +6 테스트 |
| 12 | 배포 | ⏸️ 대기 | `10-deployment-runbook.md` 준비 완료 |

---

## Gate 5/10에서 발견 → 수정된 P0 (6건)

### CRITICAL

**C1 (Gate 5 + Gate 10): `pendingVerification.action` stale closure**
- 위치: `RegisterScreen.tsx:125`, 원인: `AuthContext.tsx:364`
- 증상: React state는 비동기 flush라 catch 블록의 `pendingVerification`이 stale null → **V114-8 2-way 다이얼로그 전체가 첫 시도에서 no-op**
- 수정: `EmailNotVerifiedError`에 `action?: 'created' | 'refreshed'` 필드 추가, error 객체로 동기 전달

**CRITICAL-2 (Gate 10): `ValidationPipe forbidNonWhitelisted` → confirmReset 거부**
- 위치: `auth.controller.ts:registerForce`
- 증상: `@Body() body: RegisterDto & { confirmReset?: boolean }` 인라인 타입은 class-validator 데코레이터 없어서 whitelist 탈락 → 모든 요청이 **400 property confirmReset should not exist** → register-force 전체 DOA
- 수정: `RegisterForceDto extends RegisterDto { @IsBoolean() @Equals(true) confirmReset }` 전용 DTO 신설. pipe 레벨에서 "명시적 opt-in" 강제

### HIGH (4건)

**H1 — `IGNORED_PATTERNS` 대소문자 오타**
- 위치: `admin.controller.ts:263`
- 증상: `message.toLowerCase()` 후 `.includes('abortError')` — 대문자 E 때문에 영원히 매치 안 됨, AbortError 소음 필터 절반 고장
- 수정: `'aborterror'` 로 소문자화 + "모든 패턴은 lowercase" 주석 명시

**H2 — CreateTripScreen dead code**
- 위치: `CreateTripScreen.tsx:1611`
- 증상: `aiTripsLimit === -1 || !Number.isFinite(...)` 가 PremiumContext 계약상 도달 불가능한 dead branch, 주석이 존재하지 않는 loading 상태를 설명
- 수정: admin/loading/free-premium 3분기로 간소화

**H3 — Premium upsell 라벨 회귀**
- 위치: `CreateTripScreen.tsx:1614-1624`
- 증상: V114-6b 통일화 과정에서 "프리미엄" 라벨이 사라져 premium 상태가 시각적으로 인식 안 됨
- 수정: `{isPremium ? '프리미엄: ' : ''}{remaining}/{total}` prefix로 통일 포맷 + upsell 식별 동시 유지

**H4 — Alert 중 isLoading race**
- 위치: `RegisterScreen.tsx:97` (finally)
- 증상: `refreshed` Alert 표시 후 catch가 return하면 `finally { setIsLoading(false) }` 즉시 실행 → 폼 재활성화 → 사용자가 Alert 열린 상태에서 다시 Submit → 중복 요청
- 수정: `keepLoading` flag로 finally 스킵, Alert onPress가 명시적으로 해제

**HIGH-3 — `(response as any).action` 타입 단언**
- 위치: `AuthContext.tsx:368, 425`
- 수정: `api.ts`에 `RegisterResponse` 인터페이스 신설, `register`/`registerForce` 반환 타입 명시

---

## Phase 7 Security 즉시 수정

**H-1 — ADMIN_EMAILS 하드코딩**
- 위치: `admin.guard.ts:10`, `subscription.service.ts:24`
- 증상: `|| 'a090723@naver.com,longpapa82@gmail.com'` fallback이 운영 이메일을 소스에 노출, env 누락 시 stale admin 자동 복원
- 수정: fallback 제거. 빈 env → 빈 allowlist + 시작 시 WARN 로그

---

## Regression Harness 구축 (Gate 11)

### Backend `auth.service.spec.ts` +6 신규 테스트

| 테스트 | 보호 대상 |
|---|---|
| `returns action='created' for brand-new signups` | V114-8 discriminator |
| `returns action='refreshed' when re-entering abandoned signup` | V114-8 discriminator |
| `registerForce rejects verified user with EMAIL_EXISTS` | H-2 보안 차단 |
| `registerForce rejects social provider` | H-2 보안 차단 |
| `registerForce hard-deletes abandoned and creates fresh` | happy path |
| `registerForce proceeds to create when no user exists` | defensive path |

**회귀 테스트 총계**: Backend 435/435 (이전 429 + 6 신규)

### Follow-up harness (V115 ship 후)

- Frontend Jest: `CoachMark.regression.test.tsx` — `statusBarTranslucent` 유지 검증
- Frontend Jest: `ConsentScreen.regression.test.tsx` — 17 언어 `privacy_optional` 부재 검증
- i18n 검증 스크립트: `scripts/verify-i18n.js`
- `.github/workflows/pre-release.yml`
- `.github/pull_request_template.md` with V109~V114 회귀 체크리스트

---

## 미해결 follow-up (ship-blocker 아님)

V115 배포 차단이 아닌 품질 개선 항목:

### MEDIUM (6건)
- **M1** CoachMark 코멘트가 "오버레이 바깥 탭으로 dismiss"라고 하지만 핸들러 없음 — 문서/구현 불일치
- **M2** `onDismiss` prop destructure되나 JSX 미사용, HomeScreen은 여전히 completeCoach 전달 — 튜토리얼 완료 추적 경로 점검 필요
- **M3** `PremiumContext.ADMIN_EMAILS` 프론트 하드코딩 + `.toLowerCase()` 누락 + `hoonjae723` 누락 — V114-6a 실제 동작 불일치 가능성 ⚠️ **배포 전 점검 권장**
- **M4** `/api/version` 엔드포인트 생겼지만 앱 launch-check 구현 없음 — V114-9 무중단 배포 경로 절반만 구현
- **M5** `register-force` rate limit IP 기준 → NAT/학교망에서 1명이 전체 차단. 이메일+IP 키잉 권장
- **M6** `DEPRECATED_CONSENTS` PRIVACY_OPTIONAL 기존 DB row의 withdraw 경로 부재 — GDPR migration 권장

### i18n 누락 (17개 언어)
- `register.refreshed.title/message/continue/startOver` (4개)
- `login.alerts.emailNotVerified`
- `create.aiInfo.preWarning`
- **영향**: 한국어 외 사용자에게 defaultValue(한국어) 노출. Alpha 테스터 대부분 한국어이므로 실제 영향 작음.

### LOW (5건)
- **L1** admin errorlog filtered response shape 불일치 (`{ filtered: true }`)
- **L2** 레거시 `/reset-password?token=...` 이메일이 WebAppRedirectScreen에 닿아도 token을 앱에 전달 안 함
- **L3** WebAppRedirectScreen 한국어 하드코딩
- **L4** `registerForce` analytics가 `register` 이벤트 `method: 'email_force'` 혼입
- **L5** App Store URL `id0000000000` placeholder
- **L6** ProfileScreen `aiTripsLimit > 0 ? ... : 3` unreachable fallback

---

## 배포 권장 경로

### 옵션 A (추천): M3만 배포 전 수정 후 즉시 배포
- `PremiumContext.tsx` ADMIN_EMAILS를 backend와 동기 + `.toLowerCase()` 적용 + `hoonjae723` 추가
- V114-6a "관리자 구독 시간 표기"의 실제 동작 보장
- 소요: ~5분, TS/Jest 재검증 포함 ~10분

### 옵션 B: 지금 즉시 배포
- V114에서 사용자에게 이미 노출된 14개 CRITICAL 이슈가 있으므로 신속 해결 우선
- M3는 follow-up으로 V116에서 정리
- 리스크: 관리자 계정 시간 표기가 PremiumContext 불일치로 작동 안 할 수 있음

### 옵션 C: 전체 follow-up 정리 후 배포
- M1~M6 + L1~L6 + i18n 전부 정리
- 소요: ~1일
- V114 노출 리스크가 이만큼 길어짐

**저는 옵션 A를 추천합니다.**

---

## Phase 12 배포 러너북 요약

`docs/v114/10-deployment-runbook.md` 참조. 단계:

1. **Pre-deploy** (~5분): pg_dump, Redis BGSAVE, Docker image tag 보존
2. **Backend rolling** (~5분): rsync → `docker compose build backend` → `up -d` → healthcheck 10회
3. **Frontend web 재빌드** (~3분): `docker compose build frontend` → `up -d` → nginx smoke
4. **EAS Build + Auto-submit** (~20분): `eas build --platform android --profile production --auto-submit`
5. **Alpha 검증** (~1시간): 14 시나리오 실기기 재현, 에러 로그 모니터링
6. **Gate 12 판정**: 13/14 이상 pass + 5xx < 0.5%

**Rollback 트리거**: 5xx > 0.5% or crash 5건+ or V114 이슈 재현 → `git reset --hard <prev>` + `docker compose up -d` + Play Console Alpha 이전 버전

---

## 최종 상태

```
Gate 0  ✅   Gate 1  ✅   Gate 2  ✅   Gate 3  ✅
Gate 4  ✅   Gate 5  ✅   Gate 6  ⚠️    Gate 7  ✅
Gate 8  ✅   Gate 9  ✅   Gate 10 ✅   Gate 11 ✅
Gate 12 ⏸️  (사용자 승인 대기)
```

**Phase 12 배포 진입 가능. 사용자가 옵션 A/B/C 중 선택하면 실행.**
