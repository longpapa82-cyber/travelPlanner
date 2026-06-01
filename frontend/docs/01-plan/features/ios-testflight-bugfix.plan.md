---
template: plan
version: 1.2
description: iOS TestFlight 1.0.0 (4) 버그 수정 계획 — Android/웹 영향 없이 iOS 5개 버그 해결
---

# iOS TestFlight 버그 수정 Planning Document

> **Summary**: TestFlight 1.0.0 (4) 검증에서 발견된 iOS 전용 버그 5건을 Android/웹 서비스에 영향 없이 수정한다.
>
> **Project**: MyTravel (Expo SDK 54, React Native)
> **Version**: 1.0.0 (5) — 다음 TestFlight 빌드 목표
> **Author**: Product Manager
> **Date**: 2026-05-04
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

TestFlight 1.0.0 (4) 내부 테스트 결과 iOS에서만 발생하는 5개 버그가 확인되었다.
이 버그들은 앱 첫인상 (스플래시), 핵심 UX (탭바, 날짜 선택, 키보드), 그리고
사용자 인증 (Google Sign-In 크래시) 에 걸쳐 있어 App Store 출시 전 반드시 해결해야 한다.

### 1.2 Background

- **현재 상태**: Android versionCode 220 프로덕션 운영 중, iOS TestFlight 1.0.0 (4) 검증 단계
- **핵심 제약**: Android 및 웹(mytravel-planner.com)에 영향 없이 iOS만 수정
- **플랫폼 분기 원칙**: `Platform.OS === 'ios'` 조건 또는 `app.config.js` ios 섹션으로만 분리

### 1.3 Related Documents

- 불변식 45개: `docs/invariants/README.md`
- 배포 절차: `docs/operations/deploy.md`
- CLAUDE.md 핵심 불변식: KAV behavior="height" 금지 (UI 불변식)

---

## 2. Scope

### 2.1 In Scope

- [x] 버그 1: 스플래시 화면 깜빡임 (iOS cold launch 캐시 잔상)
- [x] 버그 2: 하단 탭바 홈 인디케이터 영역 침범
- [x] 버그 3: 날짜 선택 버튼 렌더링 불가
- [x] 버그 4: 키보드가 텍스트 필드를 가리는 문제
- [x] 버그 5: Google Sign-In 버튼 클릭 시 앱 크래시
- [x] iOS 전용 조건부 코드로 수정 (Android/웹 코드 경로 불변)
- [x] EAS Build를 통한 TestFlight 1.0.0 (5) 빌드 제출

### 2.2 Out of Scope

- Android 동작 변경 (versionCode 220 기준 정상 동작)
- 웹 서비스 변경
- 새 기능 추가
- RevenueCat / 구독 로직 수정
- 백엔드 서버 변경

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | 앱 최초 실행 시 스플래시 잔상 없이 깔끔하게 전환 | P1 | Pending |
| FR-02 | 하단 탭바가 iPhone Safe Area (홈 인디케이터) 위에 올바르게 배치 | P1 | Pending |
| FR-03 | 날짜 선택 UI 컴포넌트가 iOS에서 정상 렌더링 및 상호작용 | P1 | Pending |
| FR-04 | 텍스트 필드 포커스 시 키보드가 필드를 가리지 않음 | P1 | Pending |
| FR-05 | Google Sign-In 버튼 클릭 시 크래시 없이 정상 인증 진행 | P0 | Pending |
| FR-06 | 수정 후 Android 빌드에서 회귀 발생 없음 | P0 | Pending |

### 3.2 Non-Functional Requirements

| Category | 기준 | 검증 방법 |
|----------|------|---------|
| 플랫폼 격리 | iOS 수정 코드는 Platform.OS 조건 또는 app.config.js ios 섹션으로만 적용 | 코드 리뷰 |
| 안정성 | Google Sign-In 크래시 0건 (iOS Simulator + 실기기) | TestFlight 테스트 |
| UX | Safe Area 침범 0px | 실기기 (iPhone 14/15) 확인 |
| 불변식 준수 | KAV behavior="height" 절대 사용 금지 | 코드 리뷰 |

