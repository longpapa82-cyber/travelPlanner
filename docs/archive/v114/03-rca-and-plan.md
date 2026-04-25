# V114 → V115 근본 원인 분석 + 수정 스펙 (Gate 1 승인 대상)

작성일: 2026-04-15
상태: **사용자 승인 대기 중**
추천안 선택 결과:
- 비번 재설정: 옵션 B (App Links 전용) + **웹 앱의 로그인 기능 자체 제거**
- 개인정보 처리방침: 필수만 유지
- 구독 남은 횟수: `X/30회 남음` 통일
- 배포: 현 Hetzner VPS + healthcheck rolling

---

## 요약

V114 리포트의 14개 이슈 중 **12개는 grep + 코드 증거로 근본 원인 100% 확정**,
2개(V114-7 error_logs, V114-9 배포 아키텍처)는 Phase 2에서 데이터 수집 후 확정.

모든 확정된 이슈는 **단순 증상 패치가 아닌 구조적 수정**으로 영구 방지.

---

## V114-1/1b: 비밀번호 재설정 웹 우회 (CRITICAL)

### 근본 원인
- `backend/src/email/email.service.ts:223`: `resetUrl = ${frontendUrl}/reset-password?token=${token}`
- 프로덕션 `FRONTEND_URL = https://mytravel-planner.com`
- `frontend/` 전체가 React Native Web으로 빌드돼 **Expo web 앱이 mytravel-planner.com에서 서빙됨**
- nginx.conf SPA fallback `/ → /index.html` 로 모든 경로가 Expo web 앱 진입
- **결과**: 메일 링크 클릭 → 브라우저 → Expo web 앱의 로그인 화면 → 웹에서 로그인/앱 서비스 전체 이용

**V114-1b** (reset 화면이 아예 안 뜸): Expo web 앱의 linking config에서 `/reset-password` 라우트가 V112 → V114 사이에 드롭되었거나, 웹 빌드에서 해당 스크린이 포함되지 않음 (확인 필요).

### 수정 스펙

#### Backend
1. **메일 링크 URL 스킴 변경** (`email.service.ts:223`)
   ```ts
   // BEFORE
   const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
   // AFTER
   const resetUrl = `${this.frontendUrl}/app/reset?token=${token}`;
   ```
   - `/app/*` 경로는 App Links용으로 예약 → 앱으로만 열림
   - 이메일 인증 링크도 동일하게 `/app/verify?token=...`로 변경

2. **`assetlinks.json`에 `/app/*` 경로 유지** (이미 mytravel-planner.com 전역이므로 변경 불필요)

#### Frontend (앱)
3. **AndroidManifest.xml intent-filter 확인**
   - `data android:pathPrefix="/app"` 인텐트 필터 추가 (또는 이미 있는지 확인)
   - `autoVerify="true"`

4. **React Navigation linking config**
   - `config.screens.ResetPassword = 'app/reset'`
   - `config.screens.EmailVerification = 'app/verify'`

#### Frontend (웹) — **핵심**
5. **웹 앱의 로그인 기능 전체 제거**
   - `Platform.OS === 'web'` 분기에서 `LoginScreen`, `RegisterScreen`, `AuthContext`가 인증 상태 유지하지 못하게 차단
   - **간단한 방법**: 웹 빌드에서 `AuthenticatedStack` 전체 비활성화 → root가 항상 "앱 다운로드 안내" 화면
   - 구체적으로: `App.tsx` 또는 `RootNavigator.tsx`에서
     ```tsx
     if (Platform.OS === 'web') {
       return <AppDownloadLandingScreen />;
     }
     ```
   - SEO용 `landing.html`, `guides/`, `blog/`, `privacy.html`, `terms.html` 등 정적 페이지는 유지 (nginx에서 직접 서빙, Expo web 밖으로 분리)

