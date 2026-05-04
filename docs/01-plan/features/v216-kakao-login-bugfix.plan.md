---
template: plan
version: 1.2
description: V215 프로덕션 버그 수정 계획 — 카카오 로그인 실패, 오류 로그 누락, Google Play 권장 조치
---

# V216 Kakao Login & Error Logging Bugfix Planning Document

> **Summary**: V215 프로덕션에서 발견된 카카오 로그인 앱 전환 실패, 오류 로그 누락, Google Play 권장 조치 2건 대응
>
> **Project**: travelPlanner (myTravel)
> **Version**: V216 (versionCode 216)
> **Author**: hoonjaepark
> **Date**: 2026-05-02
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

V215 프로덕션 출시 후 확인된 3건의 버그를 수정하여 카카오 로그인 정상화, 오류 진단 가시성 확보, Google Play 정책 준수를 달성한다.

### 1.2 Background

V215(versionCode 215)가 2026-04-30 프로덕션 전체 출시 완료된 이후, 실사용 테스트에서 다음이 발견되었다.

- **Bug 1**: [카카오톡으로 로그인] 버튼 클릭 시 카톡 앱 전환 후 복귀하면 로그인 실패. 카톡 ID/PW 입력 방식만 작동. 또한 카카오 인가 세션이 남아있어 계정 전환 불가.
- **Bug 2**: 카카오 로그인 오류 발생 시 관리자 오류 로그 대시보드에 수집되지 않음.
- **Bug 3**: Google Play 프로덕션 콘솔 권장 조치 2건 — 구체적 내용은 스크린샷 확인 후 대응.

**핵심 제약**: V215 프로덕션이 운영 중이므로, 모든 수정은 로컬 서버 → Alpha 비공개 테스트 → 운영 서버 배포 → 프로덕션 승급 순서로 진행한다. 프로덕션에 직접 영향을 주는 작업은 허용하지 않는다.

### 1.3 Related Documents

