# V115 Code Review — Gate 10 판정

**리뷰 범위**: Backend 1~7 + Frontend 8~20 파일 (unstaged diff 기준)
**리뷰어**: code-reviewer (claude-sonnet-4-6)
**날짜**: 2026-04-15

---

## CRITICAL

### [CRITICAL-1] `pendingVerification.action` React 상태 타이밍 경쟁 — `refreshed` 다이얼로그가 절대 표시되지 않음

**파일**: `frontend/src/contexts/AuthContext.tsx:367–374`, `frontend/src/screens/auth/RegisterScreen.tsx:125`

**문제**: `register()` 함수는 `setPendingVerification({ ..., action: (response as any).action })` 를 호출한 직후 `throw new EmailNotVerifiedError(...)` 를 던진다. React 상태 업데이트는 비동기 스케줄링이므로 `RegisterScreen` 의 `catch` 블록이 실행되는 시점에 `pendingVerification` context 값은 아직 업데이트되지 않은 이전 값이다.

```ts
// AuthContext.tsx (현재)
setPendingVerification({ ..., action: (response as any).action }); // 스케줄 enqueue
throw new EmailNotVerifiedError(...);                              // 동기 실행

// RegisterScreen.tsx (현재)
} catch (error: any) {
  if (error instanceof EmailNotVerifiedError) {
    const action = pendingVerification?.action; // ← 항상 undefined / null
    if (action === 'refreshed') { ... }         // ← 절대 진입하지 못함
```

**결과**: V115 의 핵심 기능인 "continue vs start over" 다이얼로그가 `refreshed` 케이스에서 절대 표시되지 않는다. `registerForce` 전체 코드 경로가 데드코드가 된다.

**수정 방향**: `register()` 반환값(또는 throw에 실어 보내는 데이터)에 `action`을 함께 담아 `catch` 블록에서 context 상태에 의존하지 않고 읽도록 한다. 예: `EmailNotVerifiedError` 생성자에 `action` 필드를 추가하거나, `register()` 의 반환 타입에 포함시킨다.

---

### [CRITICAL-2] `confirmReset` 필드가 `ValidationPipe whitelist: true, forbidNonWhitelisted: true` 에 의해 거부됨

**파일**: `backend/src/auth/auth.controller.ts:59`, `backend/src/main.ts:153–154`

**문제**: 전역 `ValidationPipe` 가 `whitelist: true, forbidNonWhitelisted: true` 로 설정돼 있다. `@Body() body: RegisterDto & { confirmReset?: boolean }` 에서 `confirmReset` 은 `class-validator` 데코레이터가 없는 인라인 타입 확장이다. NestJS ValidationPipe 는 타입 정보를 알 수 없으므로 `RegisterDto` 의 화이트리스트에 없는 `confirmReset` 필드를 400 으로 거부한다.

```
POST /auth/register-force { email, password, name, confirmReset: true }
→ 400 Bad Request: "property confirmReset should not exist"
```

**결과**: `/auth/register-force` 엔드포인트는 항상 400 을 반환한다. `registerForce` 플로우가 서버 레벨에서 완전히 차단된다.

**수정 방향**: `confirmReset` 에 `@IsBoolean() @IsOptional()` 데코레이터를 추가한 `RegisterForceDto` 를 별도로 정의하거나, `RegisterDto` 를 상속해 `confirmReset` 필드를 포함하는 전용 DTO 클래스를 만든다.

---

## HIGH

### [HIGH-1] `IGNORED_PATTERNS` 의 `'abortError'` 패턴이 항상 미매칭

**파일**: `backend/src/admin/admin.controller.ts:264, 269`

**문제**: `isExpectedFlowError` 메서드는 `message.toLowerCase()` 로 변환한 후 패턴 배열과 비교한다. 패턴 `'abortError'` 는 camelCase 를 유지한 채 배열에 있으므로, `m.includes('abortError')` 는 소문자화된 문자열에서 절대 일치하지 않는다.

```ts
const m = 'AbortError occurred'.toLowerCase(); // 'aborterror occurred'
m.includes('abortError')  // false — E가 대문자
m.includes('aborterror')  // true  — 이게 올바름
```

**결과**: `AbortError`/`AbortError` 클라이언트 에러가 필터링되지 않고 `error_logs` 테이블에 계속 쌓여 대시보드 노이즈가 된다. 의도한 동작과 반대.