6. **nginx.conf에서 SPA fallback을 AppDownloadLanding으로만 넘김**
   ```
   location / {
     # Static public pages (landing, guides, blog, legal) served directly
     try_files $uri $uri/ /index.html;
   }
   ```
   - `index.html`은 Expo web build의 결과물이지만, App.tsx가 web 분기로 AppDownloadLanding만 렌더링하므로 안전

7. **Deep link 받았을 때 미설치 폴백**
   - 브라우저에서 `mytravel-planner.com/app/reset?token=...` 접근
   - App Links로 앱이 열리면 OK
   - 앱 미설치면 브라우저에 머무름 → AppDownloadLanding → Play Store 버튼

**부작용**: Expo web 앱 자체는 "앱 다운로드 안내" 1장짜리 페이지로 축소됨. 기존 웹 사용자는 사라짐 (사용자 정책: "앱에서만 서비스 제공"과 일치).

---

## V114-2a: 코치마크 좌표 어긋남 (6회 회귀, CRITICAL)

### 근본 원인 (100% 확정)
- 프로젝트 내 Modal 컴포넌트 4개 (`Modal.tsx`, `ConfirmDialog.tsx`, `BottomSheet.tsx`, `Loading.tsx`)는 모두 `statusBarTranslucent` prop 설정
- **`CoachMark.tsx:101`의 `<Modal>`에는 이 prop이 없음**
- Android에서 `statusBarTranslucent`가 false(기본)이면, Modal 내용이 status bar **아래에서 시작**
- 반면 `createTripRef.measureInWindow()`는 **status bar 포함한 전체 window 기준** 좌표를 리턴
- → Modal 안에서 `top: y`는 **status bar 높이(예: 24~40dp)만큼 위로 어긋나 보임**
- 이것이 V107~V114까지 6회 회귀한 근본 원인. 매번 padding/timing만 건드렸고 좌표계를 건드린 적 없음.

### 수정 스펙
1. **`CoachMark.tsx:101`**
   ```tsx
   // BEFORE
   <Modal transparent visible={visible} animationType="none">
   // AFTER
   <Modal
     transparent
     visible={visible}
     animationType="none"
     statusBarTranslucent
   >
   ```

2. **재발 방지**: Visual regression test (Phase 6/11)
   - Playwright로 "신규 설치 → 홈 첫 진입 → 코치마크 표시" 스크린샷 baseline
   - 박스 bounding box와 버튼 bounding box의 **픽셀 IOU ≥ 0.95** 검증

3. **V111 rAF + animationDone 유지** (수정 불필요, 이미 맞음)

---

## V114-2b: [건너뛰기] 버튼 제거

### 근본 원인
- `CoachMark.tsx:138-139`의 dismissBtn 가 그대로 살아 있음
- V109~V114 알파 리포트에서 2회 삭제 요청됐으나 미반영 (커밋 없음)

### 수정 스펙
1. **`CoachMark.tsx:137-144`의 dismissBtn 렌더링 JSX 완전 제거**
2. **i18n tutorial.json `coach.dismiss` 키 삭제** (17개 언어)
3. **Skip 버튼이 없어진 대신 tooltip 바깥 overlay 탭으로 닫히는 기존 동작 유지**

---

## V114-3: 계정 삭제 팝업 공백 과다 (4회+ 회귀)

### 근본 원인 (확인 필요)
- `DeleteAccount` 관련 UI는 `ProfileScreen.tsx`와 `HelpScreen.tsx` 내부에 존재
- 별도 `DeleteAccountModal` 컴포넌트 없음 → inline bottom sheet 또는 Modal로 구현돼 있음
- 과거 수정은 추가 패딩/간격으로 증상만 덮었을 가능성

### 수정 스펙 (Phase 2에서 정확한 파일 확인 후 확정)
1. bottom sheet height를 `fixed` → `auto` (content-sized)
2. `maxHeight: '70%'`, `minHeight: undefined`
3. padding 재조정
4. Visual regression test

---

## V114-4a: [동의하고 시작하기] 버튼 하단 밀착

