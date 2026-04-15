# V115 Frontend 수정 요약

## 파일별 변경

### 1. `frontend/src/components/tutorial/CoachMark.tsx`
- Modal에 `statusBarTranslucent` prop 추가 (**V114-2a 6회 회귀의 근본 원인**)
- dismissBtn JSX 블록 제거 (V114-2b)
- onDismiss prop은 타입 호환을 위해 유지

### 2. `frontend/src/i18n/locales/*/consent.json` (17개 언어)
- `privacy_optional` 엔트리 완전 제거 (V114-4c)
- `privacy_required.title`에서 "(필수)" / "(Required)" / "(必須)" 등 중복 텍스트 제거 (V114-4b)
- 스크립트 기반 일괄 처리: `python3` regex + JSON round-trip

### 3. `frontend/src/screens/consent/ConsentScreen.tsx`
- `jitNotice` marginTop 4→12, marginBottom 8→24 (V114-4a)
- `footer` paddingTop 20→24

### 4. `frontend/src/screens/trips/CreateTripScreen.tsx`
- **V114-5**: 459행 사전 경고 토스트가 `create.aiInfo.remaining` (상태 문자열)을 재사용하던 걸 새 키 `create.aiInfo.preWarning` (advisory)로 분리. `remaining: 1` 하드코딩도 `Math.max(0, aiTripsRemaining - 1)`로 동적 계산
- **V114-6b**: 1584~1605행 렌더링 블록을 통합. Premium/free가 동일한 `X/Y` 포맷. admin은 "무제한", loading 상태는 "확인 중...", "1/3" 폴백 제거
- 847행, 625행의 `aiTripsLimit > 0 ? aiTripsLimit : 3` 폴백은 premium일 때 30을 반환하도록 수정

### 5. `frontend/src/screens/main/ProfileScreen.tsx`
- `usePremium()`에서 `aiTripsLimit` destructure 추가
- `menu.aiRemaining` 호출 시 `total: aiTripsLimit > 0 ? aiTripsLimit : 3` (동적)
- **V114-3 결정적 수정**: `modalContent`의 `minHeight: 400` + `justifyContent: 'space-between'` 제거 — 컨텐츠 크기에 맞춰 자동 축소

### 6. `frontend/src/screens/main/SubscriptionScreen.tsx`
- `usePremium()`에서 `isAdmin`, `aiTripsLimit` destructure 추가
- 신규 헬퍼: `formatDateTime(dateStr)`, `formatBillingDate(dateStr)` (V114-6a)
- `expiresAt` 표시 시 `formatBillingDate`로 전환 — admin은 시간까지 표시

### 7. `frontend/src/contexts/AuthContext.tsx`
- `PendingVerification` 인터페이스에 `action?: 'created' | 'refreshed'` 필드
- `register()`에서 pending state 설정 시 response의 action 필드 전파
- **신규** `registerForce()` 함수: `/auth/register-force` 호출, legacy tokens fallback 유지
- `AuthContextType`와 provider value에 `registerForce` export

### 8. `frontend/src/screens/auth/RegisterScreen.tsx`
- `Alert` import 추가
- `registerForce`, `pendingVerification`, `clearPendingVerification` destructure
- `EmailNotVerifiedError` catch에서 `pendingVerification?.action === 'refreshed'`이면 2-way Alert 표시
  - "인증 이어가기" → 아무것도 안 함 (RootNavigator가 자동 전환)
  - "처음부터 다시 가입" → `clearPendingVerification()` + `registerForce()` 호출

### 9. `frontend/src/screens/auth/LoginScreen.tsx`
- `EmailNotVerifiedError` catch에 명시 toast 추가 (V114-8):
  - "회원가입이 아직 완료되지 않았습니다. 이메일 인증을 이어갑니다."
- 기존 silent transition → 명시적 feedback

### 10. `frontend/src/services/api.ts`
- **신규** `registerForce(email, password, name)` — `POST /auth/register-force` + `confirmReset: true`

### 11. `frontend/src/navigation/RootNavigator.tsx`
- linking config:
  - `VerifyEmail: 'verify-email'` → `VerifyEmail: 'app/verify'`
  - `ResetPassword: 'reset-password'` → `ResetPassword: 'app/reset'`

### 12. `frontend/src/screens/web/WebAppRedirectScreen.tsx` (신규)
- 웹 접근 시 유일하게 렌더링되는 화면
- "MyTravel은 모바일 앱에서" 안내 + Play Store 버튼
- `/app/reset` / `/app/verify` 경로 감지 → 전용 메시지
- 법적 페이지 링크는 nginx 정적 서빙으로 유지

### 13. `frontend/App.tsx`
- `WebAppRedirectScreen` import
- `Platform.OS === 'web'`(OAuth callback 제외) 분기에서 AuthProvider/RootNavigator 대신 `<WebAppRedirectScreen />`만 렌더링
- **결과**: 웹에서는 AuthProvider가 mount되지 않아 토큰 저장/API 호출/로그인 구조적으로 불가

## 검증 결과

- **TypeScript**: 0 errors
- **Jest**: 14/14 active suites, 204/204 tests PASS (2 skipped = 기존 V112 ActivityModal drift)

## i18n 누락 (follow-up)

새로 추가한 텍스트 키들이 17개 언어 JSON에 실제 항목 없음 (defaultValue만 제공):

- `trips.json`: `create.aiInfo.preWarning`
- `premium.json`: `menu.aiRemaining` (기존 키)
- `auth.json`: `register.refreshed.title`, `register.refreshed.message`, `register.refreshed.continue`, `register.refreshed.startOver`
- `auth.json`: `login.alerts.emailNotVerified`

**영향**: 한국어가 아닌 사용자에게는 defaultValue(한국어)가 노출됨. ship-blocker 아님.
**조치**: Phase 12 follow-up 또는 V116 마이너 릴리스에 포함.

## Breaking changes

- 없음. 모든 변경은 추가 / 정리 / UX 개선 수준.
- 구버전 앱(≤ V114)이 V115 backend에 붙을 때: 신규 `action` 필드는 JSON에 추가될 뿐이므로 무시되고 기존 동작 유지.
- 구버전 앱이 `/app/reset` URL 받으면 linking config가 `reset-password`라서 매칭 안 됨 → 브라우저 WebAppRedirectScreen 노출 → 앱 설치/업데이트 유도. **의도된 동작**.