- RCA 아카이브: `docs/archive/version-rcas/v174-v210-rca.md`
- CLAUDE.md 핵심 불변식: 특히 Invariant #16 (결제 차단 메시지), #28 (에러 메시지 i18n), #31 (진단 인프라 자기 보호)
- 기존 alpha 테스트 결과: `testResult.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] Bug 1-A: 카카오 앱 전환 후 콜백 URL 수신 실패 수정 (Android Custom Tab → 딥링크 방식 전환)
- [ ] Bug 1-B: 카카오 인가 세션 캐시로 인한 계정 전환 불가 수정 (prompt=login 파라미터 추가)
- [ ] Bug 2 (P0): `AuthContext.loginWithKakao()` catch에 `reportError()` 추가
- [ ] Bug 2 확장 (P0): `AuthContext.loginWithGoogle()` — native/web 양쪽 catch에 `reportError()` 추가
- [ ] Bug 2 확장 (P0): `AuthContext.loginWithApple()` catch에 `reportError()` 추가
- [ ] Bug 2 확장 (P1): `ProfileScreen.handleDeleteAccount()` / `handleConfirmDelete()` catch에 `reportError()` 추가
- [ ] Bug 2 확장 (P1): `ProfileScreen.handlePickProfilePhoto()` / `handleConfirmProfilePhoto()` catch에 `reportError()` 추가
- [ ] Bug 3: Google Play 권장 조치 내용 확인 및 해당 조치 이행
- [ ] 17개 언어 i18n: 카카오 로그인 취소/실패 에러 메시지 i18n 키 추가 (현재 KAKAO_SIGNIN_CANCELLED 키 부재)
- [ ] 로컬 → Alpha → 프로덕션 단계별 검증

### 2.2 Out of Scope

- 카카오 로그인 전면 아키텍처 교체 (WebBrowser → native SDK 방식 전환 등)
- iOS 카카오 로그인 대응 (현재 Android 전용)
- 기타 V215 신규 기능 개발

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| FR-01 | [카카오톡으로 로그인] 버튼이 카톡 앱 전환 후 복귀 시 정상 로그인 완료되어야 한다 | Must | Pending |
| FR-02 | 카카오 인가 세션이 남아있어도 [카카오톡으로 로그인] 재클릭 시 계정 선택 화면이 노출되어야 한다 | Must | Pending |
| FR-03 | 소셜 로그인(Kakao/Google/Apple) 오류 발생 시 관리자 오류 로그에 수집되어야 한다 | Must | Pending |
| FR-04 | Google Play 권장 조치 2건이 이행되어야 한다 | Must | Pending (내용 확인 후) |
| FR-05 | 카카오 로그인 취소/실패 에러 메시지가 i18n 처리되어야 한다 | Should | Pending |
| FR-06 | 회원탈퇴(OAuth/이메일 모두) 실패 시 관리자 오류 로그에 수집되어야 한다 | Should | Pending |
| FR-07 | 프로필 사진 업로드 실패 시 관리자 오류 로그에 수집되어야 한다 | Should | Pending |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 측정 방법 |
|----------|------|-----------|
| 안정성 | 기존 Google/Apple 로그인 정상 동작 유지 | Alpha 회귀 테스트 |
| 오류 진단 | 카카오 로그인 실패 시 오류 로그 DB 기록 | 관리자 대시보드 확인 |
| 보안 | CSRF state 파라미터 검증 유지 | 코드 리뷰 |
| 불변식 준수 | CLAUDE.md Invariant #28, #31, #32 위반 없음 | 코드 리뷰 |
| 빌드 | TypeScript 0 errors, Jest 전체 PASS | `npm run validate:static` |

---

## 4. Root Cause Analysis

### 4.1 Bug 1 — 카카오 로그인 앱 전환 실패

**현상**: [카카오톡으로 로그인] 클릭 → 카톡 앱 전환 → myTravel 복귀 → "소셜 로그인에 실패했다"

**근본 원인**:

`oauth.service.ts`의 `WebBrowser.openAuthSessionAsync()`는 Android Custom Chrome Tab 기반으로 동작한다. 카카오 OAuth는 웹뷰 내 인증이 아니라 **카카오톡 native app으로 앱 전환(Intent)** 후 콜백 딥링크로 복귀하는 방식을 사용한다.

Android에서 Custom Tab이 다른 앱(카카오톡)으로 포커스를 잃으면, Expo의 `WebBrowser.openAuthSessionAsync`는 `result.type = 'dismiss'`를 반환한다. 현재 코드는 `result.type === 'success'`만 처리하므로 콜백 URL을 읽지 못하고 `null`을 반환한다.

```
[카카오 OAuth 흐름]
Custom Tab 열림
  → Kakao 인가 페이지 (https://kauth.kakao.com/oauth/authorize)
  → "카카오톡으로 로그인" 선택
  → Android Intent: 카카오톡 앱으로 전환 (Custom Tab 포커스 소실)
  → 카카오톡에서 인가 후 travelplanner:///auth/callback?code=XXX 딥링크 발사
  → Custom Tab이 dismiss된 상태이므로 openAuthSessionAsync는 'dismiss' 반환
  → 콜백 URL 수신 실패
```

**해결 방안**: Android에서 카카오 OAuth 결과를 `Linking.addEventListener('url', ...)` 또는 `Linking.getInitialURL()`로 별도 수신하거나, `openAuthSessionAsync` 결과가 `dismiss`일 때 Linking 이벤트에서 콜백 URL을 검사하도록 수정한다.

구체적으로는 `signInWithOAuth` 함수 내부에서 Android에 한해 `Linking.addEventListener`로 딥링크를 병렬로 감시하고, `openAuthSessionAsync`가 `dismiss`를 반환하더라도 딥링크로 수신된 URL을 사용해 `parseOAuthCallback`을 호출한다. 타임아웃(30초)을 두어 딥링크가 수신되지 않으면 `null` 반환.

**Bug 1-B — 계정 전환 불가**:

카카오 OAuth URL에 `prompt=login` 파라미터가 없어, 카카오 서버에 인가된 세션이 남아있으면 자동 로그인된다. `authUrl` 생성 시 카카오 provider에 한해 `prompt=login`을 추가한다.

백엔드의 `KakaoStrategy`는 `passport-oauth2`의 `authorizationURL`을 그대로 사용하는데, `prompt=login`은 카카오 OAuth의 query parameter이므로 frontend의 `authUrl` 구성 단계에서 추가하거나, 백엔드의 `KakaoStrategy` 초기화 옵션에 `customHeaders` 또는 `authorizationParams`로 추가한다.

검토 결과 `passport-oauth2`는 `authorizationParams()` 오버라이드를 지원하므로 백엔드 `KakaoStrategy`에 `authorizationParams()` 메서드를 추가하는 것이 더 안전하다.

### 4.2 Bug 2 — 오류 로그 누락 (전체 코드베이스 검토 결과)

**현상**: 카카오 로그인 오류 발생 시 관리자 오류 로그 대시보드에 기록 없음

**근본 원인**:

`reportError()` 누락이 카카오에만 국한되지 않음. 전체 프론트엔드 코드베이스 검토 결과 소셜 로그인 3종 및 중요 계정 작업 전반에서 동일한 패턴으로 누락 확인:

#### P0 — 소셜 로그인 3종 (AuthContext.tsx)

```typescript
// loginWithKakao (line 667) — 현재
const loginWithKakao = async () => {
  try { ... } catch (error) {
    throw error;  // reportError() 없음
  }
};

// loginWithGoogle native path (line 619) — 현재
try { ... } catch (error) {
  throw error;  // reportError() 없음
}

// loginWithGoogle web path (line 648) — 현재
try { ... } catch (error) {
  throw error;  // reportError() 없음
}

// loginWithApple (line 657) — 현재
const loginWithApple = async () => {
  try { ... } catch (error) {
    throw error;  // reportError() 없음
  }
};
```

3종 모두 `throw error`만 하고 `reportError()` 없음. Google은 native SDK라 실패가 드물지만, 발생 시 관리자가 전혀 인지 불가.

#### P1 — 중요 계정 작업 (ProfileScreen.tsx)

| 함수 | 라인 | 누락 이유 |
|------|------|----------|
| `handleDeleteAccount` (OAuth 유저) | 262 | 회원탈퇴 실패 추적 불가 |
| `handleConfirmDelete` (이메일 유저) | 285 | 동일 |
| `handlePickProfilePhoto` | 396 | 사진 업로드 실패 추적 불가 |
| `handleConfirmProfilePhoto` | 414 | 동일 |

#### 이미 잘 처리된 곳 (변경 불필요)

- `PaywallModal.tsx`: V210에서 3경로(preflight block, ITEM_ALREADY_OWNED, 일반 실패) 모두 처리 ✅
- `CreateTripScreen.tsx`: 2경로(SSE 중단, 일반 실패)에 `reportError()` + Sentry 병행 ✅
- `ProfileScreen.handleExportData()`: V178에서 이미 처리 ✅

**해결 방안**: P0는 V216에 포함. P1은 V216에 함께 포함 (동일 파일 수정 비용 낮음). Invariant #32(PII strip before reportError): URL query string 제거 패턴 적용.

### 4.3 Bug 3 — Google Play 권장 조치

**현황**: 스크린샷으로만 확인됨. 내용 확인 후 대응 방안 결정 필요.

**일반적 Google Play 권장 조치 유형**:
- Android 15 deprecated API (edgeToEdgeEnabled, StatusBar API)
- Target SDK 버전 미충족
- 접근성 / 콘텐츠 정책 관련

**대응 절차**: Google Play Console에서 권장 조치 상세 내용 확인 → 해당 항목에 따라 코드/설정 수정 → V216 빌드에 포함.

---

## 5. Solution Design

### 5.1 Bug 1-A 수정 — Android Linking 기반 카카오 콜백 수신

**수정 파일**: `frontend/src/services/oauth.service.ts`

**변경 내용**:

```typescript
// Android에서 openAuthSessionAsync가 'dismiss'를 반환하는 경우
// Linking.addEventListener로 수신된 딥링크에서 콜백 URL 추출
async function signInWithOAuthAndroid(
  provider: OAuthProvider,
  authUrl: string,
  redirectUri: string,
  state: string,
): Promise<OAuthResult | null> {
  return new Promise(async (resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription?.remove();
        resolve(null);
      }
    }, 30000); // 30초 타임아웃

    // 딥링크 감시 (카카오 앱 전환 후 복귀 시 수신)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!resolved && url.includes('/auth/callback')) {
        resolved = true;
        clearTimeout(timeout);
        subscription.remove();
        resolve(parseOAuthCallback(url, state));
      }
    });

    await WebBrowser.warmUpAsync();
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
      showInRecents: false,
    });
    await WebBrowser.coolDownAsync();

    // Custom Tab 내 성공 (카카오 ID/PW 웹 로그인 경로)
    if (!resolved && result.type === 'success' && result.url) {
      resolved = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve(parseOAuthCallback(result.url, state));
    }

    // 'dismiss'인 경우: Linking subscription이 딥링크 수신 대기 중
    // (카카오 앱 전환 경로) — 이미 resolve된 경우에만 cleanup
    if (result.type !== 'success' && resolved) {
      clearTimeout(timeout);
    }
  });
}
```

### 5.2 Bug 1-B 수정 — 카카오 계정 강제 선택 (prompt=login)

**수정 파일**: `backend/src/auth/strategies/kakao.strategy.ts`

**변경 내용**: `authorizationParams()` 메서드 추가

```typescript
authorizationParams(): Record<string, string> {
  // prompt=login: 이미 인가된 카카오 세션이 있어도 계정 선택 화면 노출
  // 카카오 ID/PW 로그인 후 재클릭 시 계정 전환 가능하게 함
  return { prompt: 'login' };
}
```

### 5.3 Bug 2 수정 — 오류 로그 추가 (P0 + P1)

> 모든 `reportError()` 호출은 `apiService.reportError({...}).catch(() => {})` 패턴을 사용한다 (Invariant #31: 진단 인프라가 앱 흐름을 절대 방해하지 않음).

#### P0-1: AuthContext — 소셜 로그인 3종

**수정 파일**: `frontend/src/contexts/AuthContext.tsx`

```typescript
// loginWithKakao (line 667)
const loginWithKakao = async () => {
  try {
    const result = await signInWithKakao();
    await handleOAuthResult(result);
    trackEvent('login', { method: 'kakao' });
  } catch (error: any) {
    apiService.reportError({
      errorName: error?.message || 'KAKAO_LOGIN_FAILED',
      errorMessage: String(error?.message ?? 'Kakao login failed'),
      routeName: 'AuthContext.loginWithKakao',
    }).catch(() => {});
    throw error;
  }
};

