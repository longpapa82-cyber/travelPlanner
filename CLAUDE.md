# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태 (2026-04-15) — V115 12-Phase 전수 수정 완료, Phase 12 배포 대기

### 핵심 상태
- **버전**: V115 (다음 EAS 빌드 versionCode 115)
- **서버**: https://mytravel-planner.com (Hetzner VPS) — V112 배포 상태, V115 Pre-deploy
- **브랜치**: `main`
- **Backend**: TypeScript 0 errors, Jest **435/435** (23/23 suites, +6 V115 regression)
- **Frontend**: TypeScript 0 errors, Jest **204/204** active (14/14 active suites, ActivityModal 2 skipped)
- **상세 게이트 요약**: `docs/v114/11-final-gate-summary.md`

### V115 12-Phase 요약

| Phase | 내용 |
|---|---|
| 0 | 탐색/재현 — 14 이슈 인벤토리, 회귀 원인 분석 (`docs/v114/00~02`) |
| 1 | Plan-Q RCA — Modal statusBarTranslucent 가설 확정 등 (`03-rca-and-plan.md`) |
| 2 | Backend 수정 — email URL `/app/*`, register action discriminator, registerForce, RegisterForceDto, `/api/version`, error_log IGNORED_PATTERNS, ADMIN_EMAILS fallback 제거 |
| 3 | Frontend 수정 — CoachMark statusBarTranslucent, 17개 언어 consent.json, CreateTripScreen 카운터 통합, ProfileScreen modal minHeight 제거, SubscriptionScreen formatBillingDate, register 2-way dialog via error.action |
| 4 | 웹 로그인 차단 — `WebAppRedirectScreen` + App.tsx web 분기 |
| 5 | auto-qa — P0 5건 전수 수정 (C1, H1~H4) |
| 6 | Playwright — 실기기 smoke로 대체, harness 문서화 |
| 7 | Security — CRITICAL 0, H-1 ADMIN_EMAILS 하드코딩 제거 |
| 8 | final-qa — skip (Gate 5/7/10 전부 clean) |
| 9 | Play Store — `08-play-store-checklist.md` |
| 10 | Code review — CRITICAL 2건 + HIGH 4건 전수 수정 |
| 11 | Regression harness — Backend `auth.service.spec.ts` +6 tests, 상시화 문서 |

### V115 핵심 수정 (V114 14 이슈 근본 해결)

| ID | 근본 원인 | 수정 위치 |
|---|---|---|
| **V114-1** | Expo web 앱이 mytravel-planner.com에서 풀 서비스 | `App.tsx` web 분기 → `WebAppRedirectScreen`, email URL `/app/verify`·`/app/reset` |
| **V114-2a** | `CoachMark.tsx` Modal에 `statusBarTranslucent` 누락 (**6회 회귀**의 근본 원인) | 한 줄 prop 추가 |
| **V114-2b** | dismissBtn JSX 잔존 | 제거 |
| **V114-3** | `modalContent.minHeight: 400` + `space-between` | 제거, 컨텐츠 크기 자동 |
| **V114-4a** | ConsentScreen jitNotice 여백 부족 | marginTop 12, marginBottom 24, footer paddingTop 24 |
| **V114-4b/4c** | `privacy_required.title`에 "(필수)" + `privacy_optional` 중복 | 17개 언어 i18n 일괄 + backend DEPRECATED_CONSENTS 필터 |
| **V114-5** | 사전 경고 토스트가 상태 문자열 재사용 + `remaining: 1` 하드코딩 | `create.aiInfo.preWarning` 별도 키 + 동적 계산 |
| **V114-6a** | SubscriptionScreen `formatDate()` 시간 미포함 | `formatBillingDate()` admin 분기 |
| **V114-6b** | Premium 분기 정적 "월 30회" | `"프리미엄: X/30회 남음"` 통일 포맷 |
| **V114-7** | error_logs에 quota/cancel/throttle 노이즈 | `ErrorLogController.IGNORED_PATTERNS` 서버 필터 |
| **V114-8** | V112 `refreshUnverifiedRegistration` + 프론트 UX 미완성 | `action: 'created'\|'refreshed'` discriminator + `register-force` + 2-way dialog |
| **V114-9** | 무중단 배포 구조 부재 | `/api/version` + minAppVersionCode 100 |

### V115 최종 계약 (Frontend ↔ Backend) — V112 계약 + 추가