---

## 4. 버그별 근본 원인 진단 및 수정 방법

### 버그 1 (P1): 스플래시 화면 깜빡임

**증상**: 앱 실행 시 약 0.1초 동안 이전 빌드 스플래시 이미지가 보임

**근본 원인**:
iOS는 `LaunchScreen.storyboard`를 번들에 캐싱한다.
Expo managed workflow에서 `app.config.js`의 `splash.image`를 변경해도
TestFlight 빌드 간 디바이스 캐시가 클리어되지 않으면 구 이미지가 0.1초 잔류한다.
또한 `splash.backgroundColor`가 앱의 초기 배경색과 다를 경우 색상 전환 깜빡임도 발생한다.

**수정 방법**:
1. `app.config.js`의 `splash.backgroundColor`를 앱 첫 화면 배경색과 일치시킨다.
2. iOS 전용 `splash.image` 경로 검증 — 현재 `./assets/splash-icon.png` 사용이 올바른지 확인.
3. `resizeMode: 'contain'` → `'cover'`로 변경 검토 (잔상 노출 면적 최소화).
4. EAS Build 후 TestFlight 설치 시 디바이스에서 앱 완전 삭제 후 재설치를 테스터에게 안내.

**Android/웹 영향**: 없음. `app.config.js`의 `splash` 섹션은 iOS/Android 공통이지만
`backgroundColor` 수정은 시각적 개선이므로 Android 회귀 없음.

---

### 버그 2 (P1): 하단 탭바 크기 문제

**증상**: 아이폰 라운딩 코너 영역으로 인해 탭바 버튼이 너무 작게 보임

**근본 원인**:
iOS의 홈 인디케이터(Home Indicator) 영역은 Safe Area Insets 하단에 포함된다.
React Navigation의 Bottom Tab Navigator는 기본적으로 `safeAreaInsets`를 자동 처리하지만,
커스텀 `tabBarStyle`에서 `paddingBottom`을 하드코딩하거나 `height`를 고정하면
Safe Area가 무시되고 홈 인디케이터 영역과 버튼이 겹친다.

**수정 방법**:
```typescript
// 수정 전 (추정): 하드코딩된 높이
tabBarStyle: { height: 60, paddingBottom: 8 }

// 수정 후: useSafeAreaInsets 적용
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
tabBarStyle: {
  height: 60 + insets.bottom,
  paddingBottom: insets.bottom,
}
```
또는 React Navigation의 `tabBarStyle`에서 고정 height/paddingBottom 제거 후
`safeAreaInsets` 자동 처리에 위임한다.

**Android/웹 영향**: `useSafeAreaInsets().bottom`은 Android에서 0 또는 navigation bar 높이를
정확히 반환하므로 Android 동작 변경 없음. 웹은 insets가 0이므로 영향 없음.

---

### 버그 3 (P1): 날짜 선택 버튼 표기 불가

**증상**: 날짜 선택 버튼이 제대로 표기되지 않아 선택 불가

**근본 원인 후보**:
- `@react-native-community/datetimepicker` 또는 커스텀 DatePicker 컴포넌트가
  iOS 17+ 렌더링 변경(버튼 스타일, Modal 배경)에 미대응.
- iOS에서 `DatePickerIOS` deprecated API 사용 잔존.
- 버튼의 `TouchableOpacity`/`Pressable`에 `zIndex` 또는 `pointerEvents` 충돌.
- 다크모드에서 버튼 텍스트 색상이 배경색과 동일하여 보이지 않는 경우
  (플랫폼별 색상 토큰 미분리).

**수정 방법**:
1. 날짜 선택 컴포넌트 특정 후 iOS 렌더링 확인.
2. `@react-native-community/datetimepicker`를 사용 중이라면 최신 버전으로 업그레이드.
3. iOS 전용 `display` 옵션을 `'spinner'` 또는 `'inline'`으로 명시:
```typescript
<DateTimePicker
  mode="date"
  display={Platform.OS === 'ios' ? 'inline' : 'default'}
/>
```
4. 다크모드 색상 충돌이라면 `Platform.OS === 'ios'` 분기로 iOS 전용 색상 지정.

