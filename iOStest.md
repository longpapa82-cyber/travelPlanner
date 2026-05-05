# iOS 마스터 플랜 — v12 기준 전면 개정판

> **작성일**: 2026-05-05  
> **기준 버전**: iOS 1.0.0 (buildNumber 12)  
> **핵심 원칙**: 현재 운영 중인 웹(www.mytravel-planner.com) 및 Android 앱(V220 프로덕션)에 영향 없음

---

## 목차

1. [v12 테스트 결과 분석](#1-v12-테스트-결과-분석)
2. [이전 버전 해결 항목 원복 원인 분석](#2-이전-버전-해결-항목-원복-원인-분석)
3. [버그별 근본 원인 및 수정 계획](#3-버그별-근본-원인-및-수정-계획)
4. [수정 결과 상세 검수 계획](#4-수정-결과-상세-검수-계획)
5. [iOS 전수 검수 계획](#5-ios-전수-검수-계획)
6. [보안 점검 계획](#6-보안-점검-계획)
7. [웹·Android 운영 서비스 영향 격리 계획](#7-웹android-운영-서비스-영향-격리-계획)
8. [일정 및 우선순위 요약](#8-일정-및-우선순위-요약)

---

## 1. v12 테스트 결과 분석

### 1-A. 버그 전체 목록

| ID | 증상 | 유형 | 심각도 | 이전 해결 여부 | **v13 수정 상태** |
|----|------|------|--------|----------------|-----------------|
| B-01 | 앱 실행 시 이전 앱 스크린샷 0.1초 깜빡임 | 미해결 | P2 | - | ⏳ 보류 (expo-splash-screen 미설치) |
| B-02 | 이메일 로그인 시 iOS 암호 저장 팝업 출현 | 미해결 | P1 | - | ✅ 수정완료 (textContentType 복원) |
| B-03 | 카카오 로그인 완료 후 카카오톡 앱으로 복귀 (myTravel 미복귀) | 미해결 | P1 | - | ✅ 수정완료 (OAuth state base64url 인코딩) |
| B-04 | 탭/화면별 상단 헤더 높이 들쑥날쑥 (관리자 화면 포함) | 미해결 | P2 | - | ✅ TripHero SafeArea 수정 (부분) |
| B-05 | 여행 상세(TripDetail) 오른쪽 상단 ← 버튼 동작 안 함 | 미해결 | P1 | - | 🔍 실기기 조사 필요 |
| B-06 | 일부 화면에서 뒤로가기 버튼 중복 표시 | 미해결 | P2 | - | 🔍 실기기 조사 필요 |
| **R-01** | **날짜 선택기(DatePicker) 흰색으로만 보여 선택 불가** | **원복** | **P1** | v8에서 해결 | ✅ 수정완료 (#F2F2F7 배경) |
| **R-02** | **광고 리워드 버튼("광고 보고 상세 여행 인사이트 받기") 미노출** | **원복** | P2 | v8에서 확인 필요했으나 재발 | ✅ 수정완료 (eas.json EXPO_PUBLIC_USE_TEST_ADS) |

### 1-B. 대기 중 항목 (외부 조건 의존)

| ID | 항목 | 선행 조건 | 상태 |
|----|------|-----------|------|
| W-01 | iOS 인앱결제 구독 | App Store Connect 현지화 검수 완료 | ⏳ |
| W-02 | iOS AdMob 광고 (배너/인터스티셜) | App Store 공개 출시 후 AdMob iOS 앱 승인 | ⏳ |

---

## 2. 이전 버전 해결 항목 원복 원인 분석

> **이 섹션이 핵심입니다.** 왜 수정이 되었다가 다시 돌아왔는지 근본 원인을 명확히 하고, 재발 방지 규칙을 수립합니다.

### 2-1. R-01: DatePicker 원복

**타임라인**
```
v7: DatePicker 완전 미표시 (P0)
v8: display="inline" Modal 방식으로 수정 → 선택 가능해짐 (해결 처리)
v12: 달력이 흰색 배경에 흰색 텍스트로 렌더링 → 사실상 선택 불가 (원복처럼 보임)
```

**실제 코드 상태 (DatePicker.tsx 확인)**
```
현재 코드: Platform.OS === 'ios' → Modal + display="inline" 방식으로 정확히 구현되어 있음.
원복이 아니라 신규 버그: 라이트 모드에서 Modal 배경색과 달력 렌더링 색상 충돌.
```

**근본 원인**
```
DatePicker.tsx Line 116:
  backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0]
  
colors.neutral[0] = #FFFFFF (흰색)
@react-native-community/datetimepicker display="inline"은 라이트 모드에서
달력 날짜 텍스트를 기본 어두운 색상으로 렌더링하는데, 모달 배경이 흰색이라
특정 영역의 텍스트가 흰 배경에 묻혀 보이지 않음.

추가 요인: accentColor prop이 적용된 경우 iOS 버전에 따라 선택 영역 배경이
흰색으로 오버렌더링될 수 있음.
```

**재발 방지 규칙**
```
규칙 R-01-1: DatePicker 관련 변경 시 반드시 라이트모드 + 다크모드 각각 스크린샷 비교
규칙 R-01-2: display="inline"은 Modal 배경을 시스템 색상(#F2F2F7 또는 isDark ? #1C1C1E : #F2F2F7)으로 설정
규칙 R-01-3: @react-native-community/datetimepicker 업그레이드 시 iOS inline 렌더링 반드시 수동 검증
```

---

### 2-2. R-02: 광고 리워드 버튼 미노출 원복

**타임라인**
```
v7~v8 (Android): [광고 보고 상세 여행 인사이트 받기] 버튼 자체는 보임
                 → 버튼 표시 = 정상, 광고 영상 재생만 안 됨 (AdMob 미승인 상태였지만 버튼은 보였음)
v12 (iOS): 버튼 자체가 아예 보이지 않음 → 진짜 원복
```

**핵심 질문**: Android에서는 AdMob 미승인 상태에도 버튼이 보였는데 iOS에서는 왜 안 보이나?

**근본 원인 — eas.json production-ios 프로필 환경변수 누락**

```
useRewardedAd.native.ts의 광고 ID 선택 로직 (커밋 9849b935 확인):

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';
if (useTestAds) {
  return TestIds.REWARDED;  // 테스트 광고 ID → 즉시 로드 성공 → isRewardedLoaded=true
}
// useTestAds=false이면 실제 AdMob 프로덕션 ID 사용 시도
```

Android 빌드(eas.json production 프로필):
  → EXPO_PUBLIC_USE_TEST_ADS=true 또는 Alpha 빌드 환경변수 포함
  → TestIds.REWARDED 사용 → 광고 로드 성공 → isRewardedLoaded=true → 버튼 표시

iOS 빌드(eas.json production-ios 프로필):
  → EXPO_PUBLIC_USE_TEST_ADS 환경변수 없음 (eas.json 확인 완료)
  → __DEV__=false (Release 빌드)
  → 실제 AdMob iOS 프로덕션 ID 사용 시도
  → App Store 미공개 → AdMob iOS 앱 미승인 → 광고 로드 실패
  → isRewardedLoaded=false → 버튼 조건 false → 버튼 미표시

결론: 환경변수 하나의 차이가 버튼 표시/미표시를 결정.
Android는 테스트 광고가 로드되어 버튼 보임, iOS는 실제 광고 로드 실패로 버튼 없어짐.
```

**재발 방지 규칙**
```
규칙 R-02-1: eas.json production-ios 프로필에 EXPO_PUBLIC_USE_TEST_ADS=true 추가
             (App Store 공개 후 AdMob iOS 승인 완료 시 제거)
규칙 R-02-2: iOS/Android 각 빌드 프로필의 환경변수 차이를 명시적으로 관리
             (두 플랫폼 프로필의 env 섹션을 정기적으로 대조 검토)
규칙 R-02-3: 광고 버튼이 보이지 않는다고 보고되면 isRewardedLoaded 값과
             EXPO_PUBLIC_USE_TEST_ADS 환경변수를 먼저 확인
```

---

### 2-3. 왜 수정이 "원복"처럼 보이는가 — 패턴 분석

v12에서 이전에 해결된 것들이 원복된 것처럼 보이는 주 원인:

**원인 A: 리뉴얼 디자인 작업 시 수정사항 미통합**
```
LoginScreen.tsx의 경우:
- 이전에 textContentType="username"/"password"로 수정 완료
- v12에서 Ocean Blue 디자인 리뉴얼 작업 시 LoginScreen 전체를 새로 작성
- 새 파일에 이전 수정사항(textContentType)이 누락됨 → textContentType="none"으로 되돌아감

현재 코드(v12) Line 254: textContentType="none"  ← 원복 상태
현재 코드(v12) Line 275: textContentType="none"  ← 원복 상태
```

**원인 B: 플랫폼별 eas.json 환경변수 불일치 (진짜 원복 원인)**
```
Android/Alpha 빌드: EXPO_PUBLIC_USE_TEST_ADS=true 포함
  → TestIds.REWARDED 사용 → 광고 로드 성공 → 버튼 표시

iOS production-ios 빌드: EXPO_PUBLIC_USE_TEST_ADS 없음
  → 실제 AdMob 프로덕션 광고 ID 로드 시도
  → App Store 미공개 → AdMob iOS 앱 미승인 → 로드 실패
  → isRewardedLoaded=false → 버튼 미표시

같은 코드인데 환경변수 하나가 다르게 설정되어 버튼이 보이고 안 보이는 차이 발생.
"원복"처럼 보이지만 실제로는 플랫폼별 빌드 환경 설정 미동기화가 원인.
```

**원인 C: iOS 전용 렌더링 이슈 (신규 발생)**
```
DatePicker의 경우 코드는 올바르게 수정되었으나 iOS 특정 버전에서의
색상 렌더링 이슈가 새로 발생 — 원복이 아닌 신규 환경 버그.
```

**재발 방지 규칙 (전체 공통)**
```
규칙 COMMON-1: 화면 전체를 리뉴얼/재작성할 때는 반드시 이전 버전의 수정사항 목록을
               체크리스트로 만들어 신규 코드에 포함시킬 것
규칙 COMMON-2: iOS 전용 수정사항은 코드 내에 주석으로 명시:
               // iOS-ONLY: textContentType="username" prevents password save popup
               // See: iosTestResult.md B-02
규칙 COMMON-3: 리뉴얼 커밋 PR에 "iOS 전용 수정사항 체크리스트" 항목 필수 포함
규칙 COMMON-4: TestFlight 빌드 전 iOStest.md의 "수정 완료" 항목을 모두 재검증
```

---

## 3. 버그별 근본 원인 및 수정 계획

### 3-1. B-02: 이메일 로그인 암호 저장 팝업 (P1 — 즉시 수정)

**근본 원인**
```
현상: iOS에서 이메일/비밀번호 입력 후 "이 기기에서 암호를 저장하시겠습니까?" 팝업 출현
원인: LoginScreen v2.0 리뉴얼 시 이전 수정사항 미포함

현재 코드 (LoginScreen.tsx):
  Line 254: textContentType="none"  (이메일 필드)
  Line 275: textContentType="none"  (비밀번호 필드)

iOS는 secureTextEntry=true인 필드 + 이메일 필드 조합을 감지하면
textContentType="none" 설정을 무시하고 Keychain 저장을 시도함.
"새 암호" 시나리오로 인식되는 것이 문제.
Android는 이 동작 없음.
```

**수정 방법**
```typescript
// LoginScreen.tsx 수정 (Line 254)
// 변경 전:
textContentType="none"  // 이메일 TextInput

// 변경 후:
textContentType="username"  // iOS-ONLY: 이 값으로 "새 암호" 시나리오 방지
// See: iosTestResult.md B-02

// LoginScreen.tsx 수정 (Line 275)  
// 변경 전:
textContentType="none"  // 비밀번호 TextInput

// 변경 후:
textContentType="password"  // iOS-ONLY: 기존 암호 자동완성으로 인식, 저장 팝업 억제
// See: iosTestResult.md B-02
```

**영향 범위**
```
수정 파일: frontend/src/screens/auth/LoginScreen.tsx (2줄만 변경)
Android: textContentType은 iOS 전용 속성 → 완전 무영향
웹: textContentType 무시됨 → 무영향
```

---

### 3-2. B-03: 카카오 로그인 후 앱 미복귀 (P1 — 즉시 수정)

**근본 원인**
```
현상: 카카오 [확인] 클릭 후 myTravel이 아닌 카카오톡 앱으로 포커스 이동
원인: 카카오톡 앱을 통한 OAuth 처리 후 딥링크 핸들링 방식 문제

동작 흐름:
1. loginWithKakao() → WebBrowser.openAuthSessionAsync() 호출
2. 카카오톡 앱이 인증 가로챔 (iOS URL scheme 우선순위)
3. 카카오톡이 인증 완료 후 travelplanner://auth/callback 으로 리다이렉트
4. iOS가 딥링크를 처리해 myTravel 앱을 열지만, 포커스는 카카오톡에 머뭄
5. AuthContext의 Linking 이벤트는 수신되어 로그인은 성공하나, 화면은 카카오톡

백엔드에 이미 platform 파라미터 처리 구조가 있음.
```

**수정 방법 (방법 C — 영향 범위 최소)**
```
백엔드: auth.controller.ts 카카오 콜백에서 platform=ios 감지 시
        Location: travelplanner://auth/callback?... 리다이렉트 응답

프론트엔드: oauth.service.ts 또는 AuthContext에서 Linking.openURL을 
           명시적으로 호출하여 앱 포커스 강제 전환

수정 파일:
  backend/src/auth/auth.controller.ts
  frontend/src/services/api.ts 또는 AuthContext.tsx
```

**영향 범위**
```
Android: platform=android 분기 → 기존 동작 유지, 무영향
웹: platform=web 분기 → 기존 동작 유지, 무영향
백엔드 API 호환성: 기존 엔드포인트 유지, 분기 추가만
```

---

### 3-3. R-01: DatePicker 흰색 렌더링 (P1 — 즉시 수정)

**근본 원인**
```
현상: 날짜 선택 Modal에서 달력이 거의 흰색으로만 보임
원인: iOS inline DatePicker의 배경색과 렌더링 색상 충돌

현재 코드 (DatePicker.tsx Line 116):
  backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0]
  colors.neutral[0] = #FFFFFF (순수 흰색)

@react-native-community/datetimepicker display="inline"의 iOS 렌더링 특성:
- 달력 셀 배경이 시스템 기본값(#F2F2F7 연회색)과 사용자 배경이 흰색이면 구분 불가
- accentColor 적용 시 선택 상태 배경이 흰색으로 오버렌더링되는 iOS 버그 있음
```

**수정 방법**
```typescript
// DatePicker.tsx 수정 (Modal 배경색)
// 변경 전:
backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0]

// 변경 후:
// iOS-ONLY: #F2F2F7은 iOS 시스템 그룹 배경색으로 inline DatePicker와 어울림
backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7'

// 추가: accentColor를 테마 primary로 명시적 설정 (이미 되어 있으나 재확인)
accentColor={theme.colors.primary}
```

**영향 범위**
```
수정 파일: frontend/src/components/core/DatePicker.tsx (1줄만 변경)
Android: Platform.OS === 'ios' 블록 내부 → 완전 무영향
웹: 별도 web 렌더 경로 → 무영향
```

---

### 3-4. R-02: 광고 리워드 버튼 미노출 (P2)

**근본 원인**
```
현상: 이전 Android 빌드에서는 버튼이 보였으나 iOS v12에서 버튼 자체가 미표시
원인: eas.json production-ios 프로필에 EXPO_PUBLIC_USE_TEST_ADS 환경변수 누락

useRewardedAd.native.ts 로직:
  const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true';
  → useTestAds=true: TestIds.REWARDED(테스트ID) → 로드 성공 → isRewardedLoaded=true → 버튼 표시
  → useTestAds=false: 실제 AdMob 프로덕션 ID → iOS 미승인 → 로드 실패 → 버튼 미표시

eas.json production-ios 환경변수 (현재):
  EXPO_PUBLIC_USE_TEST_ADS 없음 → useTestAds=false → 실제 광고 로드 시도 → 실패

eas.json Android 프로필:
  EXPO_PUBLIC_USE_TEST_ADS=true (또는 Alpha 프로필에 포함) → 테스트 광고 로드 성공
```

**수정 방법**
```json
// frontend/eas.json — production-ios 프로필 env 섹션에 추가
"production-ios": {
  "ios": { "buildConfiguration": "Release" },
  "env": {
    "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
    "EXPO_PUBLIC_APP_URL": "https://mytravel-planner.com",
    "REVENUECAT_IOS_KEY": "appl_DtHjfizXdnNUxlHKhZKHuoZKYLe",
    "GOOGLE_IOS_CLIENT_ID": "48805541090-...",
    "SENTRY_DSN": "https://...",
    "EXPO_PUBLIC_USE_TEST_ADS": "true"   ← 이 한 줄 추가
  }
}
```

**주의**: App Store 공개 + AdMob iOS 앱 승인 완료 후 이 줄을 제거해야 함.

**CreateTripScreen.tsx는 변경 불필요** — 코드 로직은 정상.
버튼이 보이지 않는 유일한 원인이 환경변수이므로 eas.json 1줄 수정으로 해결.

**영향 범위**
```
수정 파일: frontend/eas.json (1줄 추가)
Android: eas.json iOS 프로필만 수정 → 완전 무영향
웹: 무관 → 무영향
```

---

### 3-5. B-04: 헤더 높이 불일치 (P2)

**근본 원인**
```
현상: 탭/화면별 헤더 영역 높이가 들쑥날쑥
원인: 각 화면의 헤더 구현 방식 혼재

현재 상황:
1. TripsNavigator.tsx: headerShown: false (탭 내비게이터)
2. TripHero.tsx: 자체 구현된 헤더 (backButton + rightButtons)
3. 일부 화면: React Navigation 기본 header 사용
4. 일부 화면: 커스텀 View + 하드코딩 paddingTop 혼재
5. iOS Safe Area Inset이 화면마다 다르게 적용됨
6. Dynamic Island 기기(iPhone 14 Pro+)에서 StatusBar 높이 다름
```

**수정 방법**
```
1. 공통 AppHeader 컴포넌트 점검 (기존 컴포넌트 활용 또는 신규 생성)
2. 모든 탭 화면에 useSafeAreaInsets().top 기반 동적 패딩 통일
3. headerShown: false인 화면들의 커스텀 헤더 높이를 상수로 통일
   const HEADER_HEIGHT = Platform.OS === 'ios' ? insets.top + 44 : 56;
4. 관리자 화면 포함 모든 화면 적용
```

**영향 범위**
```
수정 파일: 헤더 있는 화면 전체 (iOS 전용 조건으로 적용)
Android: Platform.OS === 'ios' 조건부 → 무영향
```

---

### 3-6. B-05: TripDetail 오른쪽 상단 버튼 미동작 (P1)

**근본 원인**
```
현상: 여행 상세 화면 오른쪽 상단에 이전 버튼이 표기되나 클릭해도 동작 안 함
원인: TripHero.tsx에 이미 onGoBack 버튼(왼쪽 arrow-left)이 구현되어 있으나,
      상위 네비게이터가 추가로 headerShown: true인 상태이면 React Navigation의
      기본 back 버튼이 오른쪽에 중복 렌더링될 수 있음.
      또는 TripDetailScreen에서 headerShown: true + headerLeft가 설정된 경우
      두 개의 back 버튼이 공존하는 구조.

TripHero의 backButton(Line 92~101)은 onGoBack을 올바르게 호출.
React Navigation 기본 back 버튼이 중복 렌더링되어 클릭해도 navigation.goBack()
호출이 네비게이터에서 처리되지 않는 상황으로 추정.
```

**수정 방법**
```
TripDetailScreen 네비게이터 설정:
  headerShown: false 확인 (TripHero가 자체 헤더를 그리므로 중복 불필요)
  또는 headerLeft: () => null 으로 기본 back 버튼 제거

TripHero의 onGoBack은 navigation.goBack() 정상 호출 → 그대로 유지
```

---

### 3-7. B-06: 뒤로가기 버튼 중복 (P2)

**근본 원인**
```
현상: 일부 화면에서 왼쪽 상단에 뒤로가기 버튼이 2개 (< 형태와 텍스트 형태 혼재)
원인: React Navigation 기본 back 버튼과 커스텀 headerLeft 컴포넌트 중복
      또는 화면 자체의 커스텀 버튼과 네비게이터 헤더 버튼 공존

iOS에서만 발생하는 이유:
- iOS React Navigation 기본 헤더에는 back 텍스트("< 내 여행")가 표시됨
- Android는 헤더 없이 시스템 제스처로 처리하는 경우가 많아 중복 안 보임
```

**수정 방법**
```
대상 화면 목록 파악: 중복이 발생하는 화면 전수 조사
해결 원칙:
  - 커스텀 헤더가 있는 화면: headerShown: false + 커스텀 back 버튼만 사용
  - 기본 헤더를 사용하는 화면: 커스텀 headerLeft에서 기본 스타일과 동일하게 통일
  - 혼재 화면: 하나의 방식으로 통일 (커스텀 헤더 추천)
```

---

### 3-8. B-01: 스플래시 깜빡임 (P2 — 개선 시도)

**근본 원인**
```
현상: 앱 실행 시 이전 빌드의 스크린샷이 약 0.1초 표시됨
원인: iOS 앱 전환 애니메이션을 위해 백그라운드 진입 순간 스크린샷 캐시 저장
      새 빌드 설치 후 첫 실행 시 이 캐시 이미지가 잠깐 표시됨
      (Android는 이 동작 다름)

완전 해결 불가: iOS 시스템 동작이므로 최소화만 가능
```

**수정 방법 (최소화 접근)**
```
app.config.js:
  splash.backgroundColor: '#FAFAF9' (앱 메인 배경색과 동일하게 유지 — 이미 적용)
  splash.resizeMode: 'cover' (이미 적용)

SplashScreen 명시적 제어:
  SplashScreen.preventAutoHideAsync() + 앱 준비 완료 후 SplashScreen.hideAsync()
  → 캐시 이미지와 스플래시가 자연스럽게 연결되도록 처리
```

---

## 4. 수정 결과 상세 검수 계획

> 각 수정 후 반드시 이 섹션의 체크리스트를 완료해야 다음 Phase로 진행 가능합니다.

### 4-A. B-02 수정 검수 (이메일 암호 저장 팝업)

```
iOS 기기에서 수행:
□ 로그인 화면 진입
□ 이메일 주소 입력 (유효한 이메일)
□ 비밀번호 입력 (실제 계정 비밀번호)
□ 로그인 버튼 클릭
□ "이 기기에서 암호를 저장하시겠습니까?" 팝업이 출현하지 않음 ← 핵심
□ 로그인 정상 완료 (홈 화면 진입 확인)
□ 이메일 필드 탭 시 iOS 키보드 자동완성 제안 동작 확인 (허용됨)

Android 회귀 검증:
□ Android에서 이메일 로그인 시나리오 동일하게 수행 → 기존과 동일 동작
```

### 4-B. B-03 수정 검수 (카카오 로그인 앱 복귀)

```
iOS 기기에서 수행:
□ 로그인 화면 → [카카오로 시작하기] 클릭
□ 카카오 계정 입력 화면 진입 (카카오톡 앱 또는 사파리)
□ 이메일/비밀번호 입력 → [확인] 클릭
□ myTravel 앱으로 자동 복귀됨 ← 핵심 (카카오톡 앱이 아닌 myTravel이 포그라운드)
□ 로그인 완료 상태 확인 (홈 화면 표시, 사용자명 표시)
□ 로그아웃 후 재로그인 시도 → 동일 동작 확인

Android 회귀 검증:
□ Android 카카오 로그인 → 기존과 동일하게 동작
웹 회귀 검증:
□ 웹 카카오 로그인 → 기존과 동일하게 동작
```

### 4-C. R-01 수정 검수 (DatePicker 표시)

```
iOS 기기에서 수행 (라이트모드):
□ 새 여행 만들기 화면 진입
□ 출발일 입력 영역 클릭 → DatePicker Modal 표시
□ 달력이 명확하게 보임 ← 핵심 (날짜, 요일, 연도 텍스트 모두 가시)
□ 날짜 선택 가능 확인 (선택된 날짜 강조 표시)
□ [완료] 클릭 → 선택한 날짜가 필드에 표시됨

iOS 기기에서 수행 (다크모드):
□ 동일 시나리오 수행 → 달력 명확하게 표시
□ 날짜 선택 가능 확인

Android 회귀 검증:
□ Android DatePicker 동일하게 동작 확인
```

### 4-D. R-02 수정 검수 (리워드 광고 버튼)

```
전제: eas.json production-ios에 EXPO_PUBLIC_USE_TEST_ADS=true 추가 후 빌드된 버전

iOS 기기에서 수행:
□ 새 여행 만들기 화면 진입
□ 목적지 2자 이상 입력
□ [광고 보고 상세 여행 인사이트 받기] 버튼이 표시됨 ← 핵심
□ 버튼 클릭 → 테스트 광고 영상 재생 (TestIds.REWARDED 광고)
□ 광고 시청 완료 → "상세 여행 인사이트" 잠금 해제
□ 프리미엄 계정으로 진입 시 버튼이 표시되지 않음 확인

Android 회귀 검증:
□ Android에서 동일 버튼 정상 노출 → 기존과 동일 동작 (환경변수 변경 없으므로 영향 없음)
```

### 4-E. B-04 수정 검수 (헤더 높이 통일)

```
iOS 기기에서 수행:
□ 홈 탭 상단 헤더 높이 확인 (스크린샷)
□ 탐색 탭 상단 헤더 높이 확인 (스크린샷)
□ 내 여행 탭 상단 헤더 높이 확인 (스크린샷)
□ 알림 탭 상단 헤더 높이 확인 (스크린샷)
□ 프로필 탭 상단 헤더 높이 확인 (스크린샷)
□ 관리자 화면 각 탭 헤더 높이 확인 (스크린샷)
□ 모든 화면의 헤더 상단 기준선이 동일함 ← 핵심
□ Dynamic Island 기기와 노치 기기 각각 확인 (가능하면)

Android 회귀 검증:
□ Android 탭 전환 → 기존과 동일하게 동작
```

### 4-F. B-05/B-06 수정 검수 (뒤로가기 버튼)

```
iOS 기기에서 수행:
□ 내 여행 → 여행 카드 클릭 → TripDetail 화면 진입
□ 왼쪽 상단 ← (arrow-left) 버튼 클릭 → 내 여행 목록으로 정상 복귀 ← B-05
□ 오른쪽 상단에 이전 버튼 없음 확인 ← B-05 (기존 미동작 버튼 제거)
□ 화면 내 뒤로가기 버튼이 1개만 존재 ← B-06
□ 다른 화면들(탐색 상세, 설정 등)에서도 버튼 중복 없음 확인

Android 회귀 검증:
□ Android TripDetail 뒤로가기 → 기존과 동일 동작
```

### 4-G. 전체 자동화 회귀 테스트

```bash
# 수정 완료 후 반드시 실행
cd frontend && npx tsc --noEmit  # TypeScript 오류 0건
cd backend && npx tsc --noEmit   # TypeScript 오류 0건
cd frontend && npm test           # Jest 모든 통과
cd backend && npm test            # Jest 모든 통과
npm run validate:static           # 정적 검증 PASS
```

---

## 5. iOS 전수 검수 계획

### 5-A. 검수 환경

```
기기: 실제 iPhone (TestFlight 설치)
버전: iOS 1.0.0 (buildNumber 13 이상 — 수정 반영 빌드)
계정:
  - 이메일 계정: 1개 (테스트용)
  - Google 계정: 1개
  - Apple 계정: 1개
  - Kakao 계정: 1개
  - 관리자 계정: 1개
  - 프리미엄 테스트 계정: 1개 (W-01 완료 후)
기기 요구: iPhone (iOS 16 이상)
```

### 5-B. Layer별 전수 검수 체크리스트

---

#### Layer 1: 앱 시작 및 기본 UI

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L1-01 | 앱 실행 | 아이콘 탭 → 스플래시 → 홈 | 스플래시 정상 표시, 깜빡임 최소화 | ⬜ |
| L1-02 | 다크모드 | 기기 설정 → 다크모드 후 앱 | 앱 전체 다크 테마 적용 | ⬜ |
| L1-03 | 라이트모드 | 기기 설정 → 라이트모드 후 앱 | 앱 전체 라이트 테마 적용 | ⬜ |
| L1-04 | 다국어 (한국어) | 기기 언어: 한국어 | 한국어 표시 | ⬜ |
| L1-05 | 다국어 (영어) | 기기 언어: 영어 | 영어 표시 | ⬜ |
| L1-06 | Safe Area | 노치/Dynamic Island 기기 | UI 요소 노치에 가리지 않음 | ⬜ |
| L1-07 | 탭바 표시 | 하단 탭 5개 (홈/탐색/내 여행/알림/프로필) | 아이콘+텍스트 정상, 여백 적절 | ⬜ |
| L1-08 | 헤더 일관성 | 각 탭 이동 5회 | 헤더 높이 모든 탭 동일 | ⬜ |
| L1-09 | 화면 회전 | 가로 회전 시도 | 세로 고정 (portrait only) | ⬜ |

---

#### Layer 2: 인증

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L2-01 | 이메일 로그인 | 정상 계정 로그인 | 홈 진입, 암호 저장 팝업 없음 | ⬜ |
| L2-02 | 이메일 로그인 실패 | 틀린 비밀번호 | 오류 메시지 표시, 앱 크래시 없음 | ⬜ |
| L2-03 | Google 로그인 | Google 계정 선택 → 로그인 | 앱 강제종료 없이 정상 로그인 | ⬜ |
| L2-04 | Apple 로그인 | Face ID 인증 → 로그인 | 정상 로그인, 홈 진입 | ⬜ |
| L2-05 | Kakao 로그인 | 카카오 계정 → [확인] | myTravel 앱으로 복귀, 정상 로그인 | ⬜ |
| L2-06 | 자동 로그인 | 로그인 후 앱 재실행 | 로그인 유지됨 | ⬜ |
| L2-07 | 로그아웃 | 프로필 → 로그아웃 | 로그인 화면으로 이동 | ⬜ |
| L2-08 | 비밀번호 재설정 | 이메일로 재설정 링크 발송 | 링크 발송, 재설정 완료 | ⬜ |
| L2-09 | 회원가입 | 새 이메일 계정 생성 | 인증 메일 발송, 가입 완료 | ⬜ |
| L2-10 | 2FA 로그인 | 2FA 설정 계정으로 로그인 | OTP 입력 화면 → 인증 성공 | ⬜ |
| L2-11 | 세션 만료 | 토큰 만료 후 API 호출 | 자동 갱신 또는 재로그인 유도 | ⬜ |

---

#### Layer 3: 여행 관리 (핵심 기능)

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L3-01 | 여행 생성 | 목적지/날짜 입력 → 생성 | 정상 생성, 목록 표시 | ⬜ |
| L3-02 | 날짜 선택기 | 출발일/도착일 각각 선택 | DatePicker 정상 표시, 선택 가능 | ⬜ |
| L3-03 | 날짜 유효성 | 출발일 > 도착일 설정 시도 | "종료일 입력" 오류 메시지 (출발일 아님) | ⬜ |
| L3-04 | AI 여행 생성 | AI 일정 자동 생성 | 로딩 후 일정 정상 생성 | ⬜ |
| L3-05 | 리워드 광고 버튼 | 목적지 입력 후 | [광고 보고 인사이트 받기] 버튼 표시 | ⬜ |
| L3-06 | 여행 목록 | 내 여행 탭 | 생성된 여행 카드 목록 표시 | ⬜ |
| L3-07 | 여행 상세 진입 | 여행 카드 클릭 | TripDetail 화면 정상 진입 | ⬜ |
| L3-08 | 뒤로가기 (TripDetail) | ← 버튼 클릭 | 내 여행 목록으로 정상 복귀 | ⬜ |
| L3-09 | 뒤로가기 버튼 단일 | 중복 없음 확인 | 버튼 1개만 표시 | ⬜ |
| L3-10 | 여행 수정 | 여행 정보 편집 | 수정 저장 | ⬜ |
| L3-11 | 여행 삭제 | 삭제 확인 → 삭제 | 삭제 완료, 목록 제거 | ⬜ |
| L3-12 | 활동 추가/수정/삭제 | 일정 활동 CRUD | 각 동작 정상 처리 | ⬜ |
| L3-13 | 지도 표시 | 활동 위치 지도 | 좌표 정상 핀 표시 | ⬜ |

---

#### Layer 4: 탐색 및 검색

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L4-01 | 탐색 화면 | 탐색 탭 진입 | 여행지 콘텐츠 정상 표시 | ⬜ |
| L4-02 | 장소 검색 | 목적지 검색 입력 | 자동완성 결과 표시 | ⬜ |
| L4-03 | 장소 선택 | 검색 결과 탭 | 정확한 좌표 입력 | ⬜ |
| L4-04 | 날씨 정보 | 여행지 날씨 조회 | 날씨 데이터 표시 | ⬜ |

---

#### Layer 5: 프로필 및 설정

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L5-01 | 프로필 조회 | 프로필 탭 | 이름/이메일/가입 방식 표시 | ⬜ |
| L5-02 | 프로필 이미지 변경 | 사진 선택 | 이미지 변경 성공, 오류 없음 | ⬜ |
| L5-03 | 닉네임 변경 | 닉네임 수정 | 변경 저장 | ⬜ |
| L5-04 | 언어 설정 | 앱 내 언어 변경 | 즉시 반영 | ⬜ |
| L5-05 | 테마 설정 | 라이트/다크 전환 | 즉시 반영 | ⬜ |
| L5-06 | 알림 설정 | 푸시 알림 on/off | 설정 저장 | ⬜ |
| L5-07 | 회원 탈퇴 | 탈퇴 요청 | 확인 모달 → 탈퇴 처리 | ⬜ |

---

#### Layer 6: 알림

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L6-01 | 알림 목록 | 알림 탭 | 수신된 알림 표시 | ⬜ |
| L6-02 | 알림 읽음 처리 | 알림 항목 탭 | 읽음 상태로 변경 | ⬜ |
| L6-03 | 공지사항 | 공지 알림 표시 | 공지 내용 정상 표시 | ⬜ |

---

#### Layer 7: 결제 및 구독 (W-01 완료 후)

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L7-01 | 구독 화면 | 프리미엄 업그레이드 진입 | 구독 패키지 목록 표시 | ⏳ W-01 |
| L7-02 | 월간 구독 | Sandbox 계정으로 구독 | 결제 성공, 프리미엄 활성화 | ⏳ W-01 |
| L7-03 | 연간 구독 | Sandbox 계정으로 구독 | 결제 성공, 프리미엄 활성화 | ⏳ W-01 |
| L7-04 | 구독 복원 | 기존 구독 복원 버튼 | 구독 상태 복원 | ⏳ W-01 |
| L7-05 | 구독 관리 | 구독 관리 링크 | App Store 구독 화면 진입 | ⏳ W-01 |
| L7-06 | 프리미엄 광고 제거 | 구독 후 | 광고 버튼/배너 미표시 | ⏳ W-01+W-02 |

---

#### Layer 8: 광고 (W-02 AdMob iOS 승인 후)

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L8-01 | 리워드 광고 실행 | 버튼 클릭 → 광고 시청 | 광고 정상 재생, 인사이트 잠금 해제 | ⏳ W-02 |
| L8-02 | 배너 광고 | 해당 화면 표시 | 광고 배너 정상 노출 | ⏳ W-02 |
| L8-03 | 인터스티셜 광고 | 화면 전환 시 | 적절한 시점에 노출 | ⏳ W-02 |
| L8-04 | GDPR 동의 | 첫 실행 시 | 동의 화면 → 광고 설정 반영 | ⏳ W-02 |

---

#### Layer 9: 오류 처리 및 네트워크

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L9-01 | 오프라인 처리 | 네트워크 끄기 | 오류 메시지 표시, 앱 크래시 없음 | ⬜ |
| L9-02 | 서버 오류 | API 500 에러 시 | 사용자 친화적 메시지 | ⬜ |
| L9-03 | 타임아웃 | 느린 네트워크 | 로딩 표시 → 타임아웃 처리 | ⬜ |
| L9-04 | 토스트 위치 | 각종 토스트 메시지 | Safe Area 내 표시, 시스템 UI 미겹침 | ⬜ |

---

#### Layer 10: 관리자 기능

| # | 검수 항목 | 확인 내용 | 기대 결과 | 상태 |
|---|-----------|-----------|-----------|------|
| L10-01 | 관리자 화면 접근 | 관리자 계정 → 프로필 | 관리자 메뉴 표시 | ⬜ |
| L10-02 | 오류 로그 | 관리자 → 오류 로그 | 최근 오류 내역 표시, 새 오류 확인 | ⬜ |
| L10-03 | API 사용량 | 관리자 → API 사용량 | 차트 및 수치 정상 | ⬜ |
| L10-04 | 수익 대시보드 | 관리자 → 수익 | 수익 현황 표시 | ⬜ |
| L10-05 | 관리자 헤더 | 관리자 화면 전체 탭 | 헤더 높이 통일 | ⬜ |

---

## 6. 보안 점검 계획

### 6-A. 인증 및 세션 보안

```
□ JWT access token 만료(15분) 후 API 재호출 → 자동 갱신 또는 재로그인
□ Refresh token: iOS Keychain에만 저장됨 확인 (AsyncStorage 저장 금지 불변식)
□ 로그아웃 시 Keychain의 refresh token 완전 삭제
□ OAuth state(nonce) CSRF 방지 파라미터 정상 생성/검증
□ Apple 로그인: JWKS 검증 정상 동작 (백엔드)
□ 계정 잠금: 비밀번호 5회 실패 시 잠금 처리
□ 2FA 백업 코드 SHA-256 해싱 (재사용 불가)
□ isLoggingOut 락 동작 확인 (로그아웃 중 중복 API 호출 방지 불변식)
```

### 6-B. 데이터 전송 보안

```
□ 모든 API 통신 HTTPS (HTTP 차단) 확인
□ SSL 인증서 유효성 (mytravel-planner.com)
□ API 요청 시 Authorization 헤더 누락 화면 없음
□ 비밀번호 등 민감 데이터가 네트워크 로그에 출력되지 않음
```

### 6-C. 기기 내 데이터 저장 보안

```
□ Keychain 저장 항목: refresh token만 (다른 민감 데이터 없음)
□ AsyncStorage: refresh token 저장 없음 (불변식 위반 여부)
□ 프로덕션 빌드에서 console.log 비활성화 (민감 정보 출력 없음)
□ 백그라운드 진입 시 민감 화면(결제/프로필) 블러 처리 여부
```

### 6-D. API 엔드포인트 보안

```
□ 인증 없는 보호 엔드포인트 접근 시 401 응답
□ 타 사용자 여행 데이터 접근 시도 시 403 응답 (IDOR 방지)
□ 관리자 API를 일반 계정으로 호출 시 403 응답
□ Rate Limiting: 로그인 분당 10회, 전체 API 분당 100회
□ 사용자 입력 값(여행 이름 등)의 XSS 이스케이프 처리
```

### 6-E. 개인정보 처리 보안

```
□ 오류 로그에 이메일/이름 등 PII 포함 여부 (PII strip 불변식)
□ 분석 이벤트에 개인 식별 정보 포함 여부
□ 서버 응답에 비밀번호 해시 포함 여부 (절대 불가)
□ 회원 탈퇴 시 개인정보 삭제 처리 완전성
```

### 6-F. iOS 앱 특화 보안

```
□ ATS(App Transport Security): NSAllowsArbitraryLoads false
□ URL Scheme(travelplanner://): 등록된 앱만 수신 가능
□ 카카오 OAuth redirect_uri: 등록된 URI만 허용 확인
□ 인앱구매 영수증: RevenueCat 서버 검증 (클라이언트 검증 없음)
□ 앱 바이너리: EAS 프로덕션 빌드 기본 난독화 적용 확인
```

### 6-G. 웹 서비스 보안 (운영 서비스)

```
□ HSTS 헤더: Strict-Transport-Security 설정 확인
□ X-Frame-Options: DENY 설정
□ X-Content-Type-Options: nosniff 설정
□ CSP 헤더 확인 (현재 이슈: unsafe-inline → 향후 nonce 전환)
□ OAuth 콜백 URL 화이트리스트 (등록된 URI만 허용)
```

---

## 7. 웹·Android 운영 서비스 영향 격리 계획

### 7-A. 영향 격리 원칙 (불변 규칙)

```
규칙 1: 모든 iOS 전용 수정은 Platform.OS === 'ios' 조건으로 분기
규칙 2: 백엔드 수정 시 기존 엔드포인트/동작 유지 + platform 파라미터로 분기
규칙 3: EAS 빌드는 production-ios 프로필만 사용 (android 프로필 건드리지 않음)
규칙 4: 공유 컴포넌트 수정 시 기존 Props 인터페이스 유지 (Breaking change 금지)
규칙 5: DB 스키마 변경 없음 (iOS 수정은 순수 프론트엔드/iOS 전용)
규칙 6: 배포 전 반드시 Android 운영 서비스 스모크 테스트 실행
```

### 7-B. Phase별 운영 영향 체크포인트

각 Phase 수정 완료 후 아래 항목 확인 후 다음 Phase 진행:

```
Phase 1 완료 후 (B-02, B-03, R-01, R-02):
□ www.mytravel-planner.com 이메일 로그인 정상 동작
□ www.mytravel-planner.com 구글 로그인 정상 동작
□ www.mytravel-planner.com 카카오 로그인 정상 동작
□ Android V220 이메일 로그인 정상 동작
□ Android V220 구글 로그인 정상 동작
□ Android V220 카카오 로그인 정상 동작
□ Android V220 여행 생성 (DatePicker 포함) 정상 동작
□ 백엔드 API 서버 응답 정상 (mytravel-planner.com)

Phase 2 완료 후 (B-04, B-05, B-06, B-01):
□ 위 항목 재확인
□ Android V220 여행 상세 화면 뒤로가기 정상 동작
□ Android V220 헤더 UI 변화 없음
```

### 7-C. 백엔드 배포 시 주의사항

```
B-03 카카오 로그인 수정에서 백엔드 변경이 수반될 경우:
□ 기존 카카오 로그인 콜백 경로 유지 (platform 파라미터 없는 기존 요청도 처리)
□ platform=android, platform=web 분기: 기존 동작 100% 유지
□ platform=ios 분기: 신규 추가
□ 배포 직후 Android 카카오 로그인 즉시 테스트

배포 명령:
rsync -avz --exclude node_modules backend/src/ \
  root@46.62.201.127:/root/travelPlanner/backend/src/ && \
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"
```

---

## 8. 일정 및 우선순위 요약

### 8-A. 수정 우선순위 매트릭스

```
즉시 수정 (P1):
  B-02: 이메일 암호 저장 팝업     → LoginScreen.tsx 2줄 변경 (30분)
  R-01: DatePicker 흰색           → DatePicker.tsx 1줄 변경 (30분)
  B-03: 카카오 앱 복귀            → 백엔드 + 프론트 수정 (2~3시간)
  B-05: TripDetail 버튼 미동작    → 네비게이터 설정 확인 (1시간)

다음 수정 (P2):
  R-02: 리워드 광고 버튼          → CreateTripScreen.tsx 조건 변경 (1시간)
  B-04: 헤더 높이 불일치          → 공통 헤더 정비 (3~4시간)
  B-06: 뒤로가기 버튼 중복        → 화면별 조사 후 수정 (2시간)
  B-01: 스플래시 깜빡임           → SplashScreen 제어 개선 (1시간)

외부 대기:
  W-01: iOS 구독                  → App Store Connect 현지화 완료 후
  W-02: iOS AdMob                 → App Store 공개 출시 후
```

### 8-B. 전체 일정 계획

| 단계 | 작업 내용 | 예상 소요 | 비고 |
|------|-----------|-----------|------|
| **Phase 1** | B-02, R-01, B-05 수정 (코드 변경 최소) | 반나절 | 즉시 시작 |
| **Phase 1** | B-03 카카오 앱 복귀 수정 | 반나절 | 백엔드 포함 |
| **Phase 1** | 자동화 회귀 테스트 (TypeScript + Jest) | 1시간 | 자동 |
| **Phase 1** | Phase 1 운영 영향 확인 | 30분 | Android + 웹 수동 확인 |
| **Phase 2** | R-02, B-04, B-06, B-01 수정 | 하루 | UI 작업 |
| **Phase 2** | 운영 영향 확인 | 30분 | |
| **EAS 빌드** | production-ios buildNumber 13 빌드 | 30~60분 | EAS 서버 빌드 |
| **TestFlight** | Apple 처리 대기 + 내부 배포 | 5~15분 | |
| **Layer 1~5** | iOS 전수 검수 (기능) | 2~3시간 | 실기기 |
| **Layer 6~10** | iOS 전수 검수 (관리/보안) | 1~2시간 | 실기기 |
| **보안 점검** | 6-A~6-G 체크리스트 | 1시간 | |
| **W-01/W-02** | 구독/광고 검수 | 외부 대기 | |
| **App Store 제출** | 최종 제출 | 30분 | 검수 완료 후 |

**예상 총 소요**: Phase 1+2 수정 + 빌드 + 전수 검수 + 보안 점검 = **2~3일** (W-01/W-02 제외)

### 8-C. 크리티컬 패스

```
B-02/R-01/B-05 수정 (즉시)
→ B-03 수정 (반나절)
→ R-02/B-04/B-06 수정 (하루)
→ 자동화 회귀 테스트 (1시간)
→ 운영 영향 확인 (Android + 웹)
→ EAS 빌드 buildNumber 13 (1시간)
→ TestFlight 배포 (15분)
→ Layer 1~10 전수 검수 (실기기, 4~5시간)
→ 보안 점검 (1시간)
→ W-01 완료 대기 → 구독 검수
→ App Store 제출
```

### 8-D. 재발 방지 체계 요약

| 규칙 ID | 규칙 내용 | 적용 시점 |
|---------|-----------|-----------|
| COMMON-1 | 화면 리뉴얼 시 iOS 수정사항 체크리스트 미리 작성 | 리뉴얼 작업 시작 전 |
| COMMON-2 | iOS 전용 수정에 코드 주석 명시 (어떤 버그, 어떤 파일) | 수정 코드 작성 시 |
| COMMON-3 | 리뉴얼 PR에 "iOS 수정사항 포함 확인" 체크 필수 | PR 생성 시 |
| COMMON-4 | TestFlight 빌드 전 iOStest.md 수정 완료 항목 전체 재검증 | 빌드 전 |
| R-01-1 | DatePicker 변경 시 라이트/다크 각각 스크린샷 비교 | DatePicker 관련 작업 시 |
| R-02-1 | 광고 로드 여부와 UI 노출 분리 (버튼은 항상 표시) | 광고 관련 UI 작업 시 |
| R-02-2 | TestFlight 빌드에 EXPO_PUBLIC_USE_TEST_ADS=true 포함 | eas.json 관리 시 |

---

*최종 업데이트: 2026-05-05*  
*기준 버전: iOS 1.0.0 (buildNumber 12)*  
*다음 검토: buildNumber 13 TestFlight 배포 후 Layer 1~10 완료 시*