// loginWithGoogle — native path catch (line 643)
} catch (error: any) {
  apiService.reportError({
    errorName: error?.message || 'GOOGLE_NATIVE_LOGIN_FAILED',
    errorMessage: String(error?.message ?? 'Google native login failed'),
    routeName: 'AuthContext.loginWithGoogle.native',
  }).catch(() => {});
  throw error;
}

// loginWithGoogle — web path catch (line 652)
} catch (error: any) {
  apiService.reportError({
    errorName: error?.message || 'GOOGLE_WEB_LOGIN_FAILED',
    errorMessage: String(error?.message ?? 'Google web login failed'),
    routeName: 'AuthContext.loginWithGoogle.web',
  }).catch(() => {});
  throw error;
}

// loginWithApple (line 662)
const loginWithApple = async () => {
  try {
    const result = await signInWithApple();
    await handleOAuthResult(result);
    trackEvent('login', { method: 'apple' });
  } catch (error: any) {
    apiService.reportError({
      errorName: error?.message || 'APPLE_LOGIN_FAILED',
      errorMessage: String(error?.message ?? 'Apple login failed'),
      routeName: 'AuthContext.loginWithApple',
    }).catch(() => {});
    throw error;
  }
};
```

`LoginScreen`의 각 `handle*Login()` catch는 UX 처리(토스트)만 유지 — AuthContext에서 이미 로깅하므로 이중 호출 방지.

#### P0-2: 중복 로깅 방지 확인

`GOOGLE_SIGNIN_CANCELLED` 에러는 사용자가 직접 취소한 정상 흐름이므로 로깅 제외:

```typescript
} catch (error: any) {
  // 사용자 취소는 로깅하지 않음 (noise 방지)
  if (error?.message !== 'GOOGLE_SIGNIN_CANCELLED') {
    apiService.reportError({ ... }).catch(() => {});
  }
  throw error;
}
```

#### P1-1: ProfileScreen — 회원탈퇴

**수정 파일**: `frontend/src/screens/main/ProfileScreen.tsx`

```typescript
// handleDeleteAccount (OAuth 유저, line 262)
} catch (error: any) {
  apiService.reportError({
    errorName: 'DELETE_ACCOUNT_FAILED',
    errorMessage: error?.response?.data?.message || String(error?.message ?? 'Delete account failed'),
    routeName: 'ProfileScreen.handleDeleteAccount',
  }).catch(() => {});
  showToast({ type: 'error', message: error.response?.data?.message || t('deleteAccount.alerts.failed'), position: 'top' });
}

