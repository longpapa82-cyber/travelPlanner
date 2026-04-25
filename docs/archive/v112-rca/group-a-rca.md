# V112 Group A RCA — 보안/결제 무결성 (3건)

**Date**: 2026-04-14
**Status**: RCA 완료, 수정 계획 수립 대기

---

## #1 — 웹 로그인 우회 (CRITICAL 아키텍처)

### Root cause
`frontend/Dockerfile`이 `npx expo export --platform web`으로 **전체 RN 앱을 Expo Web SPA로 빌드**하여 `travelplanner-frontend-1` 컨테이너에 배포. 엣지 nginx의 `location / → frontend:8080` fall-through로 `/login`, `/home`, `/trips`, `/profile`, `/subscription` 등 **모든 앱 라우트가 mytravel-planner.com에서 접근 가능**. 비밀번호 변경 후 네비게이션 코드는 무죄 — 이것은 사용자가 웹 SPA 자체를 보고 있는 것.

### Evidence
- `curl https://mytravel-planner.com/home` → HTTP 200 (앱 화면)
- `curl https://mytravel-planner.com/login` → HTTP 200 (앱 화면)
- `curl https://mytravel-planner.com/trips` → HTTP 200 (앱 화면)
- `frontend/Dockerfile:~30` — `RUN npx expo export --platform web`
- 서버 `/root/travelPlanner/proxy/nginx.conf` — `location /` fall-through to `frontend:8080`
- `frontend/src/navigation/RootNavigator.tsx:24-63` — linking.prefixes에 `'https://mytravel-planner.com'` 포함, screens에 Login/Home/Trips/Profile 전부 path 정의
- `backend/src/users/users.service.ts:221` — changePassword가 refresh token 무효화 안 함

### Fix direction

**Quick patch (즉시, ~30분)**:
```nginx
# proxy/nginx.conf, server block for mytravel-planner.com, BEFORE `location /`
location ~ ^/(login|register|forgot-password|reset-password|home|profile|trips|consent|subscription|verify-email|onboarding|announcements)(/|$) {
    return 301 https://mytravel-planner.com/landing.html;
}
```
`location /`는 allowlist(landing*.html, faq.html, guides/, privacy.html, terms.html, licenses.html, assetlinks.json, sitemap.xml, robots.txt, ads.txt, app-ads.txt, favicon.ico)만 서빙.

**Proper fix (이번 스프린트)**:
1. `frontend/Dockerfile`의 `expo export --platform web` 제거 → marketing-only static 빌드로 대체
2. `RootNavigator.tsx:28` linking.prefixes에서 `'https://mytravel-planner.com'` 제거. 유지: `travelplanner://`, 유니버설 링크는 `/share/:token`, `/reset-password?token=...` 만 허용
3. `backend/src/users/users.service.ts:221` changePassword 직후 `refreshTokenService.revokeAllForUser(id)` 호출
4. `assetlinks.json` path 패턴을 share + reset-password 2개로 축소

**Architectural correction (다음 스프린트)**:
- `web-marketing` / `mobile-app` 2개 컨테이너 분리
- `app.config.js` platforms 배열에서 `web` 제거
- Backend CORS를 모바일 UA + 파트너 origin 화이트리스트로 제한

### Risk if unfixed
- **Security**: 크리덴셜 테스팅 전면 노출, 계정 탈취 (refresh token 미무효화 조합)
- **Revenue**: 웹 SPA에서 RevenueCat SDK 미설정 → 전 사용자가 무료 프리미엄 (`usePremium` 클라이언트 사이드 체크 DevTools로 우회 가능)
- **Play Store 정책**: 비-Play 결제 경로 제공은 Payments policy 위반 → Alpha/Production 출시 정지 위험
- **AdSense**: 로그인 뒤 컨텐츠를 승인된 원본과 같은 origin에 올리는 것은 정책 불일치 → 영구 밴 위험

---

## #7 — 연간 플랜 시작일/다음 결제일 동일 (표시 + 샌드박스)