| Flow | Request | Response |
|---|---|---|
| `POST /auth/register` (신규) | `{email, password, name}` | `201 {action: 'created', user, resumeToken, requiresEmailVerification: true}` |
| `POST /auth/register` (미인증 재진입) | 동일 | `201 {action: 'refreshed', user, resumeToken, requiresEmailVerification: true}` |
| `POST /auth/register` (기가입/비-EMAIL) | 동일 | `400 {code: 'EMAIL_EXISTS', message}` |
| `POST /auth/register-force` 🆕 | `{email, password, name, confirmReset: true}` | 동일 (action='created'), rate limit 1/10min per IP |
| `GET /api/version` 🆕 | — | `{apiVersion, minAppVersionCode: 100, recommendedAppVersionCode: 115, ...}` |
| Email 재설정 URL 🆕 | — | `https://mytravel-planner.com/app/reset?token=...` (App Links) |
| Email 인증 URL 🆕 | — | `https://mytravel-planner.com/app/verify?token=...` (App Links) |

### V115 핵심 불변식 (V112 + 추가)

V112 불변식 7건 전부 유지. 추가:

8. **register-force 2중 가드**: controller에서 `@Equals(true)` DTO validator + service에서 verified/social 계정 BadRequestException. VPN rate limit 우회해도 verified row는 절대 삭제되지 않음
9. **Error 객체로 discriminator 전달**: `EmailNotVerifiedError.action`은 catch 블록에서 stale React closure 없이 동기 읽기 가능. `pendingVerification` state는 RootNavigator 전환용, action 판단용 아님
10. **Admin allowlist single source of truth**: backend `ADMIN_EMAILS` env var. fallback 금지. 프론트엔드 `PremiumContext.ADMIN_EMAILS`는 cold-start 용 fallback이며 반드시 lowercase로 비교
11. **웹 차단 구조**: `Platform.OS === 'web'`에서 AuthProvider/RootNavigator mount 금지. 웹에서는 `WebAppRedirectScreen`만 렌더링. SEO 정적 페이지(`landing.html`, `guides/*`, `privacy.html`)는 nginx 직접 서빙

### Gate 5/10/7에서 발견 → 수정된 P0 6건

| ID | 설명 | 파일 |
|---|---|---|
| **C1** | `pendingVerification.action` stale closure → 2-way dialog no-op | `AuthContext.tsx`, `RegisterScreen.tsx` → error 객체 전달 |
| **CRITICAL-2** | `forbidNonWhitelisted` → confirmReset 거부 → register-force DOA | `RegisterForceDto` 신설 |
| **H1** | `'abortError'` 대소문자 오타 | `'aborterror'` |
| **H2** | CreateTripScreen dead code (`-1`, `!isFinite`) | 분기 간소화 |
| **H3** | Premium upsell 라벨 회귀 | `"프리미엄: "` prefix |
| **H4** | Alert 중 isLoading race → 중복 submit | `keepLoading` flag |
| **H-1 (Security)** | ADMIN_EMAILS 소스 하드코딩 | env 기반 + empty 경고 |
| **M3** | PremiumContext ADMIN_EMAILS `.toLowerCase()` 누락 + `hoonjae723` 누락 | lowercase 비교 + 리스트 보강 |

### ⚠️ 배포 주의 (V115)

V115는 V112처럼 breaking 계약 변경 없음. 그러나:

1. **email URL 변경**: 레거시 `/reset-password?token=` / `/verify-email?token=` 링크가 사용자 inbox에 남아 있음. 이 링크를 클릭하면 WebAppRedirectScreen이 뜨고 앱으로 deep link되지 않음. **사용자에게 새 메일 요청 필요**
2. **웹 사용자 이탈**: V114까지는 웹에서 로그인 가능했으나 V115부터 불가. SEO 트래픽은 유지
3. **Backend + Frontend 동시 배포 원칙** 유지

### ⏭️ 다음 조치

1. **Phase 12 배포** — 사용자 승인 후 `docs/v114/10-deployment-runbook.md` 실행
2. **Alpha 테스터 검증** — 14 시나리오 재현 (`docs/v114/01-reproduction.md`)
3. **Follow-up (V116)**: M1/M2/M4/M5/M6, i18n 17개 언어 신규 키 5세트, L1~L5

### 상세 로그
- V115 최종 게이트 요약: `docs/v114/11-final-gate-summary.md`
- V114 14 이슈 인벤토리: `docs/v114/00-inventory.md`, `00-inventory-backend.md`
- V115 배포 러너북: `docs/v114/10-deployment-runbook.md`
- V112 이력: `docs/archive/claude-md-history-pre-v112.md`

---

## 🔗 빠른 참조