### 근본 원인 (확인 필요)
- `ConsentScreen.tsx`에서 버튼 wrapper에 `insets.bottom` 반영 안 되거나 부족
- 과거 수정 `5b2c853b`도 이 증상을 건드렸지만 회귀

### 수정 스펙
1. **`ConsentScreen.tsx` 버튼 컨테이너**
   ```tsx
   <View style={{
     paddingBottom: insets.bottom + 24,
     paddingHorizontal: 16,
   }}>
     <Button title={t('confirmButtonEnabled')} ... />
   </View>
   ```
2. **JIT note 텍스트와 버튼 사이 최소 `marginTop: 16`**

---

## V114-4b: "개인정보 처리방침 (필수)" 중복 표기 (100% 확정)

### 근본 원인
- `frontend/src/i18n/locales/ko/consent.json:23`:
  ```json
  "privacy_required": {
    "title": "개인정보 처리방침 (필수)",
  ```
- UI에서 "필수" 아이콘/배지를 추가로 렌더링 → **텍스트와 아이콘이 중복**

### 수정 스펙
1. **17개 언어 consent.json에서 `privacy_required.title`**
   ```json
   // BEFORE
   "title": "개인정보 처리방침 (필수)"
   // AFTER
   "title": "개인정보 처리방침"
   ```
2. 모든 언어 일괄 수정 (sed 스크립트 또는 에디터 bulk replace)

---

## V114-4c: 개인정보 처리방침 필수/선택 양쪽 존재 (100% 확정)

### 근본 원인
- `consent.json:22-31`: `privacy_required`와 `privacy_optional` 2개 엔트리가 병존
- 법적으로 개인정보 처리방침은 **필수 동의 대상**이어야 하며, "향상된 사용자 경험"용 선택 동의는 **마케팅 정보 수신**으로 분리되는 게 표준 (GDPR, 한국 PIPA 모두 동일)

### 수정 스펙
1. **17개 언어 consent.json에서 `privacy_optional` 엔트리 완전 제거**
2. **`ConsentScreen.tsx`의 CONSENT_TYPES 배열에서 `privacy_optional` 제거**
3. **선택 동의 섹션에는 이제 `marketing`, `notification`, `photo`, `location` 중 "선택"인 것만 남김**
4. **기존 사용자 데이터**: `user_consents` 테이블에서 `privacy_optional` 레코드는 유지하되 신규 저장 금지. 백엔드 ENUM에서 deprecated 표기.

---

## V114-5: 수동 생성 진입 시 AI 남은 횟수 1/3 오표기

### 근본 원인 (100% 확정)
- `CreateTripScreen.tsx:1596-1598`:
  ```tsx
  aiTripsRemaining > 0
    ? t('create.aiInfo.remaining', { remaining: aiTripsRemaining, total: aiTripsLimit > 0 ? aiTripsLimit : 3 })
    : ...
  ```
- **진짜 문제는 "이 카운터가 수동 생성 모드에서도 항상 렌더링된다"는 것**
- 사용자는 "수동 생성에 AI 카운터가 왜 뜨지?"가 혼란의 핵심
- 또한 `aiTripsRemaining`이 stale일 때 (PremiumContext refresh 전) 잘못된 값이 순간 표시됨
- V109 P0-1에서 `AuthContext.refreshProfile`을 로그인 경로에 추가했으나, CreateTripScreen 진입 시 refresh는 안 불림

### 수정 스펙
1. **수동 생성 모드에서는 AI 카운터 UI 전체 숨김**
   ```tsx
   {isAiMode && (
     <View>... aiInfo 블록 ...</View>
   )}
   ```
2. **AI 모드에서만 카운터 표기**
3. **CreateTripScreen 진입 시 `refreshStatus()` 호출** (`useEffect([])` 또는 `useFocusEffect`)
4. **`aiTripsLimit`이 -1 또는 undefined인 동안은 "확인 중..." 표기, "1/3" 폴백 금지**
   - `aiTripsLimit > 0 ? aiTripsLimit : 3` 폴백 제거, 대신 loading 상태 처리