### Root cause (7-A: 날짜 동일)
**DB 직접 조회 결과**: yearly 플랜인데 `expiresAt - startedAt = 정확히 30분`.
- `hoonjae723`: started `2026-04-14 10:26:54`, expires `2026-04-14 10:56:54`
- `longpapa82`: started `2026-04-14 10:56:54`, expires `2026-04-14 11:26:54`

**Google Play License Tester 샌드박스의 가속 갱신**: 연간 구독을 30분 주기로 자동 갱신하는 Google의 테스트 가속 정책. RevenueCat webhook이 받는 `expiration_at_ms`가 실제로 30분 후임. `subscription.service.ts:185-187`는 이 값을 그대로 저장 (올바른 동작).

`SubscriptionScreen.tsx:46-49`의 `formatDate(dateStr).toLocaleDateString()`가 시간을 잘라서 두 timestamp가 같은 "2026-04-14"로 렌더링 → 사용자 눈에는 시작일=종료일로 보임.

**중요**: 프로덕션 실결제에서는 정상 1년 expiry. 이것은 샌드박스 특성 + 표시 문제.

### Root cause (7-B: 관리자 미표시)
- `longpapa82@gmail.com`은 `ADMIN_EMAILS`에 포함 (`PremiumContext.tsx:9`)
- `SubscriptionScreen.tsx:54`는 `isPremium` 단독 분기로 렌더링, `isAdmin`은 고려 안 함
- 관리자는 AI trip 면제(L121-125)만 받고, `isPremium`은 `false`로 유지
- 30분 샌드박스 만료 후 `PremiumContext.tsx:112`에서 `expiresAt < now` 체크로 다시 `isPremium=false` → 관리자가 "업그레이드" 카드로 떨어짐

### Evidence
- DB 실데이터 (SSH 확인): 30분 delta 확인
- Backend logs: `INITIAL_PURCHASE` 10:27, `RENEWAL` 10:57 → 30분 Google 샌드박스 cadence
- `backend/src/subscription/subscription.service.ts:185-187` — `event.expiration_at_ms` 그대로 저장 (정상)
- `frontend/src/screens/main/SubscriptionScreen.tsx:46-49` — `toLocaleDateString()` 시간 제거
- `frontend/src/contexts/PremiumContext.tsx:105-114` — `isPremium` 로직에 `isAdmin` 무시
- `frontend/src/screens/main/SubscriptionScreen.tsx:54` — premium 블록이 `isPremium ? ... : ...`

### Fix direction

1. **표시 정확성** (`SubscriptionScreen.tsx:46-49`): `(expiresAt - startedAt) < 24h`이면 `toLocaleString()` (date+time) 사용 + `(테스트 구매)` 배지 표시. 샌드박스 진실을 숨기지 말 것.
2. **Admin override** (`PremiumContext.tsx:105-114`): `isPremium = isPremium || isAdmin`. SubscriptionScreen에서 `isAdmin && !user.subscriptionStartedAt`이면 "관리자 무제한 플랜" 카드 전용 렌더링.
3. **Sandbox 감지** (`subscription.service.ts:185-201`): `planType === 'yearly' && (expiresAt - purchasedAt) < 7d`이면 `isSandbox: true` 필드 저장 + warning log. 값 override는 하지 말 것.
4. **프로덕션 검증**: 실결제 테스트는 Alpha → Production 단계 출시 후 확인.

### Regression guard
`SubscriptionScreen` 스냅샷 테스트: `startedAt=T, expiresAt=T+30min, planType='yearly'`일 때 렌더링된 두 시간이 **동일하지 않아야** 함 (=`toLocaleString` 사용 강제).

---

## #3 — 미인증 계정 중복가입 차단 + 로그인 오해 (CRITICAL UX/보안)