---

### [HIGH-2] `registerForce` 및 `hardDeleteUnverifiedUser` 에 테스트 없음

**파일**: `backend/src/auth/auth.service.ts:148–186`, `backend/src/users/users.service.ts:133–148`

**문제**: V115 에서 추가된 두 함수(`registerForce`, `hardDeleteUnverifiedUser`)에 대한 서비스·컨트롤러 단위 테스트가 없다. `auth.controller.spec.ts`, `auth.service.spec.ts` 양쪽 모두 `registerForce`를 검색해도 결과 없음.

**위험도**: `hardDeleteUnverifiedUser` 는 DB 행을 영구 삭제하는 파괴적 연산이다. 가드 조건(provider !== EMAIL, isEmailVerified === true)이 실제로 거부하는지 테스트되지 않으면 실수로 삭제 경로에 도달하는 회귀를 조기에 잡지 못한다.

---

### [HIGH-3] `PendingVerification.action` 이 optional 이지만 `register()` 는 항상 `action` 을 채움

**파일**: `frontend/src/contexts/AuthContext.tsx:67`, `backend/src/auth/auth.service.ts:134`

**문제**: 인터페이스 레벨의 일관성 문제. 백엔드 `PendingVerificationResponse.action` 은 required(`action: 'created' | 'refreshed'`)이고, 프론트엔드 `PendingVerification.action` 은 optional(`action?: 'created' | 'refreshed'`). 두 개의 정의가 분기를 만들며 프론트엔드에서 옵셔널 체이닝이 필요해진다.

`(response as any).action` 이라는 `any` 타입 단언도 여기서 기인한다. `api.ts` 의 반환 타입에 `action: 'created' | 'refreshed'` 를 추가하면 타입 단언 없이 안전하게 읽을 수 있다.

---

### [HIGH-4] `isLoading` 이 Alert 다이얼로그 표시 중 즉시 `false` 로 리셋됨

**파일**: `frontend/src/screens/auth/RegisterScreen.tsx:165–169`

**문제**: `refreshed` 분기에서 `Alert.alert(...)` 를 호출하고 `return` 하면 outer `finally { setIsLoading(false) }` 가 즉시 실행된다. 다이얼로그가 열려 있는 동안 폼이 다시 활성화되어 사용자가 Alert 를 닫지 않은 상태에서 다시 Submit 할 수 있다.

**결과**: 사용자가 다이얼로그가 열린 상태에서 폼을 다시 제출하면 `register()` 가 다시 호출되고 두 번째 Alert 가 쌓인다.

---

## MEDIUM

### [MEDIUM-1] i18n 키 3세트 누락 — 17개 언어 모두

**파일**: `frontend/src/i18n/locales/*/auth.json`, `frontend/src/i18n/locales/*/trips.json`

아래 3세트 키가 `defaultValue` fallback 에만 의존하며 17개 언어 파일에 실제 키가 없다.

| 키 | 파일 | 영향 언어 수 |
|---|---|---|
| `register.refreshed.title/message/continue/startOver` (4개) | `auth.json` | 17 |
| `login.alerts.emailNotVerified` | `auth.json` | 17 |
| `create.aiInfo.preWarning` | `trips.json` | 17 |

현재는 한국어 `defaultValue` 가 모든 언어에서 그대로 노출된다. 번역이 완료되기 전까지는 영어 `defaultValue` 라도 제공하는 게 낫다.

---

### [MEDIUM-2] `DEPRECATED_CONSENTS` 위치 — `CONSENT_VERSIONS` 와 분리됨

**파일**: `backend/src/users/users.service.ts:817, 841`

`CONSENT_VERSIONS` (line 817) 와 `REQUIRED_CONSENTS` (line 828) 가 나란히 있는데 `DEPRECATED_CONSENTS` (line 841) 는 Javadoc 주석으로 시작하는 별도 블록으로 세 번째에 위치한다. 이 세 상수는 동일한 `ConsentType` 분류 체계를 다루므로 인접하게 배치하는 편이 파악하기 쉽다. 기능에는 영향 없음.

---

### [MEDIUM-3] `CONSENT_VERSIONS` 에 아직 `PRIVACY_OPTIONAL` 항목이 남아 있음

**파일**: `backend/src/users/users.service.ts:820`