**Android/웹 영향**: `Platform.OS === 'ios'` 조건부이므로 없음.

---

### 버그 4 (P1): 키보드가 텍스트 필드 가림

**증상**: 텍스트 입력 필드 클릭 시 키보드가 필드 위로 올라와 가림

**근본 원인**:
`LoginScreen.tsx`를 보면 현재 코드:
```typescript
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  ...
>
```
`behavior="padding"`은 뷰 전체에 패딩을 추가하는 방식이다.
스크롤 컨테이너와 함께 사용 시 scroll offset 계산이 맞지 않아
특정 화면(긴 폼, 하단 필드)에서 필드가 키보드에 가려질 수 있다.

**CLAUDE.md 불변식 확인**:
> UI 불변식: `KAV behavior="height"` 금지

따라서 `behavior="height"` 로는 수정 불가. `'padding'` 방식 유지하되
`ScrollView`의 `keyboardVerticalOffset` 미세 조정 또는
`KeyboardAwareScrollView` 라이브러리 (`react-native-keyboard-aware-scroll-view`)로 교체가 옵션.

**수정 방법**:
`react-native-keyboard-aware-scroll-view`가 이미 `package.json`에 있다면:
```typescript
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// ScrollView 대신 KeyboardAwareScrollView 사용
<KeyboardAwareScrollView
  enableOnAndroid={false}  // Android는 softwareKeyboardLayoutMode: 'pan' 사용
  extraScrollHeight={Platform.OS === 'ios' ? 24 : 0}
  keyboardShouldPersistTaps="handled"
>
```
없다면 기존 KAV + ScrollView 유지하되 `keyboardVerticalOffset` 추가:
```typescript
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
>
```

**Android/웹 영향**: `enableOnAndroid={false}` 또는 iOS 조건부이므로 없음.
Android는 `app.config.js`의 `softwareKeyboardLayoutMode: 'pan'`이 이미 처리.

---

### 버그 5 (P0): Google Sign-In 크래시

**증상**: "Google로 시작하기" 버튼 클릭 즉시 앱 강제 종료

**근본 원인 진단**:
`googleNativeSignIn.ts`를 분석하면:

```typescript
const IOS_CLIENT_ID =
  process.env.GOOGLE_IOS_CLIENT_ID ||
  '48805541090-9gh3sp9asspe3d1et4er2pqpihm2bg47.apps.googleusercontent.com';

function ensureConfigured() {
  if (isConfigured || Platform.OS === 'web') return;
  try {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: Platform.OS === 'ios' ? IOS_CLIENT_ID : undefined,
      offlineAccess: false,
    });
    isConfigured = true;
  } catch {
    GoogleSignin = null;
  }
}
```

**가능한 크래시 원인**:

1. **`GOOGLE_IOS_CLIENT_ID` 환경변수 미설정** (가장 유력):
   EAS Build 시 `eas.json`의 iOS 프로파일에 `GOOGLE_IOS_CLIENT_ID`가 없으면
   하드코딩된 Client ID로 fallback한다. 이 Client ID가 TestFlight 앱 번들 ID
   (`com.longpapa82.travelplanner`)와 Google Cloud Console에서 매핑이 안 되면
   `GoogleSignIn.signIn()` 호출에서 NSException이 발생하여 크래시.

2. **`@react-native-google-signin/google-signin` iOS 모듈 링킹 누락**:
   `app.config.js`에 `'@react-native-google-signin/google-signin'` 플러그인이 등록되어
   있으나 (`plugins` 배열 확인), EAS Build의 `ios` 섹션 `prebuildCommand`나
   `GoogleService-Info.plist` 부재 시 native 모듈이 초기화되지 않고 크래시.

3. **`GoogleService-Info.plist` 미포함**:
   iOS용 Google Sign-In은 `GoogleService-Info.plist`가 앱 번들에 포함되어야 한다.
   EAS Build에서 이 파일이 번들에 포함되지 않으면 런타임 크래시.