- [OAuth/API 설정](#google-cloud-console-oauth-20-credentials)
- [Play Console 상태](#google-play-console-상태)
- [프로덕션 서버](#프로덕션-서버-인프라-hetzner-vps)
- [배포 절차](#배포-절차-수동)
- [버그 수정 이력 요약](#-버그-수정-이력-요약)

**아카이브**:
- `docs/archive/claude-md-history-pre-v112.md` — V111 및 이전 버전 이력
- `docs/archive/deployment-history.md` — 상세 배포 로그
- `docs/archive/bug-history-2026-03.md` — 초기 버그 상세

---

## Google Cloud Console OAuth 2.0 Credentials

| 이름 | 유형 | 클라이언트 ID | 비고 |
|------|------|-------------|------|
| TravelPlanner | 웹 | `48805541090-n13jg...` | 백엔드/프론트 webClientId |
| TravelPlanner Android | Android | `48805541090-4gqgm...` | 업로드 키 SHA-1 |
| TravelPlanner Android (Play Signing) | Android | `48805541090-826gn...` | 앱 서명 키 SHA-1 |

- **webClientId**: `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`
- **Play Store 앱 서명 키 SHA-256**: `E7:06:3F:BE:01:C4:47:BF:7C:50:01:79:48:49:7F:72:AB:51:76:B0:27:85:DB:84:C9:01:CE:7A:91:E8:70:7A`
- **패키지명**: `com.longpapa82.travelplanner`
- **assetlinks.json**: 등록 완료 (App Links 검증 정상)

## Google Play Console 상태

- **트랙**: 비공개 테스트 (Alpha) 진행 중, versionCode 112
- **앱 ID**: 4975949156119360543
- **결제 프로필**: 카카오뱅크 계좌 확인 완료 (2026-03-11)
- **앱 콘텐츠 선언**: 10개 전부 완료
- **스토어 등록정보**: ko/en/ja 3개 언어
- **IAP 가격**: monthly $3.99 (KRW 5,500), yearly $29.99 (KRW 44,000)
- **IAP 테스트 구매**: 성공
- **15% 수수료 프로그램**: $1M 이하 자동 적용
- **카테고리**: 여행 및 지역정보
- **EAS 플랜**: Starter

## Google Cloud Service Account (RevenueCat)

- **서비스 계정**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
- **IAM 역할**: Pub/Sub Admin
- **Play Console 권한**: 앱 정보/재무/주문·구독 관리
- **Active 키**:
  - `f9090d10...` — EAS용
  - `bb41acd291a2...` — RevenueCat용 (V112 재발급, 노출 키 영구 삭제 완료)
- **RTDN**: Pub/Sub `projects/tripplanner-486511/topics/play-billing`
- **패키지명**: `com.longpapa82.travelplanner`
- **webhook 상태**: 정상 (V112 재발급 후 `INITIAL_PURCHASE/EXPIRATION/CANCELLATION` 200 응답 확인)

## Google Places API

- **API 키**: `backend/.env`의 `GOOGLE_PLACES_API_KEY`
- **활성화 API**: Places API (Legacy) + Place Details API
- **장소 검색 체인**: Mapbox (무료 100K/월) → Google Autocomplete + Place Details (세션 기반 fallback)
- **용도**: Mapbox 한국어 미지원 시 Google로 좌표 조회 (versionCode 88에서 근본 해결)
- **엔드포인트**: `/api/places/autocomplete` (인증 필요)
- **비용**: 세션당 $0.017, Mapbox 성공 시 $0

## 비용 분석 (여행 자동 생성 10,000건 기준, Phase 1 최적화 후)

| API | 캐시 적중률 | 호출 | 비용 |
|-----|-----------|------|------|
| OpenAI GPT-4o-mini (Prompt Caching 적용) | ~60% | 4,000 | ~$110 |
| Google Geocoding | ~70% (Redis) | 3,000 | $15 |
| OpenWeather (6h TTL) | ~80% | 2,000 | $0 |
| LocationIQ | ~50% | 25,000 | $0 (5K/일 무료) |
| Google Place Details | 세션 포함 | — | $0 |
| **합계** | | | **~$125** (건당 ~17원) |

Phase 1 최적화: OpenAI Prompt Caching, 템플릿 워밍업 확대(50목적지×5기간×3언어), vector threshold 0.70→0.65, 의존성 버전 고정 → **~45% 절감** ($224 → $125).

## AdMob 설정

- **Android App ID**: `ca-app-pub-7330738950092177~5475101490`
- **iOS App ID**: `ca-app-pub-7330738950092177~7468498577`
- **광고 단위**: Android+iOS × 배너/전면/앱오프닝/보상형 = 8개 (모두 프로덕션 ID)
- **현재 Alpha**: `EXPO_PUBLIC_USE_TEST_ADS=true` 환경변수로 테스트 광고 사용
- **프로덕션 출시 시 반드시**: `eas.json`에서 `EXPO_PUBLIC_USE_TEST_ADS` 제거 + 새 빌드

## Paddle 프로덕션 계정

- **대시보드**: vendors.paddle.com (비즈니스명: AI Soft)
- **도메인**: mytravel-planner.com
- **상태**: 사업자 인증 완료 대기 → env 교체 (API Key, Webhook Secret, Price IDs, Client Token)

## 프로덕션 서버 인프라 (Hetzner VPS)

- **호스팅**: Hetzner Cloud (독일)
- **서버 IP**: `46.62.201.127`
- **도메인**: `mytravel-planner.com`
- **DNS**: Cloudflare (Proxied)
- **배포**: 수동 SSH + rsync + Docker Compose

### 배포 절차 (수동)

```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 백엔드 배포 (restart 대신 up -d 사용 — 502 방지)
cd /root/travelPlanner/backend
rsync -avz --exclude node_modules src/ /root/travelPlanner/backend/src/
docker compose build
docker compose up -d

# 배포 확인
curl https://mytravel-planner.com/api/health
```

**참고**: Railway 프로젝트는 다른 앱 (Webtoon, ai-edu-toon, mybaby)용. TravelPlanner는 Hetzner 단일.

---

## 🐛 버그 수정 이력 요약

| 버그 ID | 날짜 | 심각도 | 설명 | versionCode |
|---------|------|--------|------|-------------|
| #1-9 | 2026-03-21 | CRITICAL | 중복 여행 생성 (더블탭, SELECT, SSE Fallback) | 25-30 |
| 타임존 | 2026-03-22 | CRITICAL | 여행 상태 타임존 (서버→목적지 시간) | 32 |
| #10-13 | 2026-03-23~24 | CRITICAL | SSE → 폴링 전환 (Railway 호환성) | 33-36 |
| P0-1 | 2026-03-29 | CRITICAL | 비밀번호 리셋 토큰 재사용 방지 (트랜잭션 + SELECT FOR UPDATE) | 40 |
| P0-2 | 2026-03-29 | CRITICAL | Share Token 만료 검증 (SQL WHERE 이동) | 40 |
| VC88-좌표 | 2026-04-07 | HIGH | Mapbox 한국어 미지원 → Google Place Details fallback | 88 |
| V111-1~7 | 2026-04-13 | HIGH | Alpha 검수 7건 (i18n, 코치마크, AI 카운터, 광고 토스트 등) | 112 |
| V112 RCA #1~10 | 2026-04-14 | CRITICAL | Auth scope, cancel, quota, filter code drop 등 | 113 |
| V114 #1~9 (14건) | 2026-04-15 | CRITICAL | CoachMark 6회 회귀 (statusBarTranslucent), 웹 로그인 차단, consent 중복, register refreshed UX, 카운터 통합, error_log 필터 | 115 |
| V115 Gate5/10 P0 | 2026-04-15 | CRITICAL | C1 stale closure, RegisterForceDto whitelist, H1~H4, ADMIN_EMAILS 하드코딩 | 115 |

상세: `docs/archive/bug-history-2026-03.md`, `docs/archive/claude-md-history-pre-v112.md`

---

## 🔐 SNS 로그인

| Provider | 상태 | 비고 |
|----------|------|------|
| Google OAuth | 프로덕션 | 게시 완료, 무제한 사용자 |
| Kakao OAuth | 설정 완료 | 이메일(필수), 닉네임, 프로필 |
| Apple Sign-In | Phase 2 (보류) | iOS 출시 전까지 대기 |

상세: `docs/sns-login-launch-checklist.md`

---

## 💰 Google AdSense

- **현재 상태**: 거부 (2026-03-25, "가치가 별로 없는 콘텐츠" — 실제로는 Google 색인 부족)
- **재신청 예정**: 2026-04-29 (색인 30개+ 확보 후)
- **상세**: `docs/adsense-diagnosis.md`

---

## 🔐 보안 아키텍처 요약

1. **Auth**: JWT 15m access + one-time refresh (Redis jti, eviction=reject) + bcrypt 12 + CSPRNG 2FA (backup codes SHA-256) + account lockout + pending_verification scope isolation (V112)
2. **Access**: Rate limiting all auth endpoints + AdminGuard (email-based) + 2FA lockout + PendingVerificationGuard
3. **Transport**: HSTS preload + CSP (no unsafe-eval) + Referrer-Policy + CORS whitelist
4. **Data**: SELECT FOR UPDATE on password reset, SQL-level share token expiry filter, Stored XSS 방지 (stripHtml DTO), uploads/ .gitignore 패턴

---

**최종 업데이트**: 2026-04-15 (V115 12-Phase 수정 완료, Phase 12 배포 대기)
