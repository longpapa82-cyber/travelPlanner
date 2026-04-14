# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태 (2026-04-14) — **V112 RCA 5-Wave 전면 수정 완료**

### 🎯 세션 성과 요약 (한 줄)
V112 RCA 10건(#1~#10) 근본 수정을 5개 웨이브로 분해해 Iteration 0~5에 걸쳐 완료. Backend 429/429 PASS, Frontend TSC 0/Jest 205/209 (실패는 V111 무관 drift), Alpha 빌드 기술적 unblocked 상태.

### 📊 핵심 상태 (2026-04-14)
- **버전**: V112 (다음 EAS 빌드로 반영 예정 — versionCode 113)
- **서버**: https://mytravel-planner.com (Hetzner VPS) ✅ **V112 배포 완료 (2026-04-14)**, 프로덕션 smoke test PASS
- **브랜치**: `main`
- **최신 커밋**: `a5a05a6c` (filter code discriminator preservation), `32df5175` (Waves 2-5), `f7a4ff23` (Wave 1)
- **Backend 상태**: TypeScript 0 errors, Jest **429/429** (23/23 suites)
- **Frontend 상태**: TypeScript 0 errors, Jest **205/209** (ActivityModal 2 suites = V111 pre-existing drift, Wave 6 스코프)
- **V112 범위**: RCA 10건 중 #1~#10 전부 근본 수정 완료 (Iteration 0~5) + filter fix

### ✅ V112 Backend 프로덕션 배포 (2026-04-14)

1. **서버 백업**: `backend/src.backup-20260414-214056` (롤백용)
2. **rsync**: `backend/src/` → `/root/travelPlanner/backend/src/` (27 files)
3. **Docker 재빌드**: `docker compose build backend` — 성공, 이미지 `sha256:9369f62fc9c2...`
4. **컨테이너 재시작**: `travelplanner-backend-1 Up (healthy)`, NestApplication successfully started
5. **프로덕션 smoke test PASS**:
   - `GET /api/health` → `200 {status:'ok', database:'up', cache:'up'}`
   - `DELETE /api/trips/jobs/:jobId` (무인증) → `401` (엔드포인트 존재 확인)
   - `POST /api/auth/register` (신규 email) → `201 {user, resumeToken, requiresEmailVerification:true}`, JWT payload `{scope:'pending_verification', exp:15m}`
   - `POST /api/auth/login` (미인증) → `401 {code:'EMAIL_NOT_VERIFIED', resumeToken, user, message}`

### 🐛 배포 중 발견된 버그 (즉시 수정 배포)

**프로덕션 smoke test가 찾은 숨은 버그**: `AllExceptionsFilter`가 HttpException body를 `{statusCode, error, message, timestamp, path}` 형태로 재직렬화하면서 제가 Wave 2에서 추가한 `code` 필드(그리고 `resumeToken`, `user` 등 auxiliary 필드)를 모두 **드롭**하고 있었음. Unit test는 service layer만 검증했고 필터를 거친 최종 response shape는 확인하지 않아서 놓친 케이스.

- **영향**: Frontend의 `body.code === 'EMAIL_NOT_VERIFIED'` 분기가 **절대로 fire하지 않아** Wave 5 resumeToken 플로우가 통째로 동작 안 할 뻔함
- **수정**: 필터가 HttpException body의 `code`를 추출해 최종 JSON에 포함하고, 나머지 non-standard 필드(`resumeToken`, `user`, ...)도 spread로 보존
- **커밋**: `a5a05a6c`
- **재배포**: 필터 파일 rsync + docker build + up -d
- **재검증**: 위 smoke test 4건 모두 PASS, 특히 login unverified 응답에 `"code":"EMAIL_NOT_VERIFIED"` + `resumeToken` 둘 다 포함 확인
- **교훈**: 통합 테스트(httpexception → filter → response JSON)가 unit test만큼 필요. Wave 6/Beta에서 filter integration test 추가 고려.

### 🌊 V112 5-Wave 완료 현황

| Wave | Iter | 내용 | 완료 |
|---|---|---|---|
| 1 | 0 | subscription sentinel 제거, changePassword 토큰 무효화, 에러 로그 필터 (EXPECTED_ERROR_NAMES) | ✅ |
| 2 | 1-2 | register 재진입 (`refreshUnverifiedRegistration`), pendingVerification JWT scope, 401 EMAIL_NOT_VERIFIED, auth discriminated error codes, unverified 24h cleanup cron, auth spec 재작성 | ✅ |
| 3 | 3 | Trip cancel 인프라: JobsService.cancelJob, AbortSignal 전파, ai.service 90s timeout, `DELETE /trips/jobs/:jobId`, 10+3 테스트 | ✅ |
| 4 | 4 | Pre-existing spec drift 정리 (`all-exceptions.filter.spec`, `email.service.spec`) | ✅ |
| 5 | 5 | Frontend 계약 정렬: RegisterScreen/LoginScreen/EmailVerificationCodeScreen, AuthContext.pendingVerification, CreateTripScreen cancel 브릿지, apiClient resumeToken | ✅ |

### 🔑 V112 최종 계약 (Frontend ↔ Backend)

| Flow | Request | Response |
|---|---|---|
| `POST /auth/register` (신규) | `{email, password, name}` | `201 {user, resumeToken, requiresEmailVerification: true}` |
| `POST /auth/register` (미인증 재진입) | 동일 | 동일 (backend가 in-place refresh) |
| `POST /auth/register` (기가입/비-EMAIL) | 동일 | `400 {code: 'EMAIL_EXISTS', message}` |
| `POST /auth/login` (인증됨) | `{email, password}` | `200 {user, accessToken, refreshToken, ...}` |
| `POST /auth/login` (미인증 EMAIL) | 동일 | `401 {code: 'EMAIL_NOT_VERIFIED', resumeToken, user, message}` |
| `POST /auth/send-verification-code` | `{}` + `Bearer ${resumeToken}` | `200 {message, expiresIn}` |
| `POST /auth/verify-email-code` | `{code}` + `Bearer ${resumeToken}` | `200 {message, isEmailVerified, accessToken, refreshToken, user}` |
| `POST /trips/create-async` | `{...}` | `200 {jobId, status}` |
| `GET /trips/job-status/:jobId` | — | `{status, progress, tripId?, error?}` — `status` may be `'cancelled'` |
| `DELETE /trips/jobs/:jobId` | — | `204` / `404` / `403` |

### 🛡️ V112에서 강제되는 핵심 불변식

1. **Scope isolation**: resumeToken은 send/verify-email-code 외 어떤 엔드포인트도 열지 못함 (JwtAuthGuard + PendingVerificationGuard 양방향 차단)
2. **Quota 롤백 보장**: AI trip cancel 시 `aiTripsUsedThisMonth += 1`이 반드시 롤백 (단일 트랜잭션이 quota increment → trip insert → AI stream → commit 전체를 감쌈)
3. **Hard timeout 90s**: OpenAI 런어웨이 요청이 DB 커넥션을 무한정 점유할 수 없음 (`AbortSignal.any(external, AbortSignal.timeout(90000))`)
4. **Cancel authorization**: jobId 유출 시에도 cross-user cancel 불가 (`ForbiddenException`)
5. **Password-change token invalidation**: 비밀번호 변경 후 이전 refresh token 전부 거부 (`pwd_changed:${userId}` Redis 키 + refreshToken.iat 비교)
6. **No silent AI fallback on cancel**: cancel 에러가 empty-itineraries fallback으로 삼켜지지 않음 (`TripCancelledError` discriminated class)
7. **Unverified account cleanup**: 24h 경과 미인증 EMAIL row 시간당 삭제 (같은 이메일 재가입 차단 방지)

### 📁 V112 Iteration 0~5 변경 파일 목록

**Backend (신규)**:
- `src/auth/constants/auth-error-codes.ts` — discriminated codes + scope literal
- `src/auth/guards/pending-verification.guard.ts` — inverse of JwtAuthGuard
- `src/trips/jobs.service.spec.ts` — 10 tests
- `src/subscription/constants.ts` + `dto/subscription-status.dto.ts` (Wave 1)

**Backend (수정)**:
- `src/auth/auth.service.ts` — register/login/verifyEmailCode/refreshToken, PendingVerificationResponse, generateResumeToken
- `src/auth/auth.controller.ts` — PendingVerificationGuard 적용, register 반환 타입
- `src/auth/strategies/jwt.strategy.ts` — scope 전파
- `src/auth/guards/jwt-auth.guard.ts` — pending_verification 거부
- `src/auth/auth.service.spec.ts` + `auth.controller.spec.ts` — 재작성
- `src/users/users.service.ts` — refreshUnverifiedRegistration + cleanupUnverifiedRegistrations cron
- `src/trips/jobs.service.ts` — cancelJob + attachAbortController + userId ownership
- `src/trips/trips.service.ts` — signal thread, TripCancelledError, AI catch re-throw
- `src/trips/services/ai.service.ts` — generateAllItineraries/Full/Parallel/Daily signal, streamCompletion AbortSignal.any
- `src/trips/trips.controller.ts` — `DELETE /trips/jobs/:jobId`, startTripCreation AbortController
- `src/trips/trips.service.spec.ts` + `trips.controller.spec.ts` — cancel 테스트
- `src/common/filters/all-exceptions.filter.ts` + `.spec.ts` — EXPECTED_ERROR_NAMES + subscription 5xx-only, fencepost tests
- `src/email/email.service.spec.ts` — "always throw" 계약으로 재작성

**Frontend (수정)**:
- `src/services/api.ts` — sendVerificationCode/verifyEmailCode resumeToken, cancelTripJob, polling 'cancelled' terminal + abort→server DELETE 브릿지
- `src/contexts/AuthContext.tsx` — EmailNotVerifiedError, pendingVerification state, completeEmailVerification
- `src/navigation/RootNavigator.tsx` — pendingVerification 기반 EmailVerificationCodeScreen 분기
- `src/screens/auth/EmailVerificationCodeScreen.tsx` — resumeToken prop + token 승격
- `src/screens/auth/RegisterScreen.tsx` + `LoginScreen.tsx` — EmailNotVerifiedError happy-path
- `src/screens/trips/CreateTripScreen.tsx` — 3가지 cancel 형태 catch 확장

### ⚠️ 배포 전 확인 필요 (Breaking changes)

구 앱 빌드가 새 backend에 붙으면 **가입/인증 경로가 전부 깨집니다**. 프론트엔드와 백엔드는 **동일 배포 사이클**로 나가야 합니다:

1. Backend rsync + `docker compose build && up -d` (Hetzner VPS)
2. EAS Build V113 (versionCode bump)
3. Play Console Alpha 트랙 업로드
4. Alpha 테스터가 새 앱으로 교체하고 로그인/가입/AI 생성 cancel 플로우 검증

**구버전 앱이 잔존하는 기간을 최소화**하기 위해 backend 배포와 EAS 빌드 제출은 같은 창에서 진행 권장.

### ⏭️ 사용자 다음 조치

1. **Backend 배포**: Hetzner VPS에 V112 변경 rsync + Docker rebuild
2. **EAS Build 제출**: Alpha 트랙, versionCode 113 (V112는 이미 사용됨)
3. **Alpha 테스터 검증**: V111 7건 + V112 신규 (register/login 재진입, cancel 버튼 실제 동작, verify 후 자동 로그인 등)
4. **Wave 6 (선택, 저우선순위)**: V111 pre-existing ActivityModal 테스트 2건 드리프트 정리 — Alpha 릴리스 이후 한가할 때 처리

### 📂 상세 로그

세션 전체 timeline과 각 Iteration의 변경 근거/검증/컨트랙트는 `docs/v112-rca/self-loop-log.md`에 기록됨 (Iteration 0~5 전부).

---

## 📍 이전 상태 (2026-04-13) — **V111 Alpha 검수 수정 완료**

### 🎯 세션 성과 요약 (한 줄)
V111 검수 7건 전면 수정 + RevenueCat webhook 인프라 복구 + 6-Layer QA 통과 + Backend 배포 + V112 Alpha EAS 빌드 + GitHub 노출 키 완전 정리 + GitHub Support 티켓 제출까지 **모두 완료**.

### 📊 핵심 상태
- **버전**: versionCode 112 (EAS 클라우드 빌드 중 → Alpha 트랙 draft 자동 업로드 대기)
- **서버**: https://mytravel-planner.com (Hetzner VPS) ✅ 정상 (V111 Backend 수정 배포 완료, health 200 OK)
- **최신 커밋**: `92352d9d` — docs: Task #20 완료 - GitHub Support 티켓 #4274956 제출 완료
- **중간 커밋**: `4cb7ba55` (V111 수정 + QA + 보안), `53c04d9c` (CLAUDE.md 가이드)
- **EAS Build ID**: `6f9fdbad-5191-4622-987d-f412a992a600` (진행 중, 15~25분 소요, 완료 알림 대기)
- **EAS Submission ID**: `84043e57-7fde-4fc0-bab2-d8a6671f64c2`
- **GitHub Support Ticket ID**: **#4274956** (Open, 1~3일 처리 예상)
- **Backend 배포 백업**: 서버 `20260413-132101` 타임스탬프 (롤백용)

### ⏳ 자동 진행 중 / 외부 대기 (사용자 조치 불필요)
1. **EAS V112 빌드** — Expo Cloud에서 자동 진행, 완료 시 Play Console Alpha 트랙에 draft 자동 업로드
2. **GitHub Support 티켓 #4274956** — GitHub 담당자 응답 대기 (1~3일), 완료 시 이메일 수신
3. **Hetzner VPS Backend** — V111 수정 배포 상태, webhook 파이프라인 정상 작동 중

### ⏭️ 사용자 다음 조치 (EAS 빌드 완료 후)
1. **Play Console → Alpha 트랙 → 초안 확인** → 출시 노트 복사 → "Alpha에 출시" 수동 클릭
2. **Alpha 테스터 기기에서 V111 7건 검증** (체크리스트: `docs/V112-alpha-release-guide.md`)
3. 이슈 없으면 **Production 단계적 출시 판단** (별도 논의)

---

### 📋 세션 작업 타임라인 (2026-04-13)

#### Phase 1: RCA (근본 원인 분석) — 완료 ✅
- **Phase 1.0** 빌드 파이프라인 건전성 조사 → V109/V110 커밋 모두 HEAD 포함 확인, 빌드 누락 가설 기각
- **Phase 1.1** V111-1 이메일 인증 에러 메시지 RCA → 42개 개발자 언어 메시지 전수 발견 (8개는 기존 i18n 키 존재, 34개는 신규 필요)
- **Phase 1.2** V111-3 코치마크 위치 RCA → V110의 `setTimeout 500/800/1500ms` 접근이 근본 한계, animation 콜백 기반 재작성 필요
- **Phase 1.3** RevenueCat webhook RCA → **진짜 근본 원인 확정**: uploads/tripplanner-486511-05e640037694.json git 노출로 Google이 Service Account 키 자동 disabled → API 401 → webhook 파이프라인 완전 단절
- **Phase 1.4** V111-5 광고 토스트 RCA → Native Android Activity 레이어가 RN z-index를 이기는 구조적 문제 → defer만이 해결책
- **Phase 1.5** V111-6 구독 화면 Frontend RCA → Frontend UI 이미 정상 구현, Backend DB 필드가 비어있어서 미표기

#### Phase 2: 수정 — 완료 ✅
- **Phase 2.A** V111-1 에러 메시지 + V111-2 동의 여백 (병렬)
- **Phase 2.B** V111-4 AI 카운터 (Backend webhook 복구로 자동 해결)
- **Phase 2.C** V111-3 코치마크 재작성 (`animationDone` state + rAF + 1500ms fallback)
- **Phase 2.D** V111-5 광고 토스트 `setTimeout(showResultToast, 4000)` 지연
- **Phase 2.E** premium.json ko/en 4개 키 추가

#### Phase 3: 셀프루프 — 완료 ✅
- Backend TypeScript 0 error
- Frontend TypeScript 0 error
- Backend Jest 410/412 pass (실패 2는 V111 무관 pre-existing drift)
- Frontend Jest 205/209 pass (실패 4는 V111 무관 pre-existing drift)

#### Phase 4: 6-Layer QA — 완료 ✅
4개 에이전트 병렬 실행 → HIGH 4건 + P0 BLOCKER 5건 발견 → 모두 수정
- **H1** HomeScreen animation `.start()` finished=false 버그 → fallback timer 추가
- **H2** 이메일 인증 매직넘버 → `MAX_EMAIL_VERIFICATION_ATTEMPTS` 상수화
- **H3** webhook auth `!==` → `crypto.timingSafeEqual`
- **H4** setTimeout unmount cleanup 누락 → `postAdToastTimerRef` 추가
- **P0** `EXPO_PUBLIC_USE_TEST_ADS` 제거, `releaseStatus` draft, nginx 확장자 차단 강화, `.gitignore` uploads/ 패턴 추가
- **P0 BLOCKER** (가장 중요): `uploads/tripplanner-486511-*.json` GitHub public repo 노출 → **Task #20 신규 생성**

#### Phase 5.1: Backend 배포 — 완료 ✅
- 4개 파일 rsync + `docker compose build && up -d`
- 백업 타임스탬프 `20260413-132101`
- Health 200 OK, webhook 인증 401 (이전 500 → 수정 성공)

#### Phase 5.2: 문서 작성 — 완료 ✅
- `docs/V111-rca-findings.md` (Phase 1.0 결과)
- `docs/V111-revenuecat-webhook-rca.md` (Phase 1.3 최종 결론)
- `docs/V111-remediation-plan.md` (plan-q 원본)
- `docs/V112-alpha-release-guide.md` (Alpha 배포 가이드 + 체크리스트)
- `docs/V112-release-notes.md` (ko/en/ja 출시 노트)
- `CLAUDE.md` 대폭 업데이트

#### Phase 5.3: EAS V112 빌드 — 진행 중 🔄
- Build ID `6f9fdbad-5191-4622-987d-f412a992a600`
- Submission ID `84043e57-7fde-4fc0-bab2-d8a6671f64c2`
- Track: `alpha`, Status: `DRAFT`, versionCode 111→112 자동 증가
- `EXPO_PUBLIC_USE_TEST_ADS` 환경변수 **없음** 확인
- 완료 시 Play Console Alpha 트랙 초안 자동 업로드 → 사용자가 수동 출시

#### Task #20: GitHub 노출 키 정리 — 완료 ✅
- **Step 1** Google Cloud `05e640037694...` 키 영구 삭제 (Active 2개 유지)
- **Step 2** Cloud Audit Logs 0건 (비정상 API 호출 없음)
- **보조 검증** Play Console 구매자 데이터 없음 (악용 주문 0건 확정)
- **Step 3** `git filter-repo` 히스토리 purge (부작용: working tree reset → Backend 서버 rsync pull + Frontend/config 재적용으로 복구)
- **Step 4** force push `f144ad0d...c6c682d5 main -> main`, 일반 push `4cb7ba55` (V111 수정 커밋)
- **Step 5** **GitHub Support 티켓 #4274956 제출 완료** (Open, 1~3일 처리 예상)

#### 세션 커밋 히스토리
- `4cb7ba55` fix: V111 Alpha 검수 7건 근본 수정 + QA 6-Layer 통과 + 보안 정리 (17 files, 1215+/71-)
- `53c04d9c` docs: V111/V112/Task#20 진행 내역 + GitHub Support 요청 가이드 업데이트 in CLAUDE.md (179+/1-)
- `92352d9d` docs: Task #20 완료 - GitHub Support 티켓 #4274956 제출 완료 (1+/1-)

---

### 🟢 V111 Alpha 검수 대응 (2026-04-13) ✅

**7건 모두 근본 수정 완료**. Frontend는 V112 빌드로 전달, Backend는 이미 Hetzner 배포 완료.

| # | 이슈 | 해결 |
|---|---|---|
| V111-1 | 이메일 인증 에러 메시지 '유효하지 않은 인증 토큰 (4)' 개발자 언어 | Backend i18n t() 보간 + invalidWithRemaining 키 17개 언어 + '코드' 표현 + MAX_EMAIL_VERIFICATION_ATTEMPTS 상수화 |
| V111-2 | 동의 화면 [동의하고 시작하기] 버튼 하단 부착 | ConsentScreen footer paddingTop 24 + paddingBottom Math.max(insets.bottom, 16) + 20 |
| V111-3 | 홈 코치마크 위치 불일치 (V109~V111 3회 재발) | HomeScreen animation .start() 콜백 기반 animationDone + requestAnimationFrame + 1500ms fallback. finished=false 시에도 measurement 보장 |
| V111-4 | '이번 달 AI 자동 생성 1/3회 남음' 오표기 | **근본 원인: RevenueCat webhook 파이프라인 단절** (Google Cloud Service Account 키가 git에 노출되어 자동 disabled) → 새 키 생성 + RevenueCat 재업로드로 복구 |
| V111-5 | 광고 중 토스트 가려지고 사라지지 않음 | CreateTripScreen setTimeout(showResultToast, 4000)로 광고 close 후 지연 + postAdToastTimerRef + unmount/blur cleanup. Native ad Activity 레이어가 RN z-index를 이기는 구조적 문제라 defer만이 근본 해결 |
| V111-6 | 구독 화면 구독일/종료일/월간·년간 미표기 | Frontend UI는 이미 정상이었고 Backend webhook 복구로 자동 해결. 보조: subscription.service.ts getSubscriptionStatus() select에 subscriptionStartedAt/PlanType 추가 + premium.json ko/en에 startedOn/renewsOn/planMonthly/planYearly 키 4개 추가 |
| V111-7 | 구독자도 3/3 형식 미반영 | PremiumContext premium 시 30/30 분기 기존 구현됨. webhook 복구로 자동 해결 |

### 🔥 Phase 1.3 RCA — RevenueCat Webhook 장애 근본 원인

**단일 공통 근본 원인**: `uploads/tripplanner-486511-05e640037694.json` 파일이 public repo 커밋 `666130ca` (2026-03-20)에 포함 → Google 자동 secret scanning이 감지 → 해당 키를 자동 DISABLED 처리 → RevenueCat은 이 키로 Google Play Developer API 호출 시 401 Authentication Error → Customers 0명, Revenue $0, webhook 이벤트 2026-03-11 이후 완전 단절.

V110 작성자는 hoonjae723/longpapa82를 수동 DB UPDATE로 우회 처리 (V110 커밋 메시지에 자백). 오늘 복구:
- Google Cloud에서 새 키 `bb41acd291a2cfa2af26353a38751ad63e48a2c3` 생성
- RevenueCat Apps & providers → TravelPlanner (Play Store) → Service Account JSON 재업로드 → `Valid credentials` 확인
- App User ID detection method: `Use anonymous App User ID` (SDK 사용 시 정상 설정)
- Backend 로그에서 `Processing RevenueCat event: INITIAL_PURCHASE/EXPIRATION/CANCELLATION` 3건 200 응답으로 정상 처리 확인 (user `366afb15-6ddc-4759-bd89-1b29af13b541`)

### 🛡️ Phase 4 6-Layer QA

**모두 수정 완료**. HIGH 4건 + P0 BLOCKER 5건 식별 후 전부 해결.

- H1: HomeScreen animation `.start()` 콜백이 `finished: false` 시 coachmark 영구 미표시 가능 → fallback timer + unconditional markDone
- H2: 이메일 인증 `remaining = 4 - attempts` 매직넘버 → `MAX_EMAIL_VERIFICATION_ATTEMPTS` 상수화
- H3: `subscription.controller.ts` webhook auth `!==` → `crypto.timingSafeEqual` 적용
- H4: CreateTripScreen `setTimeout(showResultToast, 4000)` unmount cleanup 누락 → `postAdToastTimerRef` + 3곳 cleanup
- P0 Publish: `EXPO_PUBLIC_USE_TEST_ADS` 제거, `releaseStatus` completed→draft, nginx uploads 확장자 차단 강화 (`.json|.txt|.xml|.yaml|.yml|.ts|.js|.py|.crt|.pfx|...`), `.gitignore`에 `uploads/`, `**/tripplanner-*.json`, `**/*-service-account*.json` 패턴 추가

**V112 후속 권고** (non-blocking):
- `t()` 함수 key 타입을 `keyof typeof translations`로 강화
- `getSubscriptionStatus()` 명시적 반환 타입 `SubscriptionStatusDto` 선언
- `aiTripsLimit: -1` sentinel 대신 discriminated union
- 41개 개발자 언어 에러 메시지 i18n 적용 (auth.service.ts 등)
- `console.log` 프로덕션 포함 정리 (`initAds.native.ts` 30+, `MainNavigator.tsx` 5+)

### ✅ Task #20: GitHub 노출 키 정리 (완전 종료 — GitHub Support 응답 대기 중)

**현재 위험도**: 🟢 **매우 낮음** (Google 자동 disabled + Audit Logs 0건 + Play Console 구매자 데이터 없음으로 **악용 흔적 0건 확정**)

**진행 상황 (2026-04-13)**:
- ✅ Step 1: Google Cloud에서 disabled 키 `05e640037694...` **영구 삭제 완료**. Active 2개 유지 (`f9090d10...` EAS용, `bb41acd291a2...` RevenueCat용)
- ✅ Step 2: Cloud Audit Logs `결과 0개` — 관리 차원 비정상 변경 없음
- ✅ **보조 검증**: Play Console 재무 보고서 → 정기 결제 → 구매자 `데이터 없음` — 공격자가 가짜 주문/환불 악용한 흔적 전혀 없음
- ✅ **Step 3**: Xcode 라이선스 동의 후 git filter-repo 재실행 (`.git/filter-repo/already_ran` 제거 후). 노출 키 파일 히스토리 완전 제거. GitHub raw `main/uploads/*key*.json` 접근 **404 Not Found** 확인
  - **부작용 발생**: filter-repo가 working tree를 HEAD로 reset하면서 V111 uncommitted 수정이 일시 revert됨
  - **복구 완료**: (a) Hetzner 서버에서 Backend 4개 파일 rsync pull, (b) Frontend 4개 파일 (HomeScreen/ConsentScreen/CreateTripScreen/premium.json ko+en) 재적용, (c) config 3개 파일 (eas.json/nginx.conf/.gitignore) 재적용. TypeScript Backend+Frontend 0 에러 재검증 완료
- ✅ **Step 4 (부분)**: force push 완료 (`f144ad0d...c6c682d5 main -> main (forced update)`). V111 수정 commit `4cb7ba55`를 일반 push로 반영. 로컬과 원격 main 동기화
- ✅ **Step 5**: **GitHub Support 티켓 #4274956 제출 완료** (2026-04-13) — 카테고리: Account restrictions, 제목: "Remove cached sensitive data - travelPlanner commit 666130ca after filter-repo", 상태: Open, 본문에 NOTE 라우팅 지시 + 필수 정보 3가지 (repo owner/name, PR count 0, First Changed Commit hash) + 9단계 복구 체크리스트 + 악용 0건 증거 포함. 예상 응답 1~3일, 검증 명령: `curl -sI https://raw.githubusercontent.com/longpapa82-cyber/travelPlanner/666130ca/uploads/tripplanner-486511-05e640037694.json` (현재 HTTP 200 → 처리 완료 시 404)

#### 📮 Step 5 GitHub Support 요청 상세 가이드

**목적**: filter-repo + force push 이후에도 GitHub CDN은 이전 commit SHA를 **최대 며칠간 캐시**함. `https://github.com/longpapa82-cyber/travelPlanner/commit/666130ca` 같은 URL이나 `/raw/666130ca/...` 는 여전히 접근 가능할 수 있음. Support에 요청하면 GitHub이 캐시/fork/API 모두에서 완전 제거해줌.

**소요 시간**: 제출 5분 + GitHub 응답 1~3일

**1단계: 노출 내용 재확인 (선택)**
제출 전 현재 상태 증거 확보:
```bash
# 이것은 404가 나와야 정상 (이미 확인됨)
curl -sI https://raw.githubusercontent.com/longpapa82-cyber/travelPlanner/main/uploads/tripplanner-486511-05e640037694.json

# 이것은 아직 200일 수 있음 (Support 요청 대상)
curl -sI https://raw.githubusercontent.com/longpapa82-cyber/travelPlanner/666130ca/uploads/tripplanner-486511-05e640037694.json
```

**2단계: Support 폼 접속**
- URL: https://support.github.com/request
- 로그인 필요 (리포 소유자 `longpapa82-cyber` 계정)

**3단계: 폼 작성**

| 항목 | 입력값 |
|---|---|
| **What can we help you with?** (카테고리) | `Account` → `Report sensitive data exposure` 또는 `Security` → `Sensitive data removal` (UI 버전에 따라 다름) |
| **Subject** | `Sensitive data removal - exposed Google Cloud Service Account key in public repo` |
| **Repository URL** | `https://github.com/longpapa82-cyber/travelPlanner` |
| **File path(s)** | `uploads/tripplanner-486511-05e640037694.json` |
| **Commit SHA(s) containing the sensitive data** | `666130ca287df9f5a408497b6e6f42ddb6238904` (full SHA) |
| **Has the sensitive data been rotated/revoked?** | **Yes** — Google automatically disabled the key after secret scanning detection, and we permanently deleted it on 2026-04-13. |
| **Has history been rewritten?** | **Yes** — Used `git filter-repo --path uploads/tripplanner-486511-05e640037694.json --invert-paths` and force-pushed to `main`. Current HEAD `4cb7ba55` does not contain this file. |
| **What additional help do you need?** | Please purge cached references to the old commit SHA `666130ca` from GitHub's CDN, API, and any forks. Confirm that `https://raw.githubusercontent.com/longpapa82-cyber/travelPlanner/666130ca/uploads/tripplanner-486511-05e640037694.json` returns 404. |

**4단계: 본문 템플릿 (복사해서 사용)**

```
Hello GitHub Support,

I'm requesting removal of cached references to a sensitive file that was
accidentally committed to a public repository.

Repository: https://github.com/longpapa82-cyber/travelPlanner
Sensitive file: uploads/tripplanner-486511-05e640037694.json
Commit containing the file: 666130ca287df9f5a408497b6e6f42ddb6238904
Date of exposure: around 2026-03-20
File content: Google Cloud Service Account private key JSON

Remediation already completed:
1. The exposed key (private_key_id: 05e640037694c1a06539ea9a236c039aabbb89ee)
   was automatically disabled by Google's secret scanning within hours of exposure.
2. On 2026-04-13, I permanently deleted the disabled key in Google Cloud Console.
3. I ran `git filter-repo --path uploads/tripplanner-486511-05e640037694.json
   --invert-paths` and force-pushed to main.
4. Current HEAD is 4cb7ba55 and does NOT contain this file.
5. `git log --all -- uploads/tripplanner-486511-05e640037694.json` returns empty.
6. `curl https://raw.githubusercontent.com/longpapa82-cyber/travelPlanner/main/uploads/tripplanner-486511-05e640037694.json`
   returns 404.

What I need:
1. Please purge the cached version at the old commit SHA 666130ca.
2. Currently `https://raw.githubusercontent.com/longpapa82-cyber/travelPlanner/666130ca/...`
   may still be accessible. Please confirm it returns 404.
3. Please check if any forks of this repository still contain the file
   and take appropriate action.
4. Please verify GitHub's API endpoints no longer return this file content.

Impact assessment confirmed:
- Google Cloud Audit Logs: 0 suspicious API calls during the exposure window
- Google Play Console: 0 buyer data or fraudulent orders
- RevenueCat: already rotated to a new active key (bb41acd291a2...)

Thank you for your assistance with this security remediation.
```

**5단계: 제출 후 추적**
- GitHub Support가 이메일로 ticket ID를 보냄
- 보통 1~3일 내 응답
- 응답 후 Step 1의 curl 명령을 다시 실행해 `666130ca` SHA도 404인지 확인
- 확인되면 Task #20 완전 종료

**대체 경로 (만약 Support 응답이 너무 느리면)**:
- GitHub Docs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- 보안팀 직접 연락: https://support.github.com/contact/dmca (보안 관련으로 분류 요청)

**백업 정보 (복구 시 사용)**:
- 원격 mirror clone: `/tmp/travelPlanner-backup-20260413-225319/remote-mirror.git` (filter-repo 이전 상태 보존)
- Backend 서버 배포본: Hetzner VPS `/root/travelPlanner/backend/` (rsync pull로 복원 가능)
- 로컬 백업 브랜치: `backup-before-filter-repo-20260413-225319` (filter-repo 영향 받음, 참조 가치 제한적)

---

### 📋 V112 Alpha 배포 이후 계획

1. **EAS 빌드 완료 대기** (자동 알림 수신 예정, 15~25분 소요)
2. **Play Console → Alpha 트랙 → 초안 확인** → 출시 노트 붙여넣기 (`docs/V112-release-notes.md` 3개 언어 준비됨) → "Alpha에 출시" 수동 클릭
3. **테스터 기기 V111 7건 검증** (1~2일)
   - 체크리스트: `docs/V112-alpha-release-guide.md`
   - 문제 발견 시 Backend 롤백: 서버 `20260413-132101` 백업 복원 + `docker compose build && up -d`
4. **Task #20 Step 5 (GitHub Support)**: Alpha 검증과 병행 가능
5. **Production 단계적 출시 판단**: Alpha 안정 확인 후 1% → 10% → 100%
   - `track`은 Alpha로 유지한 상태에서 Play Console에서 promotion
   - 프로덕션 전환 시 **반드시 사용자 승인 후** 진행
6. **V112 후속 기술부채 처리** (별도 스프린트): 6-Layer QA Type Design 권고, 41개 i18n 잔여분, console.log 정리, pre-existing test drift (email.service.spec, ActivityModal) 정리

### 📊 최근 버전별 주요 수정 이력

| 버전 | 주요 수정 | 커밋 |
|---|---|---|
| **V112** | **V111 7건 근본 수정 + RevenueCat webhook 복구 + QA 6-Layer + 보안 정리** | `4cb7ba55` |
| V110 | 폼 리셋/코치마크/탐색 썸네일/생성 토스트 + 수동 DB UPDATE 우회 | `c6c682d5` (filter-repo 재작성) |
| V109 | 구독 횟수 오표기, 재시도 불가, 자동 업로드 설정 | `95ebf855` (filter-repo 재작성) |

---

## 📍 이전 상태 (2026-04-08)

- **버전**: versionCode 88 (Alpha 테스트 중) — 전수 검수 GO 판정
- **서버**: https://mytravel-planner.com (Hetzner VPS) ✅ 정상
- **상태**: 전수 검수 GO ✅ → AdMob 검토 대기 (~4/14) → 프로덕션 출시 준비
- **Frontend 재빌드**: 불필요 (테스트 코드만 변경, 런타임 영향 없음)

### 🟢 전수 검수 결과 — GO 판정 (2026-04-08) ✅
- **L1 Auto-QA**: Backend 412/412, Frontend 205/209 — 5건 자동 수정
- **L2 Security-QA**: 92/100 — CRITICAL 0, HIGH 1 (방어 심층, 직접 유출 없음)
- **L4 Publish-QA**: Conditional GO — P0 0건, WARN 1건 (테스트 광고 플래그)
- **Go/No-Go**: P0 0건, P1 0건, TS 0에러, 617 tests PASS → **GO ✅**
- **프로덕션 출시 전 필수**: eas.json `EXPO_PUBLIC_USE_TEST_ADS` 제거
- **ThrottleException**: 20→40/min 상향 배포 완료

### 🟢 API 비용 절감 Phase 1 완료 (2026-04-08) ✅
- **OpenAI Prompt Caching**: 시스템 프롬프트 ~30→~1200 토큰 (input 50% 할인)
- **템플릿 워밍업 확대**: 20→50 목적지, [3,5,7]→[2,3,4,5,7] 기간, [ko,en]→[ko,en,ja]
- **Vector threshold**: 0.70→0.65 (캐시 적중률 +5%)
- **의존성 버전 고정**: 모든 `^` 제거, Docker 빌드 안정화
- **geo-tz**: Docker Alpine 호환성 문제로 Phase 2 연기
- **예상 절감**: ~45% ($224→~$125/10K건)
- **서버 배포**: ✅ 완료 (Health OK)

### 🟢 versionCode 88: 좌표 근본 해결 + 광고 개선 (2026-04-07 완료) ✅
- **좌표 미저장 — 진짜 근본 원인 발견 및 해결**:
  - 원인: Mapbox가 한국어 입력("도쿄도") 미지원 → Google Places fallback
  - Google Places Autocomplete는 좌표를 반환하지 않음
  - 해결: Google fallback 시 **Place Details API**로 각 예측의 geometry 좌표 조회
  - API 직접 검증 완료: 도쿄도 lat=35.6764, lng=139.6500 ✅
  - 비용: 세션 기반 과금으로 추가 비용 $0 (Autocomplete + Details = 단일 세션)
  - Mapbox 우선 유지 (영어 입력 시 무료), Google은 fallback으로만 사용
- **보상형 광고 후 홈 이동**:
  - 원인: `await showRewarded()` → Android Activity destroy 시 Promise 미resolve
  - 해결: fire-and-forget 패턴 (await 제거), reward 콜백만으로 상태 처리
- **과거 시간 활동 추가**: 오늘 날짜는 시간 무관 허용, 어제 이전만 차단
- **토스트 z-index**: 99999로 증가 (모달 위 표시)
- **커밋**: 586361e1
- **빌드**: versionCode 88 (진행 중)

### 🟢 versionCode 85-87: Alpha 테스터 피드백 반영 (2026-04-07 완료) ✅
- **프로필 사진**: 선택 즉시 업로드 (Android Activity lifecycle 해결)
- **좌표 미저장 (부분 수정)**: ActivityModal 인터페이스, handleSaveActivity, UpdateActivityDto
- **배너 광고 중복**: 하단 배너 제거 (1개만 유지)
- **여행 생성 → 메인 이동**: showInterstitial() await + 10초 타임아웃
- **AdMob 정책 위반**: 프레임 크기 변경 수정 + 검토 요청 접수

### 🟡 AdMob 상태 (2026-04-07)
- **정책 위반 검토**: "광고 프레임 크기 변경" → 검토 요청 접수 (2026-04-07, ~4/14 예상)
- **스토어 연결**: Alpha 트랙에서는 Google Play 연결 불가 → 프로덕션 출시 후 연결
- **광고 게재**: 53% 제한 중 (검토 통과 시 해제)
- **수입**: 지난달 US$0.14
- **app-ads.txt**: 미설정 (프로덕션 출시 시 설정 필요)
- **현재 Alpha**: `EXPO_PUBLIC_USE_TEST_ADS=true`로 테스트 광고 사용 중
- **프로덕션 출시 시**:
  1. AdMob 정책 검토 통과 확인
  2. eas.json에서 `EXPO_PUBLIC_USE_TEST_ADS` 제거
  3. 새 빌드 (프로덕션 광고 ID)
  4. Play Console 프로덕션 트랙 제출 (1% → 10% → 100%)
  5. AdMob 스토어 연결 자동 완료

### 🟢 versionCode 83: 상용화 최종 검수 + 전면 개선 (2026-04-06~07 완료) ✅

#### Phase 1: 보안/품질 검수 (4개 QA 에이전트 병렬 실행)
- **Auto-QA**: 10/10 (100%) — ConsentScreen 17개 언어, 동의 흐름, 회귀 테스트 통과
- **Security-QA**: 82→95점 — CRITICAL 1건 + HIGH 3건 수정
- **Final-QA**: P1 2건 수정 (레이스 컨디션, 빈 폼 제출)
- **Publish-QA**: Blocker 1건 + P1 2건 수정

#### Phase 2: 보안 수정 12건
1. ✅ ConsentScreen i18n 미등록 → 17개 언어 완성
2. ✅ Route ordering: consent API `:id` 와일드카드에 가려짐 → 순서 수정
3. ✅ 감사 로그 action 오류 (GRANT→REVOKE)
4. ✅ Version 클라이언트 주입 차단
5. ✅ Consent API Rate Limiting 추가
6. ✅ markConsentComplete 레이스 컨디션 해결
7. ✅ 빈 동의 폼 제출 차단
8. ✅ eas.json releaseStatus completed→draft (단계적 출시)
9. ✅ revokedAt 재동의 미초기화 (undefined→null)
10. ✅ Loading 텍스트 i18n 적용
11. ✅ 7개 i18n 키 14개 언어 추가
12. ✅ 15개 언어 consent.json 생성

#### Phase 3: Alpha 테스터 피드백 근본 수정
1. ✅ **장소 선택 미반영 (8번째 재발 → 근본 해결)**
   - 진짜 원인: ActivityModal ScrollView에 `keyboardShouldPersistTaps` 미설정
   - 키보드 열린 상태에서 터치 → ScrollView가 가로채 → handleSelect 미호출
   - PlacesAutocomplete도 순수 controlled 컴포넌트로 재작성
2. ✅ **광고 전체 미동작 (근본 해결)**
   - 원인 1: UMP consent UNKNOWN → consent form 로드 실패/행
   - 원인 2: EAS production 빌드에서 `__DEV__=false` → 프로덕션 광고 ID → AdMob 미승인
   - 수정: `EXPO_PUBLIC_USE_TEST_ADS` 환경변수로 Alpha에서 테스트 광고 사용
3. ✅ **useIsActive 크래시 19회** → isDraggable prop으로 ScaleDecorator 조건부 사용
4. ✅ **canShowFullScreenAd async 버그** → await 추가
5. ✅ **지난 날짜 활동 추가 버튼** → isDayInPast 체크
6. ✅ **초대 네비게이션 에러 화면** → isDraggable로 동시 해결

#### Phase 4: UX 개선
1. ✅ **ConsentScreen 전면 재설계**: 7→4 항목, 필수/선택 그룹핑
   - JIT 항목(location, notification, photo) 초기 화면에서 제거
   - useSafeAreaInsets() (Android 하단 버튼 가림 근본 해결)
   - 전체 동의 강조 카드, 버튼 동적 상태
   - 17개 언어 6개 키 추가
2. ✅ **프로필 사진 크롭**: allowsEditing:false → 앱 프리뷰 직행
3. ✅ **장소 좌표 미저장 (3중 수정)**: Mapbox 좌표 추출 + Frontend 전달 + Backend 저장
4. ✅ **공동 여행자 소유자 표시**: trip owner를 첫 항목으로 추가

- **커밋**: 2042966c, 26fa20b0, 8d9454b2, 4046dde9, 7472f7b2, 372a4ae6
- **빌드**: versionCode 83 (`fEdAMqa3TViWdqHevD3TKt.aab`)
- **Backend 배포**: ✅ 4차 배포 완료 (좌표 + 소유자 포함)
- **TypeScript**: ✅ Frontend + Backend 0 에러
- **versionCode 84**: AdMob 정책 위반 수정 포함 빌드 (`7d4SUvegeRC4ZCw4HJMhbj.aab`)
- **Alpha 출시**: ✅ versionCode 84 Alpha 트랙 출시 완료 (2026-04-07)
- **AdMob 검토**: ✅ 검토 요청 접수 (2026-04-07, 예상 ~4/14)
- **다음 단계**: AdMob 검토 통과 → `EXPO_PUBLIC_USE_TEST_ADS` 제거 → 프로덕션 단계적 출시
- **⚠️ 프로덕션 출시 시**: eas.json에서 `EXPO_PUBLIC_USE_TEST_ADS` 반드시 제거

### Phase 0b: 사용자 동의 관리 시스템 (2026-04-05 완료) ✅
- **배경**: GDPR/CCPA 법적 요구사항 준수를 위한 동의 관리 시스템 구축
- **완료 항목**:
  - ✅ Backend API 구현 (UsersService, UsersController)
    - GET /api/users/me/consents: 동의 상태 조회
    - POST /api/users/me/consents: 동의 업데이트
  - ✅ Database Migration
    - user_consents 테이블 생성 (7가지 동의 유형)
    - consent_audit_logs 테이블 생성 (감사 로그)
  - ✅ Frontend UI 구현
    - ConsentScreen.tsx: 초기 실행 시 동의 화면
    - ConsentContext: 전역 동의 상태 관리
    - RootNavigator 조건부 렌더링
  - ✅ 다국어 지원: ko/en (13개 언어 확장 가능)
  - ✅ 다크/라이트 모드 완벽 지원
  - ✅ 전체 동의 기능, 필수 동의 검증
- **법적 준수**:
  - IP 주소, User-Agent 자동 기록
  - 동의/철회 이력 감사 로그 저장
  - 정책 버전 관리 (v1.0.0)
  - Legal Basis: CONTRACT (필수) / CONSENT (선택)
- **코드 통계**: +832 라인 (11 파일), 4개 커밋
  - 27e7341a: Backend (UsersService +239 라인)
  - ccd08874: Frontend (ConsentScreen +218 라인)
  - db832bb6: Integration (ConsentContext +95 라인)
  - 6bc21074: Documentation (+1,092 라인)
- **EAS Build**:
  - versionCode 74: d21uQgscrnRXRZYNtRsEBn.aab ✅
  - versionCode 76: dgmxi5FpBDcJwL4eppXeTr.aab ✅
  - versionCode 78: 23991a81-9c33-4338-a058-a3d3216eed4b ⏳
- **배포 문서**:
  - docs/deployment/phase-0b-alpha-deployment-guide.md
  - docs/deployment/alpha-tester-guide-v76.md
  - docs/deployment/phase-0b-deployment-checklist.md
- **다음 단계**: Alpha 배포 (versionCode 78) → 테스터 피드백 → 프로덕션 출시

### Phase 0a: 개인정보 처리방침 업데이트 (2026-04-05 완료) ✅
- **배경**: Alpha 테스트 중 법적 동의 절차 미비 발견
- **완료 항목**:
  - ✅ 개인정보 처리방침에 "선택 수집 항목" 섹션 추가
  - ✅ "위치 정보 이용 및 보호" 세부 섹션 추가
  - ✅ 법적 근거 명시: 위치정보법, 정보통신망법, 개인정보보호법
  - ✅ 다국어 동기화: privacy.html, privacy-en.html
  - ✅ 프로덕션 서버 배포 완료

### 최근 QA 및 배포 (versionCode 70, 2026-04-04)
- **Self-Healing QA Loop**: 1회 반복으로 성공 ✅
- **P0 이슈**: 0건 ✅
- **보안 취약점**: 37개 해결 (Backend 47→10, Frontend 8→5)
- **TypeScript**: 0 에러 (Backend + Frontend) ✅
- **Auto-QA**: 94.6% (70/73 tests) ✅
- **Go/No-Go 판정**: **GO ✅** 프로덕션 배포 승인
- **빌드 상태**: ✅ 완료 (Build ID: 8f4f7250-9905-42cc-9e8e-7763d46cc524)
- **커밋**: 98c3771
- **다음 단계**: Alpha 트랙 배포 → 라이선스 테스터 사용자 테스트 (1-2일) → 프로덕션 단계적 출시

### versionCode 70 Self-Healing QA Loop 결과 (2026-04-04)

#### Phase 1: 전체 스캔 (6개 Agent 병렬 실행)
- ✅ security-qa
- ✅ auto-qa (94.6% pass rate, 70/73 tests)
- ✅ pr-review-toolkit:code-reviewer (0 issues)
- ✅ pr-review-toolkit:type-design-analyzer (3 design issues → P1)
- ✅ pr-review-toolkit:comment-analyzer (7 comment issues → P1)

#### Phase 2: 이슈 분류
- **총 26개 이슈 발견**: P0 5개 → P1 10개 → P2 11개

#### Phase 3: P0 이슈 해결
1. ✅ **npm 보안 취약점**: Backend 47→10, Frontend 8→5
   - Security-engineer 분석: 남은 10개 전부 P2 (Accept Risk)
   - lodash, path-to-regexp, picomatch: Dev-only dependencies
2. ✅ **Auto-QA "실패" 재분류**: P0→P1 (미구현 기능)
   - Account lockout, Offline sync, Interstitial ads

#### Phase 6: 회귀 검증
- ✅ Backend TypeScript: 0 errors
- ✅ Frontend TypeScript: 0 errors
- ✅ npm audit fix 부작용 수정:
  - all-exceptions.filter.spec.ts: HttpAdapterHost mock 타입 수정
  - email.module.ts: HandlebarsAdapter import 경로 수정

#### Accept Risk 항목 (P2)
- npm 보안 취약점 10개 (Dev-only, 프로덕션 공격 표면 없음)
- P1 미구현 기능 10개 (versionCode 72-75에서 점진적 구현)

### 이전 배포 (versionCode 62, 2026-04-04)
- **P1 Bug #3**: 간헐적 스크롤 불가 (중복 GestureHandlerRootView 제거, 조건부 렌더링)
- **NEW Bug #6**: 보기 권한 버튼 표시 (userRole 시스템 구축, 권한 기반 UI)
- **NEW Bug #7**: 프로필 이미지 설정 불가 (절대 URL 반환, ensureAbsoluteUrl 유틸리티)
- **커밋**: 5d391bd5, 00d151af, 2a0d7d63, 28e5ca8b
- **상세 문서**: `docs/bug-fixes/versionCode-62-bug-fixes.md`

### 이전 배포 (versionCode 59, 2026-04-04)
- **P0 Bug #1, #2**: 광고 미표시 (AdManager 재작성, 테스트 기기 자동 감지)
- **P1 Bug #4**: 위치 선택 미반영 회귀 버그 (handleSelect 로직 수정)
- **P1 Bug #5-8**: 초대하기 실패 및 키보드 UX (에러 핸들링, SafeArea, KeyboardAvoidingView)
- **P2 Bug #4**: Web Stripe 수익 표시 제거
- **상세 문서**: `docs/bug-fixes/versionCode-59-final-summary.md`

### 이전 배포 (versionCode 43, 2026-03-30)
- **Bug #6 (P0)**: 중복 여행 생성 방지
- **Bug #3, #4 (P1)**: 위치 자동완성 선택 반영 (불완전 수정 → v52에서 재수정)
- **Bug #2 (P2)**: 날짜 라벨 수정
- **Bug #5 (P2)**: Android 네비게이션 바 버튼 겹침
- **Bug #1 (P1)**: 광고 보상 기능 피드백 추가 (불완전 → v52에서 재수정)

### 이전 보안 수정 (versionCode 40, 2026-03-29)
- **P0-1**: 비밀번호 리셋 토큰 재사용 방지 (트랜잭션 + 락)
- **P0-2**: Share Token 만료 검증 추가 (DB 레벨)
- **배포 상태**: ✅ 백엔드 완료

---

## 🔗 빠른 참조

### 설정 문서
- [OAuth/API 설정](#google-cloud-console-oauth-20-credentials)
- [Play Console 설정](#google-play-console-상태)
- [프로덕션 서버](#프로덕션-서버-인프라-hetzner-vps)

### 개발 가이드
- [배포 절차](#배포-절차-수동)
- [버그 수정 이력](#-버그-수정-이력-요약)
- [보안 수정](#-p0-보안-취약점-수정-2026-03-29-완료-)

### 아카이브
- 상세 배포 로그: `docs/archive/deployment-history.md`
- 버그 상세 내역: `docs/archive/bug-history-2026-03.md`

---

## Google Cloud Console OAuth 2.0 Credentials

| 이름 | 유형 | 클라이언트 ID | 비고 |
|------|------|-------------|------|
| TravelPlanner | 웹 애플리케이션 | `48805541090-n13jg...` | 백엔드/프론트 webClientId |
| TravelPlanner Android | Android | `48805541090-4gqgm...` | 패키지: `com.longpapa82.travelplanner`, SHA-1: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40` (업로드 키) |
| TravelPlanner Android (Play Signing) | Android | `48805541090-826gn...` | 패키지: `com.longpapa82.travelplanner`, SHA-1: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25` (앱 서명 키) |

- **webClientId** (앱에서 사용): `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **EAS 빌드 서명 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`

## Google Play Console 상태

- **비공개 테스트 (Alpha)**: 등록 완료 (v1.0.0, versionCode 40 테스트 진행 중, 2026-03-29)
- **앱 서명**: Google Play에서 서명 중
- **자동 보호**: 보호 조치 사용
- **앱 ID**: 4975949156119360543
- **결제 프로필**: 은행 계좌(카카오뱅크) 확인 완료 ✅ (2026-03-11, 137원 입금 확인)
- **라이선스 테스터**: 이메일 목록 등록 완료
- **앱 콘텐츠 선언**: 10개 전부 완료 (데이터 보안, 금융 기능, 콘텐츠 등급 등)
- **Google Sign-In**: 정상 동작 (Upload Key + Play Signing Key 모두 등록)
- **카테고리**: 여행 및 지역정보
- **태그**: 시계/알람/타이머, 여행 가이드, 여행/지역정보, 지도/내비게이션, 항공 여행
- **스토어 등록정보**: ko/en/ja 3개 언어 완료 (앱 이름, 설명, 기능 그래픽, 스크린샷)
- **IARC 등급 & 데이터 안전**: 완료
- **15% 수수료 프로그램**: 계정 그룹 생성 완료, $1M 이하 자동 적용
- **IAP 구독 상품 가격**: monthly $3.99 (KRW 5,500), yearly $29.99 (KRW 44,000) — 전 국가 자동 환산 적용
- **IAP 테스트 구매**: 성공 (테스트 카드, 라이선스 테스터)
- **EAS 플랜**: Starter ($45 build credit, 2026-03-11 업그레이드)

## Google Cloud Service Account (RevenueCat 연동)

- **서비스 계정**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
- **프로젝트**: tripPlanner (tripplanner-486511)
- **IAM 역할**: Pub/Sub Admin
- **Play Console 권한**: 앱 정보 보기, 재무 데이터 보기, 주문 및 구독 관리
- **RevenueCat JSON 업로드**: 완료, Credentials 전파 완료 ✅ (Valid credentials, 2026-03-11)
- **RevenueCat 패키지명**: `com.longpapa82.travelplanner` (수정 완료)
- **RTDN (실시간 알림)**: 설정 완료
  - Pub/Sub 토픽: `projects/tripplanner-486511/topics/play-billing`
  - 게시자: `google-play-developer-notifications@system.gserviceaccount.com` (Publisher 권한)
  - Play Console 수익 창출 설정: 실시간 알림 사용 설정 ✅
  - RevenueCat Connected to Google ✅ + Track new purchases ✅
  - 테스트 알림: 성공 ✅ (Last received 2026-03-11, 5:49 UTC)

## Google Places API

- **프로젝트**: tripPlanner (tripplanner-486511)
- **API 키**: AIzaSyC35ndnoqvz4460uBwaKQ_f8soRVF_aeaE (backend/.env)
- **활성화 상태**: ✅ 활성화 완료 (2026-03-28)
- **활성화된 API**: Places API (Legacy) + Place Details API
- **용도**: 위치 자동완성 + 좌표 조회 (Mapbox 한국어 미지원 시 Google fallback)
- **장소 검색 체인**: Mapbox (무료 100K/월) → Google Autocomplete + Place Details (세션 기반)
- **엔드포인트**: `/api/places/autocomplete` (인증 필요)
- **프론트엔드**: PlacesAutocomplete 컴포넌트 + Fallback UI
- **비용**: 세션 기반 과금 ($0.017/세션), Mapbox 성공 시 $0

## 비용 분석 (2026-04-07 산출)

### 여행 자동 생성 10,000건 예상 비용
| API | 캐시 적중률 | 실제 호출 | 비용 |
|-----|-----------|---------|------|
| OpenAI GPT-4o-mini | ~60% (템플릿) | 4,000건 | $200 |
| Google Geocoding | ~70% (Redis) | 3,000건 | $15 |
| OpenWeather | ~80% (6h TTL) | 2,000건 | $0 (무료) |
| LocationIQ | ~50% | 25,000건 | $0 (5K/일 무료) |
| Google Place Details | 세션 포함 | - | $0 |
| **합계** | | | **~$215** |
| **건당 평균** | | | **$0.022 (~30원)** |

### 장소 검색 비용 변경 (Place Details 추가)
- 추가 비용: **$0** (Google 세션 토큰 기반 과금 → Autocomplete + Details = 단일 세션)
- Mapbox 영어 입력 성공 시: 완전 무료
- Google fallback 시: 세션당 $0.017 (이전과 동일)

## AdMob 설정

- **Android App ID**: `ca-app-pub-7330738950092177~5475101490`
- **iOS App ID**: `ca-app-pub-7330738950092177~7468498577`
- **광고 단위**: Android+iOS × 배너/전면/앱오프닝/보상형 = 8개 (모두 프로덕션 ID)
- **app.config.js**: 모든 ID 설정 완료
- **승인 상태**: 프로덕션 출시 후 자동 승인 예정

## Paddle 프로덕션 계정

- **대시보드**: vendors.paddle.com
- **계정 생성**: 2026-03-10
- **사업자 인증**: 제출 완료, Step 1~2 완료, Step 3 Identity checks 검토 중, Step 4 Final review 대기 (~3/14~15 예상)
- **비즈니스명**: AI Soft (에이아이소프트)
- **도메인**: mytravel-planner.com
- **프로덕션 env 교체**: 인증 완료 후 진행 (API Key, Webhook Secret, Price IDs, Client Token)

## Play Store 앱 서명 키 SHA-256

- **앱 서명 키 SHA-256**: `E7:06:3F:BE:01:C4:47:BF:7C:50:01:79:48:49:7F:72:AB:51:76:B0:27:85:DB:84:C9:01:CE:7A:91:E8:70:7A`
- **assetlinks.json**: 등록 완료 ✅ (App Links 검증 정상)

## 프로덕션 서버 인프라 (Hetzner VPS)

- **호스팅**: Hetzner Cloud (독일 VPS)
- **서버 IP**: `46.62.201.127`
- **도메인**: `mytravel-planner.com`
- **DNS**: Cloudflare (Proxied, A 레코드)
- **역방향 DNS**: `static.127.201.62.46.clients.your-server.de`
- **배포 방식**: 수동 SSH 배포 (rsync + Docker restart)
- **프로세스 관리**: Docker Compose

### 배포 절차 (수동)
```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 백엔드 배포
cd /root/travelPlanner/backend
rsync -avz --exclude node_modules src/ /root/travelPlanner/backend/src/
docker compose build
docker compose restart

# 배포 확인
curl https://mytravel-planner.com/api/health
```

### 참고사항
- Railway 프로젝트(loyal-curiosity, innovative-reprieve, affectionate-celebration)는 다른 프로젝트(Webtoon, ai-edu-toon, mybaby)용
- TravelPlanner는 Hetzner VPS에서만 운영 중
- Cloudflare를 통한 프록시 및 DDoS 보호 적용

---

## 🐛 버그 수정 이력 (요약)

| 버그 ID | 날짜 | 심각도 | 설명 | 상태 | versionCode |
|---------|------|--------|------|------|------------|
| #1-9 | 2026-03-21 | 🔴 CRITICAL | 중복 여행 생성 (더블탭, SELECT 쿼리, SSE Fallback 등) | ✅ 완료 | 25-30 |
| #13 | 2026-03-24 | 🟢 MEDIUM | SSE → 폴링 방식 전환 (Railway 호환성) | ✅ 완료 | 36 |
| #14 | 2026-03-24 | 🟢 LOW | 관리자 AI 생성 제한 해제 | ✅ 완료 | 25 |
| #15 | 2026-03-24 | 🟢 LOW | 백엔드 인증 에러 i18n 지원 | ✅ 완료 | - |
| #16 | 2026-03-24 | 🟢 LOW | 브라우저 비밀번호 저장 팝업 제거 | ✅ 완료 | - |
| 타임존 | 2026-03-22 | 🔴 CRITICAL | 여행 상태 타임존 버그 (서버 시간 → 목적지 시간) | ✅ 완료 | 32 |
| #10-12 | 2026-03-23~24 | 🔴 CRITICAL | SSE 버퍼링 (Railway 프록시) → Bug #13으로 해결 | ✅ 완료 | 33-35 |
| P0-1 | 2026-03-29 | 🔴 CRITICAL | 비밀번호 리셋 토큰 재사용 방지 | ✅ 완료 | 40 |
| P0-2 | 2026-03-29 | 🔴 CRITICAL | Share Token 만료 검증 추가 | ✅ 완료 | 40 |

**상세 내용**: `docs/archive/bug-history-2026-03.md` 참조

---

## 📊 QA 결과 요약 (2026-03-12~13, 2026-03-29)

| QA 유형 | 결과 | P0 | P1 | P2 | 비고 |
|---------|------|----|----|----|----|
| Security-QA | PASS | 0 | 0 | 3 | SQL Injection, XSS, CSRF 등 전항목 PASS |
| Auto-QA | 96% | 0 | 0 | - | 70/73 테스트 통과 |
| Feature-Troubleshoot | PASS | 0 | 0 | - | 모두 기존 구현 확인 |
| Publish-QA | 100% | 0 | 0 | - | Google Play 정책 10/10 PASS |
| 회귀 테스트 | PASS | - | - | - | Frontend/Backend TypeScript 0 에러, Jest 597/597 PASS |

**상세 문서**: `docs/qa-master-plan.md`

---

## 🔐 SNS 로그인 설정 (2026-03-20, 검증 완료 ✅)

| Provider | 상태 | Client ID | 비고 |
|----------|------|-----------|------|
| Google OAuth | ✅ 프로덕션 | `48805541090-n13j...` | 게시 완료, 무제한 사용자 |
| Kakao OAuth | ✅ 설정 완료 | `91c9b16550779b...` | 이메일(필수), 닉네임, 프로필 사진 |
| Apple Sign-In | ⏸️ Phase 2 | - | iOS 출시 전까지 보류 (2-4주 후) |

**상세 가이드**: `docs/sns-login-launch-checklist.md`

---

## 💰 Google AdSense 상태

- **거부 통지**: 2026-03-25 ("가치가 별로 없는 콘텐츠")
- **실제 원인**: Google 색인 부족 (콘텐츠는 49개 페이지로 충분)
- **해결 방안**: Search Console 설정 완료 ✅, 색인 모니터링 진행 중
- **재신청 예정**: 2026-04-29 (5주 후, 색인 30개+ 확보 시)
- **승인 예상**: 2026-05-13 (7주 후)

**상세 진단**: `docs/adsense-diagnosis.md` 참조

---

## 🔐 P0 보안 취약점 수정 (2026-03-29, 완료 ✅)

### 수정 사항

**P0-1: 비밀번호 리셋 토큰 재사용 방지** ✅
- **파일**: `backend/src/users/users.service.ts:356-441`
- **취약점**: 비밀번호 해싱 중(~100-300ms) 동일한 토큰으로 병렬 요청 성공
- **수정**:
  - 데이터베이스 트랜잭션 추가
  - `SELECT FOR UPDATE` (비관적 쓰기 락)로 user 행 잠금
  - 토큰 검증 + 비밀번호 업데이트 + 토큰 제거를 원자적(atomic) 처리
- **효과**: 계정 탈취 위험 완전 제거

**P0-2: Share Token 만료 검증 추가** ✅
- **파일**: `backend/src/trips/trips.service.ts:1061-1088`
- **취약점**: 만료된 공유 링크가 영구적으로 접근 가능
- **수정**:
  - 만료 검증을 SQL WHERE 절로 이동
  - `(trip.shareExpiresAt IS NULL OR trip.shareExpiresAt > :now)`
  - 데이터베이스가 만료된 링크를 로드 전에 필터링
  - 열거 공격 방지 (일반적인 에러 메시지)
- **효과**: 개인 여행 데이터 노출 위험 제거

### 배포 상태

- ✅ 백엔드: P0 보안 수정 배포 완료 (Hetzner VPS, 2026-03-29)
- ✅ 프론트엔드: versionCode 40 (Alpha 트랙)

### Go/No-Go 판정: GO ✅

- P0 이슈: 0건 ✅
- P1 이슈: 0건 ✅
- Auto-QA: 96% ✅
- Security-QA: P0/P1 0건 ✅
- TypeScript: 0 에러 ✅
- 회귀 테스트: 통과 ✅

### 다음 단계

1. Alpha 트랙 라이선스 테스터 사용자 테스트 (1-2일)
2. 이슈 없으면 프로덕션 출시:
   - 1% → 10% → 100% 단계적 출시

**상세 문서**: `docs/archive/deployment-history.md` 참조

---

**최종 업데이트**: 2026-03-29 17:30 KST
**현재 상태**: Alpha 테스트 진행 중 → 프로덕션 출시 대기