### Current behavior (broken)
```
POST /auth/register
  → findByEmail() = null
  → users.create({isEmailVerified: false})
  → generateTokens() + 200 OK        ← ❌ JWT 발급하여 "가입 완료" 착시
  → 사용자 앱 닫음

POST /auth/register (재시도)
  → findByEmail() = existing
  → throw BadRequest('registration.failed')   ← ❌ 재가입 경로 없음

POST /auth/login
  → password OK
  → isEmailVerified === false
  → return {tokens, requiresEmailVerification: true}   ← ❌ full access token 발급
```

### Desired behavior
```
UNVERIFIED state:
  ├─ 동일 이메일 register → 기존 row 재사용, 새 code 재발급, **토큰 미발급**
  ├─ login 시도       → 409 PENDING_VERIFICATION + 단일-목적 resumeToken
  └─ 24h TTL 경과     → cron cleanup → DELETE row (재가입 자유)

VERIFIED state:
  └─ 정상 login
```

### Evidence
- `backend/src/auth/auth.service.ts:59-62` — register가 `existingUser` 존재만 확인, verified 여부 무시
- `backend/src/auth/auth.service.ts:82-95` — register가 JWT 발급 (**근본 원인**)
- `backend/src/auth/auth.service.ts:156-172` — login이 미인증에게도 JWT 발급
- `backend/src/users/users.service.ts:287` — 토큰 10분 만료, row TTL 없음
- `@Cron` unverified cleanup 부재 (grep 0건)
- `users.service.ts:284-302` — `generateEmailVerificationCode(userId)` 경로 존재하나 register가 차단하므로 재사용 불가

### Fix direction

1. **register 재진입 허용**: `existingUser && !isEmailVerified && (expiry < now || password mismatch)` 시 기존 row에 비밀번호 bcrypt 재해시 + name 갱신 + `generateEmailVerificationCode(user.id)` + **JWT 미발급**. verified일 때만 409.
2. **register는 JWT 반환 금지**: `auth.service.ts:82-95` tokens 제거, `{pendingVerification: true, email}`만. Frontend는 verification 후 별도 login 호출.
3. **login unverified 응답**: 401 `PENDING_VERIFICATION` + `resumeToken` (verify-email-code 전용, short-lived). full access/refresh 금지.
4. **Cleanup cron**: `@Cron('0 * * * *')`, `isEmailVerified=false AND createdAt < now-24h` DELETE.
5. **상태 enum (선택)**: `authStatus: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED'`.
6. **Frontend 분기**: register 응답에 토큰 없음 → RootNavigator가 `EmailVerificationCodeScreen`(resumeToken 보유)으로 진입. 재오픈 시 이메일 입력받아 "인증 계속하기 / 새로 가입" 선택.

### Benchmark
- **Slack**: User row는 code 확인 전까지 **생성 안 함** (pending record 별도 테이블)
- **Linear**: magic link only, verification 성공 시에만 user row INSERT
- **Notion**: row 생성하되 `status=pending`, 재입력 시 "We sent a new code" 토스트 + 기존 row 재사용, 24h 후 GC

**공통 원칙**: verification 완료 전 액세스 토큰 미발급 + 재시도 = resume 경로

### Evidence files
- `backend/src/auth/auth.service.ts` (54-96 register, 101-212 login)
- `backend/src/users/users.service.ts` (284-370)
- `backend/src/users/entities/user.entity.ts` (68-81)
- `backend/src/auth/guards/email-verified.guard.ts`

---

## Cross-cutting observations

1. **#1과 #3은 연결됨**: 웹 SPA가 존재하는 한 auth state machine을 아무리 고쳐도 웹에서 우회 가능. #1을 먼저 잡아야 #3의 fix가 의미를 가짐.
2. **#7은 버그가 아니라 샌드박스 특성**: 프로덕션 출시 전 실결제 테스트에서 재확인 필요. 지금은 표시 개선 + 관리자 분기만 처리.
3. **changePassword가 refresh token 무효화 안 하는 것**은 #1과 별도의 보안 이슈 — 동일 수정에서 같이 처리할 가치 있음.