4. **New Architecture(Fabric) 호환성**:
   `app.config.js`에 `newArchEnabled: true`가 설정되어 있다.
   `@react-native-google-signin/google-signin` 버전이 New Architecture를 지원하지 않으면
   iOS에서 Fabric 브릿지 초기화 실패로 크래시.

**진단 순서**:
1. Crashlytics/Sentry 크래시 로그에서 정확한 스택 트레이스 확인
2. `eas.json`에서 iOS 빌드 프로파일의 환경변수 확인
3. `@react-native-google-signin/google-signin` 버전 확인 (`package.json`)
4. Google Cloud Console에서 iOS OAuth Client ID 등록 및 번들 ID 매핑 확인

**수정 방법**:
```json
// eas.json - production-ios 프로파일에 추가
{
  "build": {
    "production-ios": {
      "env": {
        "GOOGLE_IOS_CLIENT_ID": "48805541090-9gh3sp9asspe3d1et4er2pqpihm2bg47.apps.googleusercontent.com"
      }
    }
  }
}
```

또는 Google Cloud Console에서 iOS 클라이언트 ID 재생성 + `GoogleService-Info.plist` EAS Secret 등록.

**Android 영향 확인**:
Android는 `hasPlayServices()` 체크 후 `signIn()`을 호출하므로 구조적으로 다르다.
Android versionCode 220은 Google Sign-In 정상 동작 중이므로 이 수정이 Android에 영향을 주지 않는다.
단, **Android에서도 Google Sign-In 크래시가 발생할 가능성을 배제할 수 없으므로**
Android 테스터에게 확인을 요청해야 한다.

---

## 5. 우선순위 및 수정 순서

### MoSCoW 우선순위

| 버그 | 우선순위 | 분류 | 이유 |
|------|---------|------|------|
| 버그 5: Google Sign-In 크래시 | **P0** | Must | 앱 강제 종료 = 사용 불가 |
| 버그 2: 탭바 Safe Area | **P1** | Must | 모든 화면에 노출, 첫인상 직결 |
| 버그 4: 키보드 가림 | **P1** | Must | 핵심 기능(로그인, 텍스트 입력) 저해 |
| 버그 3: 날짜 선택 불가 | **P1** | Must | 여행 일정 생성 핵심 기능 |
| 버그 1: 스플래시 깜빡임 | **P2** | Should | UX 개선, App Store 심사 영향 가능 |

### 수정 순서 (의존성 기준)

```
Step 1 (독립 작업, 병렬 가능)
├── 버그 5: Google Sign-In 크래시 진단 → eas.json / GoogleService-Info.plist 수정
└── 버그 2: 탭바 네비게이터 Safe Area 적용

Step 2 (Step 1과 독립)
├── 버그 4: 키보드 회피 수정 (LoginScreen.tsx, 기타 입력 화면)
└── 버그 3: 날짜 선택 컴포넌트 특정 및 수정

Step 3
└── 버그 1: splash 설정 검토 및 backgroundColor 통일

Step 4
└── EAS Build iOS → TestFlight 1.0.0 (5) 제출 + Android 회귀 테스트
```

### 예상 공수

| 작업 | 예상 시간 | 비고 |
|------|---------|------|
| 버그 5 진단 + 수정 | 2~4시간 | Sentry 로그 분석 필요 |
| 버그 2 수정 | 1시간 | Safe Area 적용 |
| 버그 4 수정 | 1~2시간 | 영향 화면 범위 파악 필요 |
| 버그 3 수정 | 1~2시간 | 컴포넌트 특정 필요 |
| 버그 1 수정 | 0.5시간 | app.config.js 수정 |
| Android 회귀 검증 | 1시간 | 실기기 또는 에뮬레이터 |
| EAS Build + TestFlight | 30~60분 | 빌드 시간 포함 |
| **합계** | **7~12시간** | |

---

## 6. Success Criteria

### 6.1 Definition of Done

- [x] 5개 버그 모두 TestFlight 실기기에서 재현 불가
- [x] Android versionCode 220 동작 회귀 없음 (Google Sign-In, 탭바, 날짜 선택, 키보드, 스플래시)
- [x] 웹 서비스 영향 없음
- [x] KAV behavior="height" 코드 없음 (불변식 준수)
- [x] EAS Build iOS 성공 → TestFlight 1.0.0 (5) 제출