// handleConfirmDelete (이메일 유저, line 285)
} catch (error: any) {
  apiService.reportError({
    errorName: 'DELETE_ACCOUNT_WITH_PASSWORD_FAILED',
    errorMessage: error?.response?.data?.message || String(error?.message ?? 'Delete account with password failed'),
    routeName: 'ProfileScreen.handleConfirmDelete',
  }).catch(() => {});
  showToast({ type: 'error', message: error.response?.data?.message || t('deleteAccount.alerts.failed'), position: 'top' });
}
```

#### P1-2: ProfileScreen — 사진 업로드

```typescript
// handlePickProfilePhoto (line 396) / handleConfirmProfilePhoto (line 414)
} catch (error: any) {
  apiService.reportError({
    errorName: 'PROFILE_PHOTO_UPLOAD_FAILED',
    errorMessage: error?.response?.data?.message || String(error?.message ?? 'Photo upload failed'),
    routeName: 'ProfileScreen.handlePickProfilePhoto',
  }).catch(() => {});
  showToast({ type: 'error', message: error.response?.data?.message || t('editProfile.alerts.photoFailed'), position: 'top' });
}
```

### 5.4 i18n 추가 — 카카오 에러 메시지

**수정 대상**: 17개 언어 `frontend/src/i18n/locales/{lang}/auth.json`

`AUTH_ERROR_I18N` 맵에 `KAKAO_SIGNIN_CANCELLED` 키 추가:

```typescript
const AUTH_ERROR_I18N: Record<string, string> = {
  GOOGLE_SIGNIN_CANCELLED: 'login.alerts.googleCancelled',
  OAUTH_FAILED: 'login.alerts.oauthFailed',
  GOOGLE_SIGNIN_UNAVAILABLE: 'login.alerts.googleUnavailable',
  KAKAO_SIGNIN_CANCELLED: 'login.alerts.kakaoCancelled',  // 추가
};
```

---

## 6. Success Criteria

### 6.1 Definition of Done

**Bug 1**:
- [ ] [카카오톡으로 로그인] 버튼 클릭 → 카카오톡 앱 전환 → myTravel 복귀 시 로그인 성공
- [ ] 카카오 ID/PW 로그인 성공 후 재클릭 시 계정 선택 화면(또는 카카오 계정 로그인 페이지) 노출
- [ ] Google/Apple 로그인 회귀 없음

**Bug 2 (P0 — 소셜 로그인 3종)**:
- [ ] 카카오 로그인 오류 발생 시 관리자 오류 로그 대시보드에 기록 확인
- [ ] Google 로그인 오류 발생 시 관리자 오류 로그 대시보드에 기록 확인
- [ ] Apple 로그인 오류 발생 시 관리자 오류 로그 대시보드에 기록 확인
- [ ] 사용자 취소(GOOGLE_SIGNIN_CANCELLED 등) 는 로그에 기록되지 않음 (noise 방지)
- [ ] 이중 로깅 없음 (AuthContext 1회만 호출, LoginScreen 미호출)

**Bug 2 (P1 — 계정 작업)**:
- [ ] OAuth 유저 회원탈퇴 실패 시 오류 로그 기록 확인
- [ ] 이메일 유저 회원탈퇴 실패 시 오류 로그 기록 확인
- [ ] 프로필 사진 업로드 실패 시 오류 로그 기록 확인

**Bug 3**:
- [ ] Google Play 권장 조치 내용 확인 완료
- [ ] 해당 조치 이행 완료 (V216 빌드 포함)

**공통**:
- [ ] TypeScript 0 errors (`npx tsc --noEmit`)
- [ ] Frontend Jest 전체 PASS (현재 230/230 기준 유지)
- [ ] Backend Jest 전체 PASS (현재 416/416 기준 유지)
- [ ] `npm run validate:static` PASS

### 6.2 Quality Criteria

- [ ] CLAUDE.md Invariant #28 준수 (에러 메시지 i18n)
- [ ] CLAUDE.md Invariant #31 준수 (진단 인프라 자기 보호)
- [ ] CLAUDE.md Invariant #32 준수 (PII strip before reportError)
- [ ] 기존 코드 컨벤션(try/catch 패턴) 일관성 유지

---

## 7. Verification Plan

> **핵심 원칙**: V215 프로덕션이 운영 중이므로, 모든 수정은 아래 4단계를 반드시 순서대로 통과한 후에만 다음 단계로 진행한다. 어느 단계에서도 P0 항목이 실패하면 해당 단계에서 중단하고 수정 후 재검수한다.

```
[로컬 개발] → [로컬 검수] → [Alpha 빌드/제출] → [Alpha 검수]
     → [운영 서버 배포] → [운영 검수] → [프로덕션 승급] → [모니터링]