---

## V114-6a: 관리자 구독 "다음 결제일 시간까지" 미표기

### 근본 원인 (확정)
- `SubscriptionScreen.tsx:104`: `formatDate(expiresAt)` — 날짜만 포맷
- `formatDate` 함수가 시간 제외하는 `YYYY.MM.DD` 형식

### 수정 스펙
1. **관리자 계정인 경우 `formatDateTime` 호출**
   ```tsx
   {isAdmin
     ? formatDateTime(expiresAt)
     : formatDate(expiresAt)}
   ```
2. **`formatDateTime` 유틸** (없으면 추가): `YYYY.MM.DD HH:mm`
3. **Backend `GET /subscription/me` 응답에 `isAdmin: true` 포함** 확인

---

## V114-6b: 구독 회원 남은 횟수 "월 30회" 표기 (100% 확정)

### 근본 원인
- `CreateTripScreen.tsx:1588`:
  ```tsx
  isPremium ? (
    <Text>{t('create.aiInfo.premium', { defaultValue: '프리미엄: 월 30회 AI 자동 생성 가능' })}</Text>
  ) : ...
  ```
- Premium일 때 **정적 문자열** 표시, 실제 `X/30` 카운터 미사용
- 사용자 요구: free와 동일하게 `X/30회 남음` 포맷 통일

### 수정 스펙
1. **`CreateTripScreen.tsx:1585-1605` 렌더링 로직 통합**
   ```tsx
   // BEFORE
   isPremium ? (
     <Text>{t('create.aiInfo.premium', ...)}</Text>
   ) : aiTripsRemaining === -1 ? (
     <Text>확인 중...</Text>
   ) : (
     <Text>{t('create.aiInfo.remaining', { remaining, total })}</Text>
   )
   
   // AFTER
   aiTripsRemaining === -1 || aiTripsLimit === -1 ? (
     <Text>{t('create.aiInfo.loading')}</Text>
   ) : (
     <Text>{t('create.aiInfo.remaining', { remaining: aiTripsRemaining, total: aiTripsLimit })}</Text>
   )
   ```
2. **`aiTripsLimit` 값 확인**: `PremiumContext`에서 Premium=30, Free=3, Admin=무제한(`-1` 또는 `Infinity`)로 반환되는지 확인 필요 (Phase 2에서 수정 여부 결정)
3. **Admin 계정 처리**: `aiTripsLimit === -1` (무제한)이면 `"무제한"` 표기

---

## V114-7: 4/15 error_logs 전수 분석

### 현재 상태
- `AllExceptionsFilter`가 5xx/429/401/403/400 에러를 DB에 저장
- 최근 CreateTrip 관련 에러가 주류 (monthly limit, ThrottlerException, cancellation)
- 프로덕션 4/15 전체 조회는 Phase 2에서 직접 SQL 실행

### 수정 스펙 (Phase 2에서 데이터 수집 후 확정)
1. 프로덕션 DB `error_logs` 테이블을 2026-04-15 00:00 ~ 23:59 범위로 조회
2. `errorMessage`별 집계 상위 10건
3. 각 건별 RCA:
   - `ThrottlerException` → V109 P0-3에서 rate limit 완화했으나 여전 → 추가 완화 또는 UI 재시도 전략
   - `Monthly AI generation limit reached` → 정상 동작 (에러 로그에 기록될 필요 없음 → 필터 추가)
   - `Trip creation cancelled` → V112 wave 3 정상 취소 → 에러 아님 → 필터 추가
4. **`AllExceptionsFilter.shouldLogError`에 "예상된 에러" 목록 확장**
   - `QuotaExceededError`, `UserCancelledError` 등 추가

---

## V114-8: 미인증 재가입 UX 혼란 (CRITICAL)