### 6.2 Quality Criteria

- [x] Platform.OS 조건부 코드만 사용 (공유 로직 불변)
- [x] 새로 추가된 의존성 없음 (기존 라이브러리만 활용)
- [x] TypeScript 에러 0건

---

## 7. Risks and Mitigation

| 리스크 | 영향도 | 가능성 | 대응 방안 |
|--------|--------|--------|---------|
| Google Sign-In 크래시 원인이 `GoogleService-Info.plist` 외 다른 원인 | High | Medium | Sentry/Crashlytics 스택 트레이스 먼저 분석 |
| 날짜 선택 컴포넌트가 커스텀 구현으로 위치 파악 시간 소요 | Medium | Medium | `git grep DatePicker` 로 즉시 탐색 |
| 키보드 수정이 여러 화면에 영향 → 부분 수정 시 일관성 깨짐 | Medium | Low | 영향 화면 목록화 후 일괄 수정 |
| EAS Build iOS 실패 (인증서/프로비저닝 만료) | High | Low | eas.json credentials 사전 검증 |
| New Architecture + Google Sign-In 비호환 | High | Low | 버전 업그레이드 또는 newArchEnabled 일시 조정 |

---

## 8. Android/웹 영향 없음 검증 방법

### Android 검증 체크리스트

- [ ] Google Sign-In: Android 실기기에서 정상 로그인 확인
- [ ] 탭바: Android 하단 navigation bar 표시 정상 확인
- [ ] 날짜 선택: Android DatePicker 정상 동작 확인
- [ ] 키보드: Android `softwareKeyboardLayoutMode: 'pan'` 동작 유지 확인
- [ ] 스플래시: Android 실행 시 깜빡임 없음 확인

### 웹 검증 체크리스트

- [ ] `Platform.OS === 'ios'` 분기 코드는 웹에서 실행되지 않음 확인
- [ ] `app.config.js` splash 변경이 `web.favicon` 미영향 확인
- [ ] 웹 OAuth 리다이렉트 플로우 정상 동작 확인

### 코드 패턴 검증

수정된 모든 코드가 다음 패턴 중 하나를 사용해야 한다:

```typescript
// 패턴 A: 런타임 플랫폼 분기
Platform.OS === 'ios' ? iOSValue : defaultValue

// 패턴 B: iOS 전용 플랫폼 체크
if (Platform.OS === 'ios') { /* iOS only */ }

// 패턴 C: app.config.js ios 섹션 (빌드타임 분리)
ios: { /* iOS only config */ }
```

Android/웹 공통 코드 경로는 수정하지 않는다.

---

## 9. Architecture Considerations

### 9.1 Project Level

현재 프로젝트: **Dynamic** (Expo managed workflow + NestJS backend)

### 9.2 Key Architectural Decisions

| 결정 | 선택 | 근거 |
|------|------|------|
| 플랫폼 분리 방법 | Platform.OS 런타임 분기 | 동일 코드베이스 유지, 웹/Android 불변 |
| Google Sign-In | @react-native-google-signin/google-signin | 이미 사용 중, 변경 없음 |
| Safe Area | react-native-safe-area-context | 이미 ProfileScreen에서 useSafeAreaInsets 사용 중 |
| 키보드 회피 | KAV 'padding' 유지 or KeyboardAwareScrollView | KAV 'height' 금지 불변식 준수 |

---

## 10. Next Steps

1. [ ] 버그 5 Sentry/Crashlytics 크래시 로그 확인 (가장 우선)
2. [ ] `git grep -r "DatePicker\|date.*picker\|DateTimePicker" frontend/src` 로 날짜 선택 컴포넌트 특정
3. [ ] 탭바 네비게이터 파일 확인 (`src/navigation/` 또는 `src/screens/`)
4. [ ] Design 문서 작성 후 구현 시작
5. [ ] EAS Build → TestFlight 1.0.0 (5) 제출

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-04 | Initial draft | PM Agent |