```ts
private readonly CONSENT_VERSIONS: Record<ConsentType, string> = {
  [ConsentType.PRIVACY_OPTIONAL]: '1.0.0',   // deprecated 됐지만 여전히 존재
```

`DEPRECATED_CONSENTS` 에 `PRIVACY_OPTIONAL` 이 추가됐지만 `CONSENT_VERSIONS` 는 그대로다. `updateConsents` 에서 skip 처리하기 때문에 런타임 오류는 없지만, `Record<ConsentType, string>` 타입 완전성 때문에 제거하지 못하는 구조적 제약임을 주석으로 명시하거나, `Partial<Record<...>>` 로 바꿔 타입 정확성을 높이는 것이 낫다.

---

### [MEDIUM-4] `formatBillingDate` / `formatDateTime` 네이밍 역할 혼재

**파일**: `frontend/src/screens/main/SubscriptionScreen.tsx:58–72`

`formatDateTime` 은 날짜+시간을 포맷하는 범용 내부 헬퍼다. `formatBillingDate` 는 admin 여부에 따라 `formatDate` 와 `formatDateTime` 중 하나를 선택한다. 두 함수 이름이 각자의 역할을 잘 표현하지만, `formatBillingDate` 가 조건부 위임자임을 이름만으로 알기 어렵다. `billingDateDisplay` 또는 `formatBillingDateForUser` 처럼 포맷-선택 의도를 이름에 드러내면 가독성이 향상된다. (블로커 아님)

---

### [MEDIUM-5] `WebAppRedirectScreen` App Store URL 가 placeholder

**파일**: `frontend/src/screens/web/WebAppRedirectScreen.tsx:25`

```ts
const APP_STORE_URL = 'https://apps.apple.com/app/mytravel/id0000000000'; // placeholder
```

현재는 iOS 사용자가 없으므로 `Platform.OS === 'ios'` 분기는 web 렌더링에서 도달 불가다. 그러나 이 URL 이 소스에 남아 있으면 iOS 출시 이전에 누군가 이를 재사용할 경우 무효 URL 로 연결된다. 상수 이름을 `APP_STORE_URL_TODO` 로 바꾸거나 주석에 "iOS 미출시 — id 교체 필수" 를 명시하는 것이 낫다.

---

## LOW

### [LOW-1] `register`/`registerForce` 의 하위 `try/catch` 가 rethrow 전용 — 제거 가능

**파일**: `frontend/src/contexts/AuthContext.tsx:355–395, 404–440`

두 함수 모두 아래 패턴을 가진다.

```ts
const registerForce = async (...) => {
  try { ... }
  catch (error) { throw error; }  // 완전한 passthrough
};
```

rethrow 만 하는 `try/catch` 는 실질적으로 없는 것과 동일하며 가독성을 해친다. 제거해도 동작이 동일하다.

---

### [LOW-2] `registerForce` 컨트롤러 body 타입 — 인라인 확장보다 전용 DTO 가 낫다

**파일**: `backend/src/auth/auth.controller.ts:59`

```ts
@Body() body: RegisterDto & { confirmReset?: boolean }
```

인라인 타입 교차로 `confirmReset` 을 추가했지만, `class-validator` 가 작동하려면 실제 클래스가 필요하다 (CRITICAL-2 와 연결). 수정 과정에서 `RegisterForceDto extends RegisterDto` 로 만들면 이 LOW 이슈도 함께 해결된다.

---

### [LOW-3] 레거시 URL 경로(`/verify-email`, `/reset-password`) 에 대한 App Links 처리 누락

**파일**: `frontend/src/navigation/RootNavigator.tsx:40–44`, `frontend/src/screens/web/WebAppRedirectScreen.tsx:31–36`

RootNavigator 는 `VerifyEmail`을 `'app/verify'` 로만 매핑한다. `WebAppRedirectScreen.isResetOrVerifyPath()` 는 레거시 `/verify-email` 패스도 감지하지만(fallback UI 노출), RootNavigator 는 이를 `VerifyEmail` 스크린으로 라우팅하지 않는다. 결과적으로 레거시 이메일 링크를 앱에서 열면 Home 스크린으로 떨어진다.

주석에 "old URLs simply 404" 라고 명시돼 있어 의도된 결정처럼 보이나, `WebAppRedirectScreen` 에서 이미 레거시 경로를 감지·안내하는 코드가 있으므로 앱 내 RootNavigator 에서도 동일하게 legacy fallback 을 추가하면 일관성이 높아진다.