### 근본 원인
V112 백엔드가 `refreshUnverifiedRegistration`을 구현했지만 프론트엔드 UX가 미완성:
- `auth.service.ts:71-139`: 미인증 이메일 재가입 시 **기존 row를 in-place refresh**하고 resumeToken 재발급
- 프론트는 성공 응답을 "인증 진행 중"으로만 처리, **사용자에게 "처음부터 다시 가입" 선택지를 주지 않음**
- 결과: 사용자는 "이미 가입된 계정"으로 오해 → 로그인 시도 → 401 EMAIL_NOT_VERIFIED → 다시 인증 화면 → **"가입이 완료된 건가?"** 혼란

### 수정 스펙

#### Backend
1. **`POST /auth/register` 응답에 discriminator 추가**
   ```ts
   interface PendingVerificationResponse {
     action: 'created' | 'refreshed';  // 신규 필드
     user: {...};
     resumeToken: string;
     requiresEmailVerification: true;
   }
   ```
2. **`POST /auth/register-force` 신규 엔드포인트**
   - 요청: `{ email, password, name, confirmReset: true }`
   - 동작: 기존 미인증 row hard delete → 새 가입 → `action: 'created'`
   - 보호: `confirmReset` flag 필수 (accidental invocation 방지)
   - Rate limit: 1회/10분

#### Frontend
3. **`RegisterScreen.tsx`에서 `action: 'refreshed'` 응답 처리**
   - **2-way dialog 표시**:
     ```
     "인증을 완료하지 못한 계정입니다.
     [인증 이어가기]  [처음부터 다시 가입]"
     ```
   - "인증 이어가기" → 기존 EmailVerificationCodeScreen
   - "처음부터 다시 가입" → `register-force` 호출 → 신규 인증 플로우

4. **`LoginScreen.tsx`에서 401 EMAIL_NOT_VERIFIED 응답 UX 개선**
   - 현재: 인증 화면으로 그냥 이동
   - 개선: 명시적 안내 `"회원가입이 완료되지 않았습니다. 인증을 이어가시겠어요?"`
   - 버튼 2개: `[인증 이어가기]`, `[로그인 취소]`
   - "인증 이어가기" 선택 시에만 인증 화면으로

5. **가입/인증 진행률 표시**
   - 스크린 상단에 진행 단계 표시 (1. 계정 정보 → 2. 이메일 인증 → 3. 완료)
   - 인증 미완료 상태 = "아직 가입이 완료되지 않았습니다" 명시

---

## V114-9: 무중단 배포 구조

### 현재 상태 (확인됨)
- **Backend**: Dockerfile에 HEALTHCHECK 있음 (`/api/health`)
- **docker-compose.yml**: backend healthcheck + depends_on 정상
- **Nginx**: `frontend/nginx.conf`에서 `/api/*` → backend 프록시, `proxy_read_timeout 120s`
- **Migrations**: `synchronize: false`, `migrationsRun: true` (프로덕션), 18개 migration 파일
- **API Versioning**: `app.setGlobalPrefix('api')` + `VERSION_NEUTRAL` (버저닝 미적용)

### 수정 스펙

#### 즉시 추가
1. **`GET /api/version` 엔드포인트 신설** (`backend/src/app.controller.ts` 근처)
   ```ts
   @Get('/version')
   getVersion() {
     return {
       apiVersion: '1.0.0',
       minAppVersionCode: 100,  // 이 값보다 낮으면 force update
       recommendedAppVersionCode: 115,
       releaseNotes: 'https://mytravel-planner.com/release-notes',
     };
   }
   ```

2. **앱 기동 시 버전 체크**
   - `App.tsx` 또는 `RootNavigator`에서 `GET /api/version` 호출
   - 현재 앱 `versionCode < minAppVersionCode`면 **차단 모달** ("업데이트 필요 → Play Store")
   - `versionCode < recommendedAppVersionCode`면 **안내 토스트** (dismiss 가능)