```

---

### 7.1 운영/프로덕션 보호 원칙

| 원칙 | 내용 |
|------|------|
| **격리 원칙** | 백엔드 수정은 Alpha 검수 완료 전까지 운영 서버에 배포하지 않는다 |
| **순차 진행** | 각 단계 Go/No-Go 판정 후에만 다음 단계 진행. 병렬 진행 금지 |
| **최소 변경** | 이번 수정의 Backend 변경은 `KakaoStrategy` 1파일(1메서드 추가)에 한정. DB 스키마·마이그레이션 없음 |
| **즉시 롤백** | 운영 배포 후 이상 감지 시 10분 이내 롤백 가능한 상태를 항상 유지 |
| **프로덕션 단계적 출시** | Alpha 완료 → Production 10% → 이상 없음 확인 후 100% |

---

### 7.2 Step 1 — 로컬 개발 및 정적 검수

**목적**: 코드 수정 완료 후 운영 서버 접촉 없이 로컬에서 모든 자동화 검증 통과

**진입 조건**: 수정 파일 저장 완료

**자동화 검수 체크리스트**:
- [ ] `cd frontend && npx tsc --noEmit` — TypeScript 0 errors
- [ ] `cd backend && npx tsc --noEmit` — TypeScript 0 errors
- [ ] `cd frontend && npx jest --passWithNoTests` — 230/230 PASS
- [ ] `cd backend && npx jest --passWithNoTests` — 416/416 PASS
- [ ] `npm run validate:static` — 261 파일 PASS (legal + content 정합성)

**코드 리뷰 체크리스트**:
- [ ] `apiService.reportError({...}).catch(() => {})` 패턴 사용 (Invariant #31)
- [ ] 사용자 취소 에러(`GOOGLE_SIGNIN_CANCELLED` 등)는 reportError 제외 (noise 방지)
- [ ] 회원탈퇴 catch에 `isLoggingOutRef` 언급 없이 reportError만 추가 (기존 lock 흐름 불변)
- [ ] `KakaoStrategy.authorizationParams()` 반환값 `{ prompt: 'login' }` 정확성 확인

**Go/No-Go 판정**:
- **Go**: 자동화 검수 전 항목 PASS + 코드 리뷰 이상 없음
- **No-Go**: TypeScript 에러 1건 이상, 또는 Jest 실패 1건 이상 → 수정 후 재검수

---

### 7.3 Step 2 — 로컬 실물 기기 검수

**목적**: EAS 빌드 전 로컬 개발 서버 환경에서 핵심 시나리오 수동 확인

**진입 조건**: Step 1 Go 판정 완료

> **주의**: 로컬 기기 테스트는 `KAKAO_CALLBACK_URL`이 로컬 개발 서버(`http://localhost:3000`)를 가리키도록 설정된 상태에서 진행. 운영 서버 환경변수 변경 없음.

**시나리오별 체크리스트**:

| ID | 시나리오 | 기대 결과 | 결과 |
|----|----------|-----------|------|
| T1 | [카카오톡으로 로그인] 버튼 클릭 → 카톡 앱 전환 → 복귀 | 로그인 성공, 홈 화면 이동 | [ ] |
| T2 | 카카오 ID/PW 로그인 성공 후 [카카오톡으로 로그인] 재클릭 | 계정 선택 화면 노출 (이전 세션 재사용 없음) | [ ] |
| T3 | 카카오 로그인 플로우 도중 뒤로가기(취소) | 에러 토스트 표시, 오류 로그 대시보드에 **기록 없음** (취소는 로깅 제외) | [ ] |
| T4 | 카카오 로그인 강제 실패 (네트워크 차단 등) | 에러 토스트 표시, 관리자 오류 로그 **기록 있음** | [ ] |
| T5 | Google 로그인 정상 동작 | 회귀 없음 | [ ] |
| T6 | 이메일 로그인 정상 동작 | 회귀 없음 | [ ] |
| T7 | Apple 로그인 정상 동작 (iOS 기기) | 회귀 없음 (해당 기기 있을 때만) | [ ] |
| T8 | 회원탈퇴 실패 시뮬레이션 | 오류 토스트 + 관리자 오류 로그 기록 | [ ] |

**Go/No-Go 판정**:
- **Go**: T1~T6 전 항목 PASS (T7은 iOS 기기 없으면 Skip 허용)
- **No-Go**: T1 또는 T5 실패 → 운영에 영향 가능성 있음, 반드시 수정 후 재검수

---

### 7.4 Step 3 — Alpha 빌드 및 비공개 테스트

**목적**: 프로덕션과 동일한 EAS 빌드로 실제 Play Store 환경 검증. 운영 서버는 이 단계에서 처음 접촉.

**진입 조건**: Step 2 Go 판정 완료

#### 3-1. 백엔드 선배포 (운영 서버 첫 접촉)

> **격리 보장**: Backend 변경은 `KakaoStrategy` 1파일만. DB 변경 없음. 기존 Google/Apple/이메일 로그인 동작 불변.

```bash
# 변경 파일 최종 확인 (KakaoStrategy만 있어야 함)
git diff --name-only HEAD

# 운영 서버 배포
rsync -avz --exclude node_modules backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"

# 배포 직후 헬스체크
curl https://mytravel-planner.com/api/health
```

- [ ] health check `{"status":"ok"}` 응답 확인
- [ ] 배포 후 5분간 Sentry 에러 급증 없음 확인 (기존 사용자 영향 없음)
- [ ] 기존 Google/이메일 로그인 API(`/auth/google`, `/auth/login`) 정상 응답 확인

#### 3-2. 프론트엔드 EAS 빌드

```bash
# versionCode 215 → 216 확인
grep "versionCode" frontend/app.json

# EAS 로컬 빌드 (프로덕션 profile — 운영 환경변수 사용)
eas build --platform android --profile production --local --output ../build-v216.aab
```

- [ ] 빌드 성공, `build-v216.aab` 생성 확인
- [ ] 빌드 로그에 TypeScript 에러 없음 확인

#### 3-3. Alpha 트랙 제출

```bash
eas submit --platform android --profile production --path ../build-v216.aab
```

- [ ] Play Console Alpha(비공개 테스트) 트랙 업로드 확인
- [ ] 테스터 기기 업데이트 수신 확인 (최대 수 시간 소요)

#### 3-4. Alpha 기기 검수 시나리오

| ID | 시나리오 | 기대 결과 | 결과 |
|----|----------|-----------|------|
| A1 | [카카오톡으로 로그인] → 카톡 앱 전환 → 복귀 | 로그인 성공 | [ ] |
| A2 | 카카오 ID/PW 로그인 성공 후 [카카오톡으로 로그인] 재클릭 | 계정 선택 화면 노출 | [ ] |
| A3 | 카카오 로그인 취소 | 에러 토스트, 오류 로그 미기록 | [ ] |
| A4 | 카카오 로그인 실패 (서버 오류 등) | 에러 토스트, 관리자 오류 로그 기록 | [ ] |
| A5 | Google 로그인 | 정상 로그인, 회귀 없음 | [ ] |
| A6 | 이메일 로그인/로그아웃 | 정상 동작, 회귀 없음 | [ ] |
| A7 | 구독(PaywallModal) 진입 및 기존 구독 상태 확인 | 기존 동작 유지, 회귀 없음 | [ ] |
| A8 | 회원탈퇴 (OAuth 유저) | 정상 탈퇴, 오류 시 로그 기록 | [ ] |
| A9 | Google Play 권장 조치 해소 여부 | Play Console 경고 감소/해소 | [ ] |

**Go/No-Go 판정**:
- **Go**: A1~A8 전 항목 PASS (A9는 Play Console 반영에 수일 소요 허용)
- **No-Go**: A1, A5, A6, A7 중 하나라도 실패 → 프로덕션 승급 금지, 수정 후 재빌드