---

### [LOW-4] `CoachMark` 스킵 버튼 제거 후 `onDismiss` prop 사용처 점검 권장

**파일**: `frontend/src/components/tutorial/CoachMark.tsx:154`

`onDismiss` prop 이 더 이상 UI 에 노출되지 않는다. prop 은 유지됐으나 호출 경로가 외부 dismiss 뿐임을 주석으로 설명했다. `onDismiss` 를 전달하는 모든 부모 컴포넌트가 실제로 외부 dismiss 경로를 가지고 있는지 확인이 필요하다(블로커 아님, 발견 목적).

---

## 코멘트 정확성 (comment-accuracy)

- V115 주석 포맷 `V115 (V114-X fix)` 가 7개 파일에서 일관되게 사용됨. 형식 일관성 양호.
- `hardDeleteUnverifiedUser` 의 JSDoc "Cascade: trips/consents/subscriptions are ON DELETE CASCADE, but an unverified row should have none of these attached in practice" — "in practice" 라는 표현이 강한 단정을 피하고 있어 정직하다. 좋은 표현.
- `WebAppRedirectScreen` 주석 "nginx는 SEO 정적 페이지를 index.html 이전에 매칭" — 사실 확인 필요. nginx 설정이 실제로 그렇게 돼 있는지 배포 런북과 교차 검증 권장.
- `app.controller.ts` `getVersion()` 주석 "Values are intentionally hardcoded here (not env-driven) so a redeploy is the only way to raise the floor" — 명확하고 정확한 설계 의도 기술. 유지 가치 있음.
- 사라질 주석(레거시 경위 설명)은 대부분 Javadoc 블록 안에 있어 코드 노이즈가 낮다. 개별 제거를 강요할 수준은 아님.

---

## 접근성

| 항목 | 상태 |
|---|---|
| `WebAppRedirectScreen` Play Store 버튼 `accessibilityLabel` 없음 | LOW |
| `ConsentScreen` 필수 뱃지(`<View>` + `<Text>필수</Text>`) 에 `accessibilityLabel` 없음. Screen reader 는 뱃지를 별도 탭 대상으로 읽음 | LOW |
| 두 항목 모두 기능 블로커 아님. Play Store 출시 전 accessibilityLabel 추가 권장. |

---

## 배포 호환성

- `/api/version` 신규 엔드포인트: 구버전 앱은 호출하지 않으므로 breaking change 없음. OK.
- App Links 경로 변경(`/verify-email` → `/app/verify`): 배포 시 인박스에 남아 있는 이전 이메일 링크가 동작하지 않을 수 있음. `WebAppRedirectScreen` 이 웹에서는 안내 페이지를 표시하므로 완전 무응답은 아니지만, 앱 내에서 레거시 링크 처리 누락(LOW-3 참조).
- `DEPRECATED_CONSENTS` 처리: 구버전 앱이 `PRIVACY_OPTIONAL` 를 전송해도 서버에서 silently ignore 하므로 backwards-compatible. OK.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2     | block  |
| HIGH     | 4     | warn   |
| MEDIUM   | 5     | info   |
| LOW      | 4     | note   |

**Gate 10 Verdict: BLOCK — CRITICAL 2건 해소 전 배포 불가**

### 머스트 픽스 (배포 전 필수)

1. **CRITICAL-1** `pendingVerification.action` React 타이밍 버그 — `EmailNotVerifiedError` 에 `action` 탑재 또는 `register()` 반환값으로 전달
2. **CRITICAL-2** `confirmReset` ValidationPipe whitelist 거부 — `RegisterForceDto` (별도 클래스) 로 교체

### 슈드 픽스 (배포 전 강력 권장)

- **HIGH-1** `'abortError'` → `'aborterror'` 오타 수정 (1줄)
- **HIGH-2** `registerForce`/`hardDeleteUnverifiedUser` 단위 테스트 추가
- **HIGH-3** `api.ts` 반환 타입에 `action` 추가, `(response as any)` 단언 제거
- **HIGH-4** `isLoading` Alert 중 즉시 false 리셋 UX 버그

### 컨시더 픽스 (선택)

- **MEDIUM-1** i18n 17개 언어 키 추가 (영어 defaultValue 라도)
- **MEDIUM-5** App Store URL placeholder 명시