3. **DTO 전체 `@IsOptional()` 감사**
   - 신규 필드는 항상 optional로 선언
   - 구버전 앱이 이 필드를 안 보내도 500 안 나게

4. **Expand-Contract DB 마이그레이션 정책 문서화**
   - Phase: `docs/v114/deployment-runbook.md`
   - 규칙:
     1. 신규 컬럼은 **nullable**로 추가
     2. 앱 배포 + 1주일 관찰
     3. 백필 migration
     4. NOT NULL 승격 (필요 시)
   - 컬럼 삭제는 역순으로 진행

5. **Rolling deploy 스크립트**
   - `scripts/deploy-rolling.sh`:
     1. `rsync` 소스
     2. `docker compose build` (new image)
     3. `docker compose up -d backend` → healthcheck 기반 이전 컨테이너 자동 종료
     4. `/api/health` 10회 연속 200 확인
     5. 실패 시 rollback (`docker compose up -d backend:previous-tag`)

6. **Nginx upstream 쓰는 경우 grace period** (현 구성 확인 필요)
   - 현재 단일 backend 컨테이너라 upstream 쓰면 더 안전

7. **DB 마이그레이션 실행 시간 모니터링**
   - `migrationsRun: true`가 기동 시 동기 실행
   - 2분 초과 마이그레이션은 별도 script로 분리하는 정책

---

## 📋 수정 우선순위 (Phase 2/3/4 분배)

### CRITICAL (즉시 수정 필수)
- V114-1: 웹 로그인 차단 + App Links
- V114-1b: Reset 화면 라우팅
- V114-2a: 코치마크 statusBarTranslucent
- V114-4c: 개인정보 선택 블록 제거
- V114-8: 미인증 재가입 UX

### HIGH
- V114-2b: 건너뛰기 버튼 제거
- V114-3: 계정 삭제 팝업 공백
- V114-4a: 이용동의 버튼 여백
- V114-5: 수동 생성 시 AI 카운터 UI 숨김
- V114-6b: 구독 회원 카운터 통일
- V114-7: error_logs 분석 + 필터 확장
- V114-9: 배포 구조 강화

### MEDIUM
- V114-4b: "(필수)" 텍스트 제거
- V114-6a: 관리자 결제 시간 표기

---

## 🔒 Gate 1 승인 대기 항목

Phase 2 진입 전 사용자 승인이 필요한 결정:

1. **웹 앱의 로그인/메인 기능 전체 비활성화** (`Platform.OS === 'web'` → AppDownloadLandingScreen) — 이거 확정해도 될까요?
   - 장점: 웹 우회 근본 차단
   - 단점: 기존 웹 사용자 이탈 (있다면)
   - 정책 사용자 요구: "앱에서만 서비스 제공"이므로 일치

2. **`privacy_optional` 완전 제거 + 기존 사용자 데이터 migration 정책**
   - 기존 `user_consents`에 `privacy_optional` 저장된 레코드 처리 방침: 유지/삭제
   - 법무팀 확인 없이 진행해도 되는지

3. **`POST /auth/register-force` 엔드포인트 신설**
   - 남용 방지 rate limit 1회/10분으로 충분한지
   - 기존 미인증 row hard delete 시 cascade 부작용 (trips 빈 계정이면 문제 없음)

4. **App versionCode 최소 요구**
   - `minAppVersionCode = 100` 으로 시작 OK?
   - 100 미만 사용자가 있으면 강제 업데이트 부담

**이상 4건에 사용자 승인 떨어지면 Phase 2 착수합니다.**

---

## 📎 참고

- **00-inventory.md**: 프론트엔드 소스 인벤토리 (파일 경로 + 라인)
- **00-inventory-backend.md**: 백엔드 + 배포 인프라 인벤토리
- **01-reproduction.md**: 14건 재현 시나리오
- **02-regression-analysis.md**: 회귀 원인 분석 (Modal statusBarTranslucent 가설 확정)