---

### 7.5 Step 4 — 프로덕션 승급 및 모니터링

**목적**: Alpha 완전 통과 후 실사용자 대상 단계적 출시

**진입 조건**: Step 3 Go 판정 완료 (A1~A8 전 항목 PASS)

> **운영 서버 추가 배포 불필요**: 백엔드는 Step 3-1에서 이미 배포 완료. 프론트엔드 AAB만 트랙 승급.

#### 4-1. 단계적 출시

```
Alpha → Production 10% (승급 즉시)
  → 6시간 모니터링 이상 없음 확인
  → Production 100% 확대
```

Play Console 조작:
- [ ] build-v216.aab 를 Alpha → Production 트랙으로 승급
- [ ] 출시 비율 **10%**로 설정 후 저장
- [ ] 6시간 후 Sentry/오류 로그 점검
- [ ] 이상 없으면 **100%**로 확대

#### 4-2. 출시 후 24시간 모니터링 체크리스트

| 항목 | 도구 | 기준 | 결과 |
|------|------|------|------|
| 전체 크래시율 | Sentry | V215 대비 증가 없음 | [ ] |
| 카카오 로그인 성공률 | 관리자 오류 로그 | 오류 로그 급증 없음 | [ ] |
| Google/이메일 로그인 정상 | 서버 로그 | 401/500 에러 증가 없음 | [ ] |
| 구독 결제 흐름 | Sentry + RC 대시보드 | 기존 대비 이상 없음 | [ ] |
| API 응답 시간 | 서버 헬스체크 | `curl https://mytravel-planner.com/api/health` 200 | [ ] |

---

### 7.6 롤백 계획

#### 롤백 트리거 (아래 중 하나 발생 시 즉시 롤백)

| 트리거 | 기준 |
|--------|------|
| 크래시율 급증 | V215 대비 2배 이상 |
| 로그인 전체 불가 | Google/이메일/카카오 모두 실패 |
| 구독 결제 차단 | PaywallModal 접근 불가 |
| 서버 헬스체크 실패 | `/api/health` 5xx 응답 |

#### 프론트엔드 롤백 (Play Console)

```
Play Console → 프로덕션 → 출시 관리 → V215 빌드 복원
소요 시간: ~수십 분 (Play 검토 없이 즉시 적용 가능)
```

#### 백엔드 롤백 (운영 서버)

```bash
# KakaoStrategy prompt=login 제거 후 재배포
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && git stash && docker compose build && docker compose up -d"
# 소요 시간: ~10분
```

> **롤백 후 확인**: `curl https://mytravel-planner.com/api/health` 200 응답 + 기존 로그인 정상 동작 재확인

---

## 8. Risks and Mitigation

| 리스크 | 영향 | 발생 가능성 | 대응 |
|--------|------|------------|------|
| `Linking.addEventListener` 기반 딥링크 수신이 일부 Android 버전에서 미작동 | High | Medium | Alpha 테스트 시 Android 10/12/14 기기 다양하게 검증. 실패 시 `Linking.getInitialURL()` 방식으로 fallback |
| `prompt=login`이 카카오 OAuth 스펙에서 지원되지 않는 버전 존재 | Medium | Low | 카카오 개발자 문서 확인 후 적용. 미지원 시 `prompt` 제거, 대신 세션 초기화 다른 방법 검토 |
| `reportError` import 경로 불일치 | Low | Low | 기존 다른 파일의 import 패턴 참조 |
| Bug 3 Google Play 권장 조치가 빌드 설정 변경 필요 | Medium | Medium | 내용 확인 즉시 범위 재평가 |
| 30초 타임아웃 중 사용자 UX 저하 | Low | Low | UX 검토: 로딩 인디케이터 유지, 명확한 에러 메시지 |

---

## 9. Architecture Considerations

### 9.1 Project Level

이 수정은 **Enterprise** 레벨 프로젝트의 기존 아키텍처 내 버그 수정이다. 구조적 변경 없음.

### 9.2 Backend 수정 필요 여부

**필요**: `KakaoStrategy.authorizationParams()` 추가 (1줄 수준의 최소 변경)

**불필요**: 
- auth.controller.ts — 변경 없음
- auth.service.ts — 변경 없음
- DB 스키마/마이그레이션 — 불필요

### 9.3 Frontend 수정 범위

**Bug 1 관련**:
- `frontend/src/services/oauth.service.ts` — Android 딥링크 기반 카카오 콜백 로직
- `backend/src/auth/strategies/kakao.strategy.ts` — `authorizationParams()` 추가 (prompt=login)

**Bug 2 (P0) 관련**:
- `frontend/src/contexts/AuthContext.tsx` — `loginWithKakao` / `loginWithGoogle` (native+web) / `loginWithApple` catch에 `reportError()` 추가

**Bug 2 (P1) 관련**:
- `frontend/src/screens/main/ProfileScreen.tsx` — `handleDeleteAccount` / `handleConfirmDelete` / `handlePickProfilePhoto` / `handleConfirmProfilePhoto` catch에 `reportError()` 추가

