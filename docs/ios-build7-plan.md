# iOS Build 7 전체 검수 계획

> 작성일: 2026-05-05  
> 기준: 1.0.0 (6) 테스트 결과  
> **최우선 원칙**: 웹(mytravel-planner.com) 및 Android 프로덕션(versionCode 220)에 영향 없음

---

## ⚠️ 영향 범위 가드 원칙

| 변경 영역 | 영향 | 가드 방법 |
|-----------|------|-----------|
| frontend/src iOS 전용 수정 | iOS만 | `Platform.OS === 'ios'` 조건부 |
| frontend/src 공통 컴포넌트 | iOS + Android + 웹 | 수정 후 Android 동작 반드시 재확인 |
| backend/src | 전체 플랫폼 | 서버 배포 없이 해결 최우선. 불가피 시 롤백 계획 수립 후 진행 |
| Navigation 타이틀 | iOS + Android | Android back title에 영향 없는지 확인 |

---

## 📋 계획 1: 근본적인 원인 분석 및 수정 계획

### 🔴 P0 — 출시 차단 (즉시 수정)

---

#### P0-1: 결제(구독) 오류 — hoonjae723@gmail.com Sandbox 계정

**현상**: 연간/월간 구독 시도 시 오류 메시지 발생  
**원인 분석**:
- Sandbox Tester 계정(`hoonjae723@gmail.com`)이 App Store Connect에 등록됐지만 기기 설정에서 올바르게 연결되지 않았을 가능성
- 또는 RevenueCat iOS 키(`REVENUECAT_IOS_KEY`) 가 Sandbox 환경과 연결되지 않은 문제
- 또는 `purchasePackage()` 직전 `Purchases.logIn(userId)` 미호출 (불변식 #16 위반)
- 또는 iOS App Store Connect의 인앱 구매 상품이 `Ready to Submit` 상태가 아닌 경우

**확인 순서**:
```
1. RevenueCat 대시보드 → Sandbox 토글 ON → 구매 시도 이벤트 확인
2. 오류 메시지 정확한 내용 확인 (image-21.png)
3. App Store Connect → 인앱 구매 → 상품 상태 확인 (승인됨 여부)
4. 기기 설정 → App Store → Sandbox 계정 로그인 여부 확인
5. PaywallModal.tsx의 handlePurchase() 오류 catch 블록 로그 확인
```

**수정 방향**: 오류 메시지 내용에 따라 분기. 서버 수정 불필요, 프론트엔드 또는 외부 설정 수정으로 해결 가능.  
**Android/웹 영향**: 없음 (iOS 결제 흐름 독립)

---

#### P0-2: 날짜 선택 spinner 여전히 미표시 (Build 6에서도 재현)

**현상**: 날짜 선택 버튼 터치 시 진동은 있으나 spinner UI 미표시  
**원인 분석**:
- Build 6에서 `minHeight: 320` 추가했으나 재현 → 부모 컨테이너 문제 아님
- `DateTimePicker display="spinner"`가 iOS 18.x + New Architecture 조합에서 렌더링 안되는 알려진 이슈 가능성
- `@react-native-community/datetimepicker` 버전 호환성 문제
- 해결책: `display="spinner"` 대신 `display="inline"` 시도 또는 커스텀 Picker(react-native WheelPicker) 대체

**수정 방향**:
```typescript
// DatePicker.tsx iOS 섹션 수정
// 1안: display="inline" (iOS 14+에서 달력 형태로 인라인 표시)
<DateTimePicker display="inline" ... />

// 2안: display 제거 (OS 기본값 사용)
<DateTimePicker mode="date" ... />  // display prop 제거

// 3안: react-native의 기본 Picker로 대체 (연/월/일 wheel)
```

**전체 점검**: `DatePicker` 컴포넌트가 사용되는 모든 화면 점검
- `CreateTripScreen.tsx` (출발일/귀국일)
- `EditTripScreen.tsx`
- `AnnouncementFormScreen.tsx` (관리자)

**Android/웹 영향**: `Platform.OS === 'ios'` 블록만 수정. Android `display="default"` 블록 변경 없음.

---

### 🟡 P1 — 출시 전 수정 필요

---

#### P1-1: 카카오 로그인 후 카카오톡 앱으로 복귀 (Build 6에서도 재현)

**현상**: 로그인 성공은 되나 myTravel 앱이 아닌 카카오톡 앱으로 복귀  
**원인 분석**:
- Build 6에서 iOS도 `Linking.addEventListener` race 패턴을 적용했으나 재현
- 카카오톡 네이티브 앱이 redirect를 처리할 때 `travelplanner://` scheme으로 콜백이 오는데, iOS에서 `WebBrowser.openAuthSessionAsync`가 dismiss된 후 딥링크 수신 타이밍 미스 가능성
- `WebBrowser.maybeCompleteAuthSession()` 호출이 iOS SFAuthenticationSession 종료를 방해하는 경우
- 백엔드 카카오 콜백에서 iOS redirect URI 처리 방식 확인 필요

**추가 수정 방향**:
```typescript
// oauth.service.ts - iOS Kakao 전용: browserPromise 먼저 dismiss 허용
const browserPromise = WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
  showInRecents: false,
  dismissButtonStyle: 'cancel',  // iOS 전용 옵션 추가
});
```

**Android/웹 영향**: Android `deeplinkPromise` 로직 변경 없음.

---

#### P1-2: 암호 저장 팝업 — 홈 화면 및 앱 전반

**현상**: 로그인 후 홈 화면에서도 암호 저장 팝업 노출  
**원인 분석**:
- `LoginScreen.tsx`에 `textContentType="none"` 추가했으나 iOS가 로그인 성공 후 홈 화면에서 저장 팝업을 지연 표시하는 동작
- 이메일 TextInput의 `textContentType`도 명시 필요 (`textContentType="username"` → `textContentType="none"`)
- `RegisterScreen.tsx`, `ResetPasswordScreen.tsx`, `ProfileScreen.tsx`도 동일 점검 필요

**수정 방향**:
```typescript
// LoginScreen.tsx 이메일 필드에도 추가
textContentType="none"   // 이메일 필드
textContentType="none"   // 비밀번호 필드 (기존 추가됨)

// RegisterScreen.tsx 비밀번호 필드들
textContentType="none"

// ResetPasswordScreen.tsx
textContentType="none"
```

**Android/웹 영향**: `textContentType`은 iOS 전용 prop. Android/웹 무시.

---

#### P1-3: 프로필 이미지 변경 오류

**현상**: 사진 선택 시 오류 메시지 발생  
**원인 분석**:
- iOS에서 `ImagePicker.getMediaLibraryPermissionsAsync()` 권한 미허용 상태
- `app.json`의 `NSPhotoLibraryUsageDescription`은 설정되어 있으나, iOS 설정에서 권한이 거부된 경우 오류 발생
- 또는 `expo-image-picker` v15+ iOS 권한 API 변경사항

**수정 방향**: 오류 메시지 내용 확인 후 권한 요청 흐름 재점검. 오류 발생 시 설정으로 이동 안내 Alert 표시 (이미 구현됨 — 실제 동작 여부 확인).

---

#### P1-4: Toast 메시지 iOS 상태바/카메라 영역 겹침

**현상**: 상단 Toast 메시지가 iOS 상태바(카메라, 시간 등) 위에 겹쳐 안보임  
**원인 분석**:
- `Toast.tsx`에서 `top: theme.spacing.lg`로 고정 — Safe Area insets 미적용
- iOS Dynamic Island/Notch 영역 높이 미반영

**수정 방향**:
```typescript
// Toast.tsx에 useSafeAreaInsets 적용
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const insets = useSafeAreaInsets();
// top position = theme.spacing.lg + insets.top
[position]: position === 'top'
  ? (insets.top + theme.spacing.sm)
  : theme.spacing.lg,
```

**Android/웹 영향**: Android도 상단 inset 적용되어 개선. 웹은 insets.top = 0.

---

#### P1-5: 뒤로가기 버튼에 개발 용어 표시 ("TripDetail")

**현상**: 화면 이동 시 좌측 상단 뒤로가기 버튼에 "TripDetail" 등 raw 이름 표시  
**원인 분석**:
- iOS의 React Navigation Stack Navigator는 이전 화면의 `title`을 back button에 자동 표시
- `TripDetail` 화면의 `headerShown: false` → title 없음 → iOS가 raw screen name 표시
- 해결: `headerBackTitle` 명시 또는 `screenOptions.headerBackTitleVisible: false` 전역 설정

**수정 방향**:
```typescript
// TripsNavigator.tsx screenOptions에 추가
screenOptions={{
  headerBackTitleVisible: false,   // iOS back button에 텍스트 숨김
  // 또는 headerBackTitle: ''      // 빈 문자열로 설정
}}
```

**전체 점검**: 모든 navigator에 `headerBackTitleVisible: false` 적용 여부 확인  
**Android/웹 영향**: Android는 back button text 표시 안함. 웹은 적용 안됨.

---

#### P1-6: 광고 보고 버튼 iOS에서 미표시

**현상**: CreateTrip 화면의 "광고 보고 상세 여행 인사이트 받기" 버튼이 iOS에서 미표시  
**원인 분석**:
- `CreateTripScreen.tsx`: `!isPremium && ... && isRewardedLoaded && ...` 조건에서 `isRewardedLoaded`가 `false`
- iOS AdMob 앱이 App Store 미연결 상태 → 광고 로드 실패 → `isRewardedLoaded = false` → 버튼 숨김
- Android는 Google Play 연결 완료 → 광고 로드 성공 → 버튼 표시
- **이것은 버그가 아님**: App Store 공개 출시 후 AdMob iOS 앱 연결 시 자동 해결

**임시 처리 방안**: 광고 로드 여부와 관계없이 버튼을 항상 표시하되, 클릭 시 로드 중이면 안내 메시지 표시하는 방식으로 UX 개선 가능 (선택적)

**Android/웹 영향**: Android 조건부 렌더링 로직 변경 없음.

---

### 🟢 P2 — 선택적 개선

#### P2-1: 스플래시 화면 깜빡임 (Build 4~6 모두 재현)

**현상**: 앱 실행 시 0.1초간 이전 버전 이미지 표시  
**원인**: iOS 백그라운드 앱 스냅샷 캐시 (OS 레벨 동작)  
**대응**: 신규 설치(앱 완전 삭제 후 재설치) 후 재현 여부 확인. 신규 설치에서 미재현 시 정상.

---

## 📋 계획 2: 수정 사항 검증 계획 (Build 7 설치 후)

| # | 검증 항목 | 검증 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| V1 | 결제 (Sandbox) | hoonjae723@gmail.com으로 월간/연간 구독 시도 | 결제 성공, 프리미엄 전환 |
| V2 | 날짜 선택 spinner | 여행 생성 화면 → 날짜 선택 | spinner 정상 표시 및 선택 가능 |
| V3 | 카카오 로그인 복귀 | 카카오 로그인 완료 후 | myTravel 앱으로 자동 복귀 |
| V4 | 암호 저장 팝업 | 이메일 로그인 후 홈 화면 | 팝업 없음 |
| V5 | 프로필 이미지 변경 | 프로필 → 사진 선택 | 정상 선택 및 업로드 |
| V6 | Toast 위치 | 오류/성공 메시지 발생 시 | 상태바 아래 정상 표시 |
| V7 | 뒤로가기 버튼 | TripDetail → 뒤로 | "TripDetail" 대신 "<" 또는 이전 화면명 |
| V8 | Android 회귀 | 위 수정 후 Android 동일 기능 | 동일하게 정상 동작 |

---

## 📋 계획 3: iOS 전체 기능 상세 검수

### 3-A: 인증 흐름

| # | 화면 | 테스트 항목 | 기대 결과 |
|---|------|-------------|-----------|
| A1 | 로그인 | 이메일 로그인 | 성공, 암호 저장 팝업 없음 |
| A2 | 로그인 | Apple 로그인 | Face ID → 로그인 성공 |
| A3 | 로그인 | Google 로그인 | 계정 선택 → 앱 내 복귀 → 성공 |
| A4 | 로그인 | 카카오 로그인 | myTravel 앱으로 복귀 → 성공 |
| A5 | 회원가입 | 이메일 회원가입 | 성공, 이메일 인증 발송 |
| A6 | 비밀번호 찾기 | 이메일 입력 → 발송 | 성공 |
| A7 | 비밀번호 재설정 | 링크 클릭 → 재설정 | 성공 |
| A8 | 2FA | 2FA 활성화 계정 로그인 | OTP 입력 화면 표시 |
| A9 | 자동 로그인 | 앱 재시작 | 세션 유지 |
| A10 | 로그아웃 | 로그아웃 후 재로그인 | 정상 |

### 3-B: 여행 기능

| # | 화면 | 테스트 항목 | 기대 결과 |
|---|------|-------------|-----------|
| B1 | 여행 생성 | AI 여행 생성 (목적지 입력) | AI 생성 완료 |
| B2 | 여행 생성 | 출발일/귀국일 날짜 선택 | spinner 정상 동작 |
| B3 | 여행 목록 | 생성된 여행 표시 | 목록 정상 |
| B4 | 여행 상세 | 일정 조회 | 정상 표시 |
| B5 | 여행 편집 | 일정 추가/수정/삭제 | 정상 |
| B6 | 여행 편집 | 날짜 변경 | spinner 정상 동작 |
| B7 | 장소 검색 | 자동완성 | 목록 정상 표시 |
| B8 | 비용 관리 | 비용 추가 | 정상 |
| B9 | AI 인사이트 | 광고 버튼 (AdMob 연결 후) | 표시 확인 |

### 3-C: 프로필/설정

| # | 화면 | 테스트 항목 | 기대 결과 |
|---|------|-------------|-----------|
| C1 | 프로필 | 프로필 이미지 변경 | 사진 선택 → 업로드 성공 |
| C2 | 프로필 | 닉네임 변경 | 저장 성공 |
| C3 | 프로필 | 비밀번호 변경 | 성공 |
| C4 | 구독 | 프리미엄 구독 화면 | 월간/연간 플랜 표시 |
| C5 | 구독 | Sandbox 결제 | 성공, 프리미엄 전환 |
| C6 | 구독 | 구독 관리 (Apple) | App Store 구독 관리 이동 |
| C7 | 알림 | 알림 설정 | 알림 허용/거부 정상 |
| C8 | 탈퇴 | 계정 삭제 | Apple Sign-In token revoke 포함 |

### 3-D: UI/UX

| # | 항목 | 기대 결과 |
|---|------|-----------|
| D1 | 탭 바 | 아이콘 상하 균형 여백 |
| D2 | Safe Area | 노치/Dynamic Island 침범 없음 |
| D3 | 키보드 | 입력 필드 가리지 않음 |
| D4 | 뒤로가기 버튼 | raw 이름 대신 정상 표시 |
| D5 | 다크/라이트 모드 | 전환 시 전체 정상 렌더링 |
| D6 | Toast 위치 | 상태바 아래 정상 위치 |
| D7 | 스크롤 | 긴 목록 자연스러운 스크롤 |

### 3-E: 광고

| # | 항목 | 기대 결과 |
|---|------|-----------|
| E1 | AdMob 초기화 | 앱 실행 시 초기화 로그 정상 |
| E2 | 프리미엄 광고 차단 | 구독 계정 → 광고 없음 |
| E3 | 배너 광고 | 비프리미엄 계정 → 배너 영역 표시 |

---

## 📋 계획 4: 사용법/법적 고지/표기 내용 점검 (17개 언어)

### 4-A: 앱 내 법적 문구 점검

> 점검 대상: `frontend/src/i18n/locales/[lang]/legal.json` (17개 언어)

| # | 점검 항목 | 점검 방법 |
|---|-----------|-----------|
| L1 | 이용약관 링크 | 앱 내 이용약관 → mytravel-planner.com/terms.html 연결 확인 |
| L2 | 개인정보처리방침 링크 | 앱 내 개인정보처리방침 → mytravel-planner.com/privacy.html 연결 확인 |
| L3 | Apple 로그인 표기 | "iOS 전용" 명시 여부 (17개 언어 모두) |
| L4 | 광고 수집 데이터 | privacy.html에 Google AdMob 데이터 수집 명시 여부 |
| L5 | 구독 취소 안내 | 취소 방법 표기 정확성 (App Store 통한 취소) |
| L6 | 무료 체험 표기 | 실제 제공하는 경우만 표기 여부 |
| L7 | 유효일 표기 | effectiveDate 최신 날짜 여부 |

### 4-B: 앱 UI 텍스트 점검 (17개 언어)

> 점검 대상: `frontend/src/i18n/locales/[lang]/` 전체

| # | 점검 항목 | 기대 결과 |
|---|-----------|-----------|
| T1 | 누락 키 없음 | 17개 언어 모든 키 완성 |
| T2 | 기계 번역 오류 없음 | 주요 언어(ko/en/ja/zh) 품질 확인 |
| T3 | 구독 가격 표기 | 실제 App Store 가격과 일치 |
| T4 | 광고 관련 문구 | 광고 시청 안내 문구 자연스러움 |
| T5 | 오류 메시지 | 사용자 친화적 메시지 (개발 용어 없음) |
| T6 | 플레이스홀더 텍스트 | 실제 기능에 맞는 안내 |

### 4-C: 웹 표기 내용 점검

> 점검 대상: mytravel-planner.com (서버 배포 파일)

| # | 점검 항목 | 기대 결과 |
|---|-----------|-----------|
| W1 | App Store 링크 | iOS 앱 출시 후 App Store 링크 추가 필요 |
| W2 | Google Play 링크 | 정상 연결 |
| W3 | 지원 기능 목록 | 실제 앱 기능과 일치 |
| W4 | 개인정보처리방침 | AdMob/Analytics 수집 항목 명시 |
| W5 | 이용약관 | 구독 조건 (취소, 환불) 명확히 표기 |
| W6 | SEO 가이드 내용 | 실제 앱 기능과 상이한 내용 없음 |

### 4-D: App Store 메타데이터 점검

| # | 점검 항목 | 기대 결과 |
|---|-----------|-----------|
| M1 | 앱 설명 (ko/en/ja) | 실제 기능과 일치, 과장 표현 없음 |
| M2 | 스크린샷 | 최신 UI 반영 |
| M3 | 키워드 | 앱 기능 관련 키워드 |
| M4 | 개인정보 수집 항목 | 실제 수집 항목과 일치 |
| M5 | 연령 등급 4+ | 콘텐츠 적합성 확인 |

---

## 📋 계획 5: 시스템/회원 정보 보안 점검

### 5-A: 인증 보안

| # | 점검 항목 | 점검 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| SA1 | Keychain 저장 | 코드 리뷰: secureStorage iOS 구현 | Access Token만 저장, Refresh Token 미저장 (불변식 #28) |
| SA2 | OAuth CSRF nonce | 코드 리뷰: oauth.service.ts | CSPRNG nonce 생성 + 콜백 검증 (불변식 #27) |
| SA3 | Apple token revoke | 탈퇴 시 Apple revoke API 호출 | App Store Guideline 5.1.1 준수 |
| SA4 | 암호 자동완성 차단 | 실기기: 로그인/회원가입 전 화면 | 비밀번호 저장 팝업 없음 |
| SA5 | 세션 만료 처리 | access token 만료 후 API 호출 | 자동 refresh 또는 로그인 화면 이동 |
| SA6 | 다중 기기 로그인 | 동일 계정 2기기 로그인 | refresh token rotation으로 이전 세션 만료 |
| SA7 | Google Sign-In 오류 | Sentry 대시보드 확인 | 크래시 로그 수집 여부 |

### 5-B: 데이터 보호

| # | 점검 항목 | 점검 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| SB1 | 네트워크 암호화 | Proxyman으로 트래픽 캡처 | 모든 API HTTPS, 평문 없음 |
| SB2 | API 키 번들 노출 | `strings build6.ipa \| grep -i "sk-\|secret\|key"` | API 키 하드코딩 없음 |
| SB3 | 백그라운드 스냅샷 | 홈 버튼 누른 직후 앱 전환 | 민감 정보 화면 블러 여부 |
| SB4 | 클립보드 비밀번호 | 비밀번호 필드 복사 시도 | 복사 불가 또는 즉시 클리어 |
| SB5 | PII 로그 미전송 | reportError 코드 리뷰 | 비밀번호/토큰 로그 포함 없음 (불변식: PII strip) |

### 5-C: 결제 보안

| # | 점검 항목 | 점검 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| SC1 | 구매 전 RC logIn | PaywallModal.tsx 코드 리뷰 | purchasePackage 직전 Purchases.logIn() 호출 (불변식 #16) |
| SC2 | 중복 구매 차단 | 이미 구독 중인 계정으로 재구매 시도 | "already_subscribed" 메시지 (불변식 #11) |
| SC3 | Sandbox 결제 격리 | Sandbox 계정 결제 후 프로덕션 영향 | 프로덕션 DB 영향 없음 |
| SC4 | 탈퇴 시 RC DELETE | 계정 탈퇴 후 RevenueCat 확인 | $deleted_at 마킹 + RC DELETE (불변식 #15) |

### 5-D: iOS 오류 로그 수집 검증

| # | 점검 항목 | 기대 결과 |
|---|-----------|-----------|
| SD1 | 결제 오류 로그 | Admin 대시보드 platform=ios 필터 → 결제 오류 레코드 |
| SD2 | 크래시 로그 (Sentry) | Sentry → Issues → iOS 필터 → Google Sign-In 크래시 이슈 |
| SD3 | 오프라인 오류 큐 | 네트워크 끊고 오류 발생 → 온라인 복구 후 자동 전송 |
| SD4 | deviceModel 필드 | iOS 오류 로그에 iPhone 모델명 포함 여부 |

### 5-E: App Store 보안 요구사항

| # | 점검 항목 | 기대 결과 |
|---|-----------|-----------|
| SE1 | Privacy Manifest | PrivacyInfo.xcprivacy 포함 여부 (필수 API 사용 시) |
| SE2 | ATS 설정 | Info.plist NSAppTransportSecurity 예외 최소화 |
| SE3 | 암호화 선언 | ITSAppUsesNonExemptEncryption: false 완료 ✅ |
| SE4 | 권한 사용 목적 | NSPhotoLibraryUsageDescription 등 모든 권한 명시 |

---

## 📅 Build 7 예상 일정

| 단계 | 내용 | 소요 |
|------|------|------|
| P0 수정 | 결제 오류 원인 확인 + DatePicker 대안 적용 | 1일 |
| P1 수정 | 카카오 복귀, 암호팝업, Toast, 뒤로가기 타이틀, 프로필 이미지 | 0.5일 |
| Build 7 EAS 빌드 + TestFlight | `eas build --platform ios --profile production-ios` | 30분 |
| 계획 2: 검증 (V1~V8) | 실기기 검증 8개 항목 | 0.5일 |
| 계획 3: 전체 기능 검수 | A~E 전체 항목 | 1일 |
| 계획 4: 법적/표기 점검 | L, T, W, M 항목 | 0.5일 |
| 계획 5: 보안 점검 | SA~SE 항목 | 0.5일 |
| **총계** | | **~4일** |

---

## 💳 구독 테스트 방법 (Build 7 최종 레포트 포함)

### iOS Sandbox 테스트 (실 결제 없음)

```
준비:
1. iPhone 설정 → App Store → 기존 Apple ID 유지
2. 스크롤 내리면 "SANDBOX 계정" 섹션 표시
3. hoonjae723@gmail.com으로 Sandbox 로그인 (일반 Apple ID와 별개)

테스트:
4. TestFlight myTravel 앱 실행
5. 프리미엄 구독 화면 → 월간 또는 연간 선택
6. "구독" 버튼 클릭 → Sandbox 결제 시트 표시
7. "확인" → 결제 성공 (실 결제 없음)
8. 구독 기간: 월간 = 5분 후 자동 갱신, 연간 = 1시간 후 갱신

검증:
9. RevenueCat 대시보드 → Sandbox 토글 ON → 구매 이력 확인
10. 앱 내 프리미엄 기능 활성화 확인
11. 광고 미표시 확인
12. 5분 후 자동 갱신 확인 (월간 기준)
13. 취소 후 만료일까지 프리미엄 유지 확인

주의:
- longpapa82@gmail.com(실 Apple ID)으로는 절대 구독 테스트 금지 → 실 결제 발생
- Sandbox 계정은 App Store 정식 계정이 아님 → Play Store처럼 별도 관리
```