**i18n 관련**:
- `frontend/src/screens/auth/LoginScreen.tsx` — i18n 키 추가 (KAKAO_SIGNIN_CANCELLED)
- `frontend/src/i18n/locales/{lang}/auth.json` — 17개 언어 (kakaoCancelled 키 추가)

---

## 10. Version & Build Plan

### 10.1 버전 번호

- **versionCode**: 216 (`frontend/app.json` android.versionCode 215 → 216)
- **versionName**: 변경 없음 (패치 수준 버그 수정)

### 10.2 전체 작업 순서 (운영/프로덕션 영향 없는 순서 보장)

```
Phase 1 — 로컬 개발 (운영 서버 접촉 없음)
  1. backend/src/auth/strategies/kakao.strategy.ts 수정 (authorizationParams 추가)
  2. frontend/src/services/oauth.service.ts 수정 (Android Linking 딥링크)
  3. frontend/src/contexts/AuthContext.tsx 수정 (소셜 로그인 3종 reportError)
  4. frontend/src/screens/main/ProfileScreen.tsx 수정 (회원탈퇴·사진업로드 reportError)
  5. frontend/src/screens/auth/LoginScreen.tsx 수정 (i18n 키)
  6. frontend/src/i18n/locales/{17개}/auth.json 수정 (kakaoCancelled)
  7. frontend/app.json versionCode 215 → 216

Phase 2 — 로컬 자동화 검수 (Step 1, 운영 서버 접촉 없음)
  8. npx tsc --noEmit (frontend + backend 각각)
  9. npx jest (frontend 230+ / backend 416+ PASS)
  10. npm run validate:static PASS

Phase 3 — 로컬 실물 기기 검수 (Step 2, 운영 서버 접촉 없음)
  11. T1~T8 시나리오 수동 검수

Phase 4 — 운영 서버 배포 (Step 3-1, 첫 운영 접촉)
  12. rsync + docker compose build/up (backend만)
  13. health check + 5분 모니터링

Phase 5 — EAS 빌드 및 Alpha 제출 (Step 3-2/3)
  14. eas build --profile production --local → build-v216.aab
  15. eas submit → Alpha 트랙

Phase 6 — Alpha 기기 검수 (Step 3-4)
  16. A1~A9 시나리오 검수, Go/No-Go 판정

Phase 7 — 프로덕션 단계적 출시 (Step 4)
  17. Production 10% 출시
  18. 6시간 모니터링 → 100% 확대
  19. 24시간 최종 모니터링
```

### 10.3 커맨드 레퍼런스

```bash
# [Phase 2] 로컬 검수
cd frontend && npx tsc --noEmit && npx jest --passWithNoTests
cd backend && npx tsc --noEmit && npx jest --passWithNoTests
npm run validate:static

# [Phase 4] 운영 서버 배포 (backend만)
rsync -avz --exclude node_modules backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"
curl https://mytravel-planner.com/api/health

# [Phase 5] EAS 빌드 및 Alpha 제출
eas build --platform android --profile production --local --output ../build-v216.aab
eas submit --platform android --profile production --path ../build-v216.aab

# [롤백] 백엔드 긴급 롤백
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && git stash && docker compose build && docker compose up -d"
curl https://mytravel-planner.com/api/health
```

---

## 11. Convention Prerequisites

### 11.1 기존 프로젝트 컨벤션 확인

- [x] `CLAUDE.md` 핵심 불변식 (55건) 준수 확인
- [x] `tsconfig.json` — 기존 TypeScript 설정 준수
- [x] ESLint 설정 — 기존 규칙 준수

### 11.2 필요한 환경 변수 (추가 없음)

기존 `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_CALLBACK_URL` 사용 유지.

---

## 12. Next Steps

1. [ ] Google Play Console 권장 조치 스크린샷 내용 확인 → Bug 3 세부 대응 방안 확정
2. [ ] `reportError` import 경로 확인 (기존 사용 파일에서 패턴 참조)
3. [ ] 카카오 OAuth `prompt=login` 지원 여부 공식 문서 확인
4. [ ] 수정 구현 시작 (Do 단계)
5. [ ] Alpha 테스트 후 Production 승급

---

## Version History

| 버전 | 날짜 | 변경사항 | 작성자 |
|------|------|----------|--------|
| 0.1 | 2026-05-02 | 초안 작성 — Bug 1/2/3 원인 분석 및 수정 계획 | hoonjaepark |
| 0.2 | 2026-05-02 | 전체 코드베이스 reportError 누락 검토 결과 반영 — 소셜 로그인 3종(P0) 및 회원탈퇴/사진업로드(P1) 추가, FR-06/FR-07 신설 | hoonjaepark |
| 0.3 | 2026-05-02 | 운영/프로덕션 보호 검수 계획 전면 강화 — 7단계 격리 진행 원칙, Step별 Go/No-Go 판정 기준, 롤백 트리거·절차, 전체 작업 순서(Phase 1~7) 추가 | hoonjaepark |
