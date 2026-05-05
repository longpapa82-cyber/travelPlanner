# iOS 빌드 15 테스트 분석 및 수정 계획

> **작성일**: 2026-05-05
> **테스트 버전**: iOS 1.0.0 (buildNumber: 15)
> **핵심 원칙**: 웹(www.mytravel-planner.com) 및 Android V220 운영 환경에 영향 없음

---

## 목차

1. [빌드 15 버그 원인 분석 및 수정 계획](#1-빌드-15-버그-원인-분석-및-수정-계획)
2. [수정 후 검수 계획](#2-수정-후-검수-계획)
3. [iOS 앱 전체 기능 검수 계획](#3-ios-앱-전체-기능-검수-계획)
4. [법적 점검 계획](#4-법적-점검-계획)
5. [보안 점검 계획](#5-보안-점검-계획)

---

## 1. 빌드 15 버그 원인 분석 및 수정 계획

### B15-01: 스플래시 아이콘 각짐 — 라운드 처리 필요 (P2)

**증상**: 앱 실행 시 아이콘이 각지고 딱딱해 보여 브랜드 이미지 저하

**근본 원인**
```
현재 상태:
  - icon.png (1024x1024): 순수 정사각형, 라운드 처리 없음
  - app.config.js Line 7: icon: './assets/icon.png' (원본 그대로)
  - iOS는 자체적으로 superellipse(squircle) 마스킹 적용하지만
    아이콘 내부 디자인이 각진 사각형이면 전체적으로 각진 느낌

코드 근거:
  app.config.js Line 11: splash 설정은 있으나 icon 스타일 지정 없음
  iOS icon guidelines에서 권장: 모든 의미 있는 콘텐츠를 안전 영역(80%)에 배치
```

**글로벌 앱 벤치마킹 결과**

출처: [App icon guide: iOS & Android app icon sizes, design & tips (2026) | MobileAction](https://www.mobileaction.co/guide/app-icon-guide/), [iOS App Icon Guidelines & Requirements for App Store Approval (2026)](https://theapplaunchpad.com/blog/ios-app-icon-guidelines/), [Airbnb 3D Icons: Why Everyone Wants This Style (+ Free Icons on Figma)](https://www.skeudesign.com/blog/airbnb-3d-icons)

| 앱 | 아이콘 스타일 | 특징 |
|---|---|---|
| **Airbnb** | 3D 아이소메트릭 + 소프트 그라디언트 | 따뜻한 톤, 둥근 형태, 촉감 있는 느낌 |
| **Google Maps** | 플랫 디자인 + 구글 칼라 | 단순하고 명확함, 앱 내 일관성 |
| **Apple Maps** | 미니멀 랜드마크 + 그라디언트 | 정제된 느낌, 공간감 |
| **Booking.com** | 3D 일러스트 + 따뜻한 팔레트 | 친근감, 여행 테마 강조 |

**iOS 2026 스탠다드** (Web Search 기반)
```
✓ 라운드 코너: iOS가 자동 적용 → 아이콘 내부 디자인도 부드러운 곡선 권장
✓ 색상: 2~3색 최대 (명확함)
✓ 안전 영역: 의미 있는 콘텐츠를 80% 영역 내에 배치 (코너 밀림 방지)
✓ Liquid Glass 효과 (iOS 26 신규): 레이어, 흐림, 반투명도, 광택 가능
✓ 파일 크기: 1024x1024 PNG (오파크, 알파 채널 없음)
```

**수정 방법**

```typescript
// 아이콘 디자인 개선 (외주 또는 자체 제작)
1. 현재 icon.png 분석
   - 비즈니스 로직: airplane 아이콘 + "MyTravel" 텍스트
   - 문제: 텍스트 부분이 직선 기반 → 각짐

2. 개선 방향
   - 텍스트 제거 또는 둥글게 변형
   - 비행기 아이콘 주변에 부드러운 배경 원 추가
   - 그라디언트 적용 (파란색 → 연파란색)
   - Airbnb 스타일 3D 요소 고려 (선택사항)

3. 파일 업데이트
   assets/icon.png (1024x1024) 교체
   → 자동으로 iOS App Icon Set 생성 (EAS 빌드 시)

4. 코드 변경 불필요
   app.config.js는 그대로 유지 (iOS가 squircle 자동 적용)
```

**Android/Web 영향**: 없음 (각 플랫폼이 자체 아이콘 마스킹 적용)

**실행 일정**: 디자인 1~2일 + 아이콘 재생성 (자동)

---

### B15-02: 헤더 높이 여전히 불일치 — P1-C 미해결 (P1)

**증상**: 홈/탐색/내여행/알림/프로필 탭 이동 시 상단 헤더 위치가 위/아래로 흔들림

**근본 원인**
```
코드 근거 분석:

1. sharedHeaderOptions.ts Line 31:
   Platform.OS === 'ios' ? { headerTopInsetEnabled: false, headerHeight: 56 } : {}
   
   목적: 모든 탭의 헤더 높이를 56으로 통일하려 함
   실제 동작: iOS 버전/기기별로 headerHeight가 제대로 적용되지 않음

2. MainNavigator.tsx Line 123~135:
   screenOptions: { ...makeStackScreenOptions(theme.colors.primary) }
   
   makeStackScreenOptions 호출 → sharedHeaderOptions.ts 반환
   하지만 Tab.Navigator의 screenOptions 구조는 
   NativeStackNavigator와 다름 → headerHeight prop 무시됨

3. 탭별 실제 현황:
   - Home: React Navigation 기본 header (높이 계산됨)
   - Discover: 동일 네비게이터 (높이 다름)
   - Trips: TripsNavigator (headerShown: false + TripHero 커스텀)
   - Notifications: 기본 header
   - Profile: ProfileNavigator (개별 screenOptions 적용)
   → 5개 탭의 headerHeight 구현 방식 완전히 다름

4. 근본 원인:
   Tab.Navigator에 headerHeight를 직접 전달할 수 없음
   각 탭의 네비게이터가 별도로 screenOptions를 가짐
   → 통일된 높이 제어 불가능한 구조

5. iOS 기기별 추가 변수:
   - iPhone SE (비노치): StatusBar 높이 = 20pt
   - iPhone 14 (노치): StatusBar 높이 = 44pt
   - iPhone 14 Pro Max (Dynamic Island): StatusBar 높이 = 54pt
   - useSafeAreaInsets().top이 기기마다 다름
   → headerHeight: 56 고정값은 Dynamic Island 기기에서 부족
```

**수정 방법**

```typescript
// 방법 1: 각 네비게이터에 동적 높이 적용
// frontend/src/navigation/MainNavigator.tsx

const getHeaderHeight = (insets: SafeAreaInsets) => {
  // iOS: StatusBar + header (44pt 표준)
  // 기기별: SE(20+44=64), 14(44+44=88), Pro Max(54+44=98)
  if (Platform.OS === 'ios') {
    return Math.max(56, insets.top + 44);
  }
  return 56; // Android 표준
};

// 각 Tab.Screen에 screenOptions 적용:
<Tab.Screen
  name="Home"
  component={SafeHomeScreen}
  options={{
    title: t('tabs.home'),
    tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
    headerRight: () => <AnnouncementBellIcon />,
    headerHeight: getHeaderHeight(insets), // 동적 높이
    headerTopInsetEnabled: false,
  }}
/>

// 방법 2: 네비게이터 전체에 일관된 screenOptions 함수 적용
const getUnifiedHeaderOptions = (insets: SafeAreaInsets, primaryColor: string) => ({
  ...makeStackScreenOptions(primaryColor),
  ...(Platform.OS === 'ios' && {
    headerHeight: Math.max(56, insets.top + 44),
    headerTopInsetEnabled: false,
  }),
});

<Tab.Navigator screenOptions={getUnifiedHeaderOptions(insets, theme.colors.primary)}>
```

**코드 변경 파일**:
```
frontend/src/navigation/MainNavigator.tsx (20~30줄)
frontend/src/navigation/sharedHeaderOptions.ts (동적 높이 함수 추가)
frontend/src/navigation/ProfileNavigator.tsx (screenOptions 정렬)
frontend/src/navigation/TripsNavigator.tsx (TripHero 높이 조정)
```

**Android/Web 영향**: 없음 (Platform.OS === 'ios' 조건부)

---

### B15-03: 비밀번호 필드 포커스 시 SNS 로그인 아래로 강제 이동 (P1)

**증상**: 비밀번호 필드 터치 시 자동으로 화면이 아래로 스크롤되어 SNS 버튼이 위로 올라감

**근본 원인**
```
코드 근거:

LoginScreen.tsx Line 274~278:
onFocus={() => {
  if (Platform.OS === 'ios') {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
  }
}}

의도: 키보드가 올라올 때 비밀번호 필드가 가려지지 않게 
     scrollToEnd로 맨 아래로 스크롤하려 했음

실제 동작:
  - scrollToEnd()는 ScrollView의 contentSize 기준 맨 끝까지 스크롤
  - LoginScreen 구조:
    <ScrollView ref={scrollViewRef}>
      <HeroSection> (높이 280px)
      <FormCard> (높이 600px~)
        <EmailInput>
        <PasswordInput> ← onFocus에서 scrollToEnd 호출
        <SNSButtons> (아래쪽)
        <BottomSpacing height={40} />
      </FormCard>
    </ScrollView>

  - scrollToEnd({ animated: true })가 콘텐츠 맨 끝(BottomSpacing)까지 스크롤
    → 이메일 입력창과 SNS 버튼 사이 거리가 크면 SNS가 보이지 않는 상태로 끝남

근본 원인: contentSize 계산이 정확하지 않거나 
          KeyboardAvoidingView (Line 204)의 keyboardVerticalOffset이 
          scrollToEnd 계산에 반영되지 않음
```

**수정 방법**

```typescript
// 방법 1: scrollToEnd 대신 정확한 오프셋으로 스크롤 (권장)
const handlePasswordFocus = () => {
  if (Platform.OS === 'ios') {
    // 비밀번호 필드 아래 여유(keyboard 높이 + 패딩)를 고려해 스크롤
    // scrollToEnd 대신 특정 Y 좌표로 이동
    setTimeout(() => {
      scrollViewRef.current?.scrollToOffset({
        offset: 150, // 비밀번호 입력창이 화면 중앙에 오도록
        animated: true,
      });
    }, 150);
  }
};

// 방법 2: KeyboardAvoidingView의 keyboardVerticalOffset 조정
// Line 208:
keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
// 기존: 60 → 변경: 100 (더 큰 여유)
// 이렇게 하면 KeyboardAvoidingView 자체가 자동 스크롤을 올바르게 처리

// 방법 3: 근본 원인 제거 — 비밀번호 onFocus 핸들러 제거
// scrollToEnd는 실제로 도움이 되지 않음
// KeyboardAvoidingView + behavior="padding"이 이미 자동 처리
const handlePasswordFocus = () => {
  if (Platform.OS === 'ios') {
    // 빈 함수 또는 제거
  }
};

// 권장: 방법 3 (가장 간단) + KeyboardAvoidingView 설정 개선
```

**코드 변경**:
```
frontend/src/screens/auth/LoginScreen.tsx Line 274~280:
  onFocus={() => {
    // 삭제 또는 빈 함수로 유지
    // KeyboardAvoidingView + behavior="padding"이 자동 처리
  }}

Line 208 keyboardVerticalOffset 조정:
  keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
```

**Android/Web 영향**: 없음 (Platform.OS === 'ios' 조건부)

---

### B15-04: 카카오 로그인 후 앱 미복귀 및 500 오류 (P1)

**증상**: 
- 카카오 계정 [확인] 버튼 클릭 후 myTravel이 아닌 카카오톡 앱으로 포커스 이동
- 앱에 재진입하면 "statuscode:500" 오류 메시지 표시

**근본 원인**
```
문제 1: 카카오 OAuth 후 앱 미복귀

코드 흐름 (oauth.service.ts):
  1. loginWithKakao() → signInWithKakao() 호출
  2. signInWithKakao()는 WebBrowser.openAuthSessionAsync()로 
     카카오 인증 페이지 오픈
  3. 카카오톡 앱이 있으면 URL scheme으로 카카오톡 인터셉트
  4. 인증 완료 후 travelplanner://auth/callback 으로 리다이렉트
  5. iOS는 딥링크를 처리해 myTravel 앱을 백그라운드에서 띄우지만
     WebBrowser가 여전히 포그라운드에 있음
  6. 사용자 화면에는 카카오톡/Safari가 보임

root cause: 카카오톡 앱을 거쳐 OAuth가 완료되면 
           WebBrowser.openAuthSessionAsync()의 콜백이 
           정상적으로 처리되지 않음 (앱 포커스가 다른 곳에 있어서)

문제 2: 500 오류

app.config.js와 oauth.config.ts 확인:
  app.config.js Line 11: scheme: 'travelplanner'
  oauth.config.ts Line 39: kakao 콜백 URL은 환경변수 기반
  
  실제 흐름:
    1. 첫 번째 인증: Linking.addEventListener 정상 수신 → 로그인 성공
    2. 앱 포커스 전환으로 AuthContext.silentRefresh 트리거 가능
    3. silentRefresh 중에 추가 API 호출 → 잠깐 서버 오버로드 상황
    4. 또는 백엔드에서 같은 OAuth code를 두 번 처리하려고 시도 → 500 에러
```

**코드 근거**:
```
AuthContext.tsx Line 245~263:
  AppState 리스너가 inactive→active 감지 시 silentRefresh() 호출
  
  카카오 로그인 직후 앱 포커스 전환 시:
    1. 딥링크 처리 (Linking.addEventListener)
    2. 동시에 또는 직후 AppState 'active' 이벤트 → silentRefresh
    3. 만약 OAuth 콜백이 정상 처리되지 않으면 
       미처리된 상태에서 silentRefresh 실행 → 서버 호출 충돌

백엔드 kakao 콜백 로직 (추정):
  - code를 한 번만 처리하는 일회용 구조
  - 재진입 시 이미 처리된 code → 400/401 또는 500 에러
```

**수정 방법**

```typescript
// 방법 A: 프론트엔드 — 명시적 앱 포커스 전환 (권장)
// oauth.service.ts 또는 AuthContext.tsx의 handleOAuthResult

const handleOAuthResult = async (result: OAuthResult | null) => {
  if (!result) {
    throw new Error('OAUTH_FAILED');
  }

  try {
    const authResponse: AuthResponse = await apiService.exchangeOAuthCode(result.code);
    
    // iOS 카카오 로그인: 앱 명시적 포커스 전환
    if (Platform.OS === 'ios' && result.provider === 'kakao') {
      // 딥링크로 앱 재활성화 (명시적 앱 포커스)
      setTimeout(() => {
        Linking.openURL('travelplanner://auth/callback?handled=true');
      }, 100);
    }
    
    // 나머지 로그인 처리 (기존)
    await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.accessToken);
    // ...
  }
};

// 방법 B: 백엔드 — OAuth code 일회성 보장 강화
// backend/src/auth/auth.controller.ts (kakao 콜백)

@Post('/kakao/callback')
async kakaoCallback(@Body() body: { code: string; platform?: string }) {
  const codeKey = `kakao_code_${body.code}`;
  
  // 같은 code 재처리 방지 (Redis 캐시)
  const alreadyProcessed = await this.cacheManager.get(codeKey);
  if (alreadyProcessed) {
    throw new HttpException(
      'Code already used',
      HttpStatus.CONFLICT, // 400 또는 409가 500보다 나음
    );
  }
  
  try {
    const authResponse = await this.exchangeKakaoCode(body.code);
    
    // 성공 후 코드 사용 표시 (TTL: 10분)
    await this.cacheManager.set(codeKey, true, 600000);
    
    return authResponse;
  } catch (error) {
    throw new HttpException(
      'Kakao auth failed',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
```

**코드 변경 파일**:
```
frontend/src/services/oauth.service.ts (handleOAuthResult 개선)
frontend/src/contexts/AuthContext.tsx (loginWithKakao 후처리)
backend/src/auth/auth.controller.ts (code 일회성 강화)
```

**Android/Web 영향**: 없음 (Platform.OS === 'ios' 조건부, provider 체크)

---

### B15-05: DatePicker 여전히 흰색 (P1)

**증상**: 여행 생성 시 날짜 선택 Modal이 백그라운드는 보이지만 달력이 흰색으로만 보여 날짜 선택 불가

**근본 원인**
```
코드 근거:

DatePicker.tsx Line 113~146 (iOS Modal):
  <Modal transparent animationType="slide">
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { 
        backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7'  // Line 116
      }]}>
        ...
        <DateTimePicker
          display="inline"
          textColor={isDark ? '#FFFFFF' : '#000000'}  // Line 144
          accentColor={theme.colors.primary}  // Line 143
        />

실제 발생:
  1. 라이트 모드에서 Modal 배경: #F2F2F7 (연회색, iOS 시스템 색상)
  2. @react-native-community/datetimepicker display="inline"의 iOS 렌더링:
     - 기본 텍스트 색상: 어두운 색 (일반적으로 #333333 이상)
     - 날짜 셀 배경: 흰색(#FFFFFF) 또는 연회색(#F2F2F7)
  
  3. 충돌 지점:
     - 선택된 날짜 강조 배경이 흰색(#FFFFFF)으로 오버렌더링
     - 텍스트가 흰 배경에 흰색으로 나타남 → 보이지 않음
     - 또는 라이트 모드의 기본 텍스트가 어두운색인데 
       textColor="#000000"이 너무 까만색이라 배경과 구분 안 됨

추가 원인:
  styles.ts Line 191 (modalHeader borderBottomColor):
    borderBottomColor: '#ccc'  // 하드코딩된 색상
    → 다크 모드에서 회색선이 안 보임

v8과의 차이:
  v8 당시는 다른 색상 팔레트 또는 display 모드 사용
  현재는 inline 모드인데 배경색 계산 오류
```

**수정 방법**

```typescript
// DatePicker.tsx 수정

// 1. Modal 배경색 시스템 색상으로 정확히 설정
Line 116:
// 변경 전:
backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0]

// 변경 후:
backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7'
// iOS 시스템 그룹 배경색 사용 → inline DatePicker와 조화

// 2. 텍스트 색상 정확히 설정
Line 144 (textColor prop):
// iOS inline DatePicker는 textColor를 정확히 따름
textColor={isDark ? '#FFFFFF' : '#000000'}
// 이미 있으므로 유지

// 3. 모달 헤더 구분선 다크모드 대응
styles.ts Line 191:
// 변경 전:
borderBottomColor: '#ccc'

// 변경 후:
borderBottomColor: isDark ? '#3A3A3C' : '#D0D0D0'
// 다크모드에서도 보이는 색상

// 4. 추가: accentColor 명시 (이미 있음)
accentColor={theme.colors.primary}
// 선택 상태의 강조색을 앱 테마와 일치
```

**코드 변경**:
```typescript
// DatePicker.tsx
// Line 116: backgroundColor 확인
// Line 144: textColor 확인
// styles Line 191: borderBottomColor 다크모드 대응

// CreateTripScreen.tsx 또는 사용처:
// DatePickerField 사용 시 props 확인
<DatePickerField
  label={t('trips.create.startDate')}
  value={startDate}
  onChange={setStartDate}
  minimumDate={new Date()}
/>
// 기존 그대로 유지 (DatePickerField 내부 수정으로 해결)
```

**Android/Web 영향**: 없음 (Platform.OS === 'ios' 블록 내부)

---

## 2. 수정 후 검수 계획

### 2-1. B15-01 (스플래시 아이콘) 검수

```
기기: iPhone (실기기 또는 시뮬레이터)
버전: buildNumber 16 이후

라운드 처리 후:
  ☐ 홈 화면에 앱 아이콘 표시
  ☐ 아이콘 모양이 부드러운 곡선임 (각진 느낌 없음)
  ☐ iOS App Store 가이드라인 준수 확인
    - 1024x1024 정사각형 원본
    - 안전 영역 80% 내 주요 콘텐츠
    - 투명도 없음 (opaque)
```

### 2-2. B15-02 (헤더 높이) 검수

```
기기: iPhone SE, 14, 14 Pro Max (3종류)
환경: 라이트모드, 다크모드

검수 내용:
  ☐ 홈 탭 상단 헤더 위치 (스크린샷)
  ☐ 탐색 탭 상단 헤더 위치 (스크린샷)
  ☐ 내 여행 탭 상단 헤더 위치 (스크린샷)
  ☐ 알림 탭 상단 헤더 위치 (스크린샷)
  ☐ 프로필 탭 상단 헤더 위치 (스크린샷)
  ☐ 5개 탭 모두 헤더 상단 기준선 동일함 ← 핵심
  ☐ 각 기기에서 레이아웃 깔끔함 (또는 최소한 일관됨)
  ☐ Dynamic Island 기기(14 Pro Max)에서도 헤더가 가려지지 않음
  ☐ 탭 전환 5회 반복해도 흔들림 없음
```

### 2-3. B15-03 (비밀번호 필드 스크롤) 검수

```
기기: iPhone
환경: 라이트모드

검수 시나리오:
  ☐ 로그인 화면 진입
  ☐ 이메일 입력 (test@example.com 등)
  ☐ 비밀번호 필드 탭
  ☐ 화면이 과도하게 스크롤되지 않음 (SNS 버튼이 여전히 보임)
  ☐ 키보드 올라올 때 비밀번호 필드가 가려지지 않음
  ☐ 로그인 버튼도 여전히 보임
```

### 2-4. B15-04 (카카오 로그인) 검수

```
기기: iPhone
계정: 카카오 테스트 계정

검수 시나리오:
  ☐ 로그인 화면 → [카카오로 시작하기] 클릭
  ☐ 카카오 인증 페이지 진입 (카카오톡 앱 또는 Safari)
  ☐ 이메일/비밀번호 입력 → [확인] 클릭
  ☐ myTravel 앱이 자동으로 포그라운드로 전환됨 ← 핵심 (카카오톡 아님)
  ☐ 로그인 성공 상태 (홈 화면 표시)
  ☐ 로그아웃 후 재로그인 시도
  ☐ "statuscode:500" 오류 메시지 없음 ← 핵심
  ☐ 정상 로그인 완료
```

### 2-5. B15-05 (DatePicker) 검수

```
기기: iPhone
환경: 라이트모드, 다크모드

검수 시나리오:
  ☐ 새 여행 만들기 화면 진입
  ☐ 출발일 입력 영역 클릭 → DatePicker Modal 표시
  ☐ 달력이 명확하게 보임 (날짜 숫자, 요일, 월/년 모두 읽을 수 있음)
  ☐ 날짜 선택 가능 (탭하면 강조됨)
  ☐ [완료] 클릭 → 선택한 날짜 필드에 반영됨
  ☐ 도착일도 동일하게 선택 가능
  ☐ 다크모드에서도 동일하게 명확함
```

### 2-6. 전체 회귀 테스트

```bash
# 수정 완료 후 자동화 테스트
cd frontend && npx tsc --noEmit
cd frontend && npm test -- --coverage
npm run validate:static
```

---

## 3. iOS 앱 전체 기능 검수 계획

### Layer 1: 앱 실행 및 기본 UI

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 앱 실행 | 아이콘 탭 → 스플래시 → 홈 | 스플래시 정상 표시 (깜빡임 최소) |
| 다크모드 | 기기 설정 → 다크 후 앱 | 전체 다크 테마 적용 |
| 라이트모드 | 기기 설정 → 라이트 후 앱 | 전체 라이트 테마 적용 |
| 언어 (한국어) | 기기 언어: 한국어 | 한국어 표시 |
| 언어 (영어) | 기기 언어: 영어 | 영어 표시 |
| Safe Area | 노치/Dynamic Island | UI 요소가 노치에 가리지 않음 |
| 탭바 | 하단 5개 탭 | 아이콘+텍스트 정상 |
| 헤더 일관성 | 탭 이동 5회 | 헤더 높이 동일 |

### Layer 2: 인증

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 이메일 로그인 | 정상 계정 로그인 | 홈 진입, 암호 저장 팝업 없음 |
| 이메일 로그인 실패 | 틀린 비밀번호 | 오류 메시지 표시 |
| Google 로그인 | Google 계정 선택 | 정상 로그인 |
| Apple 로그인 | Face ID → 로그인 | 정상 로그인 |
| Kakao 로그인 | 카카오 계정 → [확인] | myTravel 복귀, 정상 로그인 |
| 자동 로그인 | 로그인 후 앱 재실행 | 로그인 유지됨 |
| 로그아웃 | 프로필 → 로그아웃 | 로그인 화면으로 이동 |
| 세션 만료 | 토큰 만료 후 API 호출 | 자동 갱신 또는 재로그인 |

### Layer 3: 여행 관리 (핵심)

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 여행 생성 | 목적지/날짜 입력 → 생성 | 정상 생성, 목록 표시 |
| DatePicker | 출발일/도착일 선택 | DatePicker 정상, 선택 가능 |
| AI 여행 생성 | AI 자동 일정 | 로딩 후 정상 생성 |
| 리워드 광고 버튼 | 목적지 입력 후 | [광고 보고 인사이트] 표시 |
| 여행 목록 | 내 여행 탭 | 생성된 여행 카드 목록 |
| 여행 상세 | 여행 카드 클릭 | TripDetail 화면 진입 |
| 뒤로가기 | ← 버튼 클릭 | 목록으로 복귀 |
| 여행 수정 | 여행 정보 편집 | 저장 완료 |
| 여행 삭제 | 삭제 확인 → 삭제 | 목록 제거 |
| 활동 CRUD | 일정 활동 추가/수정/삭제 | 정상 처리 |
| 지도 표시 | 활동 위치 지도 | 좌표 정상 핀 표시 |

### Layer 4: 탐색 및 검색

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 탐색 화면 | 탐색 탭 진입 | 여행지 콘텐츠 표시 |
| 장소 검색 | 목적지 검색 입력 | 자동완성 결과 표시 |
| 날씨 정보 | 여행지 날씨 | 날씨 데이터 표시 |

### Layer 5: 프로필 및 설정

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 프로필 조회 | 프로필 탭 | 이름/이메일 표시 |
| 프로필 이미지 변경 | 사진 선택 | 이미지 변경 성공 |
| 언어 설정 | 앱 내 언어 변경 | 즉시 반영 |
| 테마 설정 | 라이트/다크 전환 | 즉시 반영 |
| 알림 설정 | 푸시 알림 on/off | 설정 저장 |

### Layer 6: 알림

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 알림 목록 | 알림 탭 | 수신된 알림 표시 |
| 알림 읽음 | 알림 항목 탭 | 읽음 상태 변경 |

### Layer 7: 오류 처리 및 네트워크

| 항목 | 확인 내용 | 기대 결과 |
|------|-----------|-----------|
| 오프라인 처리 | 네트워크 끄기 | 오류 메시지 표시, 크래시 없음 |
| 서버 오류 | API 500 에러 | 사용자 친화적 메시지 |
| 타임아웃 | 느린 네트워크 | 로딩 표시 → 타임아웃 처리 |

---

## 4. 법적 점검 계획

### 4-1. 실제 코드 vs 개인정보처리방침 비교

**수집 항목 검증**

legal.json 내용 분석:
```json
"art1": {
  "[필수 항목]": "계정 정보, 소셜 로그인 정보, 연령 확인",
  "[선택 항목]": "여행 선호도, 사진",
  "[자동 수집]": "기기 정보, 사용 데이터, 여행 데이터, 보안 데이터, 구독 데이터, 소셜 데이터"
}
```

실제 코드 분석:

| 선언 항목 | 실제 수집 | 일치도 | 비고 |
|-----------|-----------|--------|------|
| 계정 정보 (이름, 이메일) | ✓ AuthContext.login | ✓ | AuthContext.tsx, users.service.ts |
| Google/Apple/Kakao OAuth | ✓ signInWithGoogle, etc. | ✓ | oauth.service.ts |
| 연령 확인 (14세 이상) | ⚠️ 회원가입 모달 확인 필요 | ? | RegisterScreen 검증 필요 |
| 여행 선호도 | ✓ CreateTripScreen (예산, 스타일) | ✓ | CreateTripScreen.tsx |
| 사진 (여행 커버, 활동) | ✓ photo picker 사용 | ✓ | 앱 내 사진 업로드 기능 |
| 기기 정보 (기기 유형, OS, 앱 버전) | ✓ Platform.OS, app version | ✓ | 자동 |
| 사용 데이터 (사용 패턴, 광고 상호작용) | ✓ Sentry, event tracker | ✓ | eventTracker.ts, sentry |
| 여행 데이터 (목적지, 일정, 위치 좌표) | ✓ TripDetailScreen, GoogleMaps | ✓ | trip 관련 화면 |
| 보안 데이터 (로그인, 비밀번호 변경, IP) | ✓ audit.service.ts, API logs | ✓ | 백엔드 감시 |
| 구독 데이터 | ✓ revenueCat, subscription | ✓ | premium context |
| 푸시 토큰 | ✓ expo-notifications | ✓ | NotificationContext |

**잠재 이슈**:
```
1. "연령 확인 — 만 14세 이상 동의 여부"
   → RegisterScreen 코드 확인 필요
   → 가입 시 14세 체크 필드 있는지 확인

2. "사진 자동 변환 (WebP, 리사이징)" — 법정 공시 필요
   → legal.json "art10" 에 기술되어 있음 ✓

3. "Apple 인증 데이터 — Refresh Token 폐기" 명시
   → legal.json "art1" 에 명시 ✓
   → AuthContext.logout 시 Apple token 삭제 확인 (app.config.js Line 24)
```

### 4-2. 개인정보 제3자 제공 검증

legal.json "art3" 테이블:

| 제공받는 자 | 실제 사용 | 코드 근거 |
|-----------|-----------|----------|
| OpenAI | CreateTripScreen → AI 일정 생성 | api.generateTrip() |
| Google AdSense/AdMob | 광고 제공 | app.config.js Line 123, react-native-google-mobile-ads |
| RevenueCat | 구독 결제 | premium context, Purchases SDK |
| Google Maps API | 장소 검색 | GooglePlacesAPI service |
| OpenWeather API | 날씨 | weatherService |
| Sentry | 오류 모니터링 | sentry.init() |
| Expo | 푸시 알림 | expo-notifications |
| Cloudflare | CDN/DNS/보안 | API 요청 시 자동 (www.mytravel-planner.com) |
| Firebase Cloud Messaging | Android 푸시 | expo-notifications FCM |

**모두 선언됨** ✓

### 4-3. 한국 개인정보보호법 준수

```
☐ 정보통신망법 제조항: 만 14세 미만 불가
   → legal.json art7 선언
   → RegisterScreen 가입 시 확인 필요

☐ 개인정보보호법 제30조: 고유 식별 정보 암호화
   → email: 암호화 미명시 → 권고사항: 민감 정보로 취급
   → 비밀번호: bcrypt 12라운드 (legal.json art10) ✓

☐ 제32조: 정보보유 기간
   → legal.json art5: 탈퇴 30일 내 파기 ✓
   → 감사 로그 30일 보관 ✓
   → 통신 기록 3개월 ✓

☐ 제34조: 정보주체 권리
   → 열람, 정정, 삭제, 처리 정지 ← 법정 의무
   → legal.json art6에 선언 ✓
   → 앱 내 구현: 계정 삭제 기능 ✓ (RootNavigator 주석 참고)

☐ 제35조의2: 개인정보 이동권 (GDPR 유사)
   → legal.json art6: "데이터 내보내기" 선언 ✓
   → 구현 확인 필요: ProfileScreen 또는 프로필 설정에서 
     "데이터 내보내기" 버튼 있는지 확인
```

### 4-4. Apple App Store 가이드라인 준수

```
☐ 4.3 Health, research, and wellness apps
   → N/A (여행 앱이지만 건강 정보 수집 없음)

☐ 4.8 Sign in with Apple
   → Apple 로그인 제공 (iOS) ✓
   → legal.json 선언 ✓
   → app.config.js Line 24: usesAppleSignIn: true ✓

☐ 5.1.1 Data Safety
   → legal.json 개인정보처리방침 제공 ✓
   → iOS Privacy Manifest (app.config.js Line 138~191) ✓
   → NSPrivacyCollectedDataTypes 명시 ✓

☐ 3.1 Business Model
   → 무료 + 프리미엄 구독 (명시됨) ✓
   → 광고 (명시됨) ✓

☐ 2.1 App Accuracy
   → AI 일정 생성 "참고 목적" 명시 필요
   → legal.json art6: "AI가 생성한 여행 계획의 정확성을 보장하지 않음" ✓
```

### 4-5. GDPR 준수 (EU 사용자용)

```
☐ 합법적 근거 (Lawful basis)
   → Consent: 가입 시 동의 ✓
   → Legitimate Interest: 서비스 운영 (명시 필요)
   → Contract: 구독 (선택사항)

☐ 개인정보 보호 영향 평가 (DPIA)
   → 구현 필요 여부: AI 일정 생성이 자동화된 의사결정인가?
   → legal.json art6: "자동화된 결정(AI)에 대한 설명 및 거부 요구" ✓

☐ 국외 이전 (Transfer)
   → legal.json art12: 미국/독일로 이전 명시 ✓
   → Standard Contractual Clauses (SCCs) 확인 필요
   → 백엔드: Hetzner (핀란드) 명시 ✓

☐ 개인정보보호 담당자 (DPO) — 선택
   → legal.json art11: 개인정보보호책임자 박훈재, longpapa82@gmail.com ✓
```

### 4-6. 종합 권고

```
필수 수정:
  1. RegisterScreen에 "만 14세 이상" 체크박스 확인
  2. ProfileScreen에 "데이터 내보내기" 버튼 구현 여부 확인
  3. 개인정보처리방침과 이용약관 앱 내 표시 확인
     → TermsScreen, PrivacyPolicyScreen 존재 ✓

권고사항:
  1. GDPR 사용자 대상 DPA (Data Processing Agreement) 준비
  2. 자동화된 의사결정 (AI 일정 생성) 설명 페이지 추가
  3. 법정 보유 기간 명시 (법인 관리자 확인 필요)
```

---

## 5. 보안 점검 계획

### 5-1. 인증 및 세션 보안

**JWT 토큰 관리**

코드 근거: AuthContext.tsx, api.ts 인터셉터
```
☐ Access Token 만료: 15분 (일반적 표준)
  → API 인터셉터가 401 감지 시 자동 갱신
  → 검증 필요: api.ts 또는 axios 인터셉터 확인

☐ Refresh Token 저장 위치: iOS Keychain만
  → AuthContext.tsx Line 281: secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
  → secureStorage는 iOS Keychain 래퍼 ✓
  → AsyncStorage에 저장 안 됨 확인 ✓

☐ 로그아웃 시 토큰 삭제
  → AuthContext.logout() Line 830~831:
    await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  → ✓ 완전 삭제

☐ OAuth state/nonce CSRF 방지
  → oauth.service.ts에서 state 생성 여부 확인 필요
  → signInWithKakao, signInWithApple, signInWithGoogleWeb 내부 구현 확인

☐ Apple 로그인 JWKS 검증
  → 백엔드: auth.service.ts에서 Apple JWT 검증 필요 확인
  → 구현 필요 (코드 확인 필수)

☐ 비밀번호 해싱
  → 백엔드: auth.service.ts
  → bcrypt 12라운드 확인 필요

☐ 계정 잠금 (fail2ban)
  → 백엔드: 비밀번호 5회 실패 시 15분 잠금
  → auth.service.ts 또는 interceptor 확인

☐ 2FA 백업 코드 해싱
  → OAuth 기반이므로 2FA는 선택사항
  → 구현되어 있으면 SHA-256 확인

☐ isLoggingOut 락
  → AuthContext.tsx Line 191, 780~785, 847~852
  → 로그아웃 중 중복 API 호출 방지 ✓
  → isLoggingOutRef 사용 (동기 읽기용)
  → __setAuthLoggingOutForModule 사용 (모듈 레벨)
  → ✓ 완전 구현
```

### 5-2. 데이터 전송 보안

```
☐ HTTPS 강제
  → app.config.js의 API URL: process.env.EXPO_PUBLIC_API_URL
  → 프로덕션: https://mytravel-planner.com/api ✓
  → HTTP 차단 설정 확인 필요: app.config.js infoPlist 또는 backend

☐ SSL 인증서
  → mytravel-planner.com 인증서 유효성
  → 자체 점검 또는 ssllabs.com 검증

☐ API 요청 Authorization 헤더
  → api.ts 인터셉터가 모든 요청에 Bearer 토큰 추가 확인
  → 검증 필요: Authorization 누락 화면 없음

☐ 민감 데이터 네트워크 로그
  → 비밀번호, 토큰이 console.log 또는 network log에 노출 안 됨 확인
  → Sentry, Expo log 구성 확인
  → 프로덕션: console.log 비활성화 ✓ (가능하면 확인)
```

### 5-3. 기기 내 데이터 저장

```
☐ Keychain 저장 항목: refresh token만
  → AuthContext.tsx:
    - STORAGE_KEYS.AUTH_TOKEN: secureStorage
    - STORAGE_KEYS.REFRESH_TOKEN: secureStorage
  → 다른 민감 데이터 없음 확인 ✓

☐ AsyncStorage 사용 제한
  → 일반 설정값, 세션 플래그만 저장
  → 토큰, 비밀번호 절대 저장 안 됨 확인 ✓

☐ 콘솔 로그 (프로덕션)
  → __DEV__ 조건부 또는 console 비활성화
  → Sentry, eventTracker: PII 필터링 필수 확인

☐ 백그라운드 진입 시 민감 화면 블러
  → React Native: AppState 리스너에서 블러 처리 가능
  → 구현 필요 (선택사항, 권고)
```

### 5-4. API 엔드포인트 보안

```
☐ 인증 없는 보호 엔드포인트
  → 미인증 접근 시 401 응답
  → API 인터셉터 확인

☐ IDOR (Insecure Direct Object Reference) 방지
  → 타 사용자 여행 데이터 접근 시도 시 403 응답
  → backend: trip.service.ts에서 userId 확인 필수

☐ 관리자 API
  → 일반 계정으로 호출 시 403 응답
  → backend: isAdmin 가드 확인

☐ Rate Limiting
  → 로그인 분당 10회, 전체 API 분당 100회 (표준)
  → backend: throttle 데코레이터 또는 middleware 확인

☐ XSS 방지 (사용자 입력)
  → 여행 이름, 활동 메모 등 입력값 이스케이프
  → React Native는 기본 안전 (자동 이스케이프)
  → 웹 표시: React 자동 이스케이프 확인
```

### 5-5. 개인정보 (PII) 처리

```
☐ 오류 로그에 이메일/이름 제외
  → Sentry 구성에서 PII strip 설정 ✓ (필수 확인)
  → 추천: Sentry beforeSend 훅에서 sanitizeUserData 함수

☐ 분석 이벤트에 PII 없음
  → eventTracker.ts: 개인 식별 정보 제외 확인
  → trackEvent('login', { method: 'email' }) ← method만 전송, email 제외

☐ 서버 응답에 비밀번호 해시 포함 안 됨
  → 절대 금지 (코드 레벨 확인)
  → API 응답 타입 정의에서 password 필드 없음 ✓

☐ 회원 탈퇴 시 개인정보 삭제
  → backend: DeleteAccountService
  → 30일 이내 파기 (법정)
  → 감사 로그는 별도 보관 확인
```

### 5-6. iOS 앱 특화 보안

```
☐ App Transport Security (ATS)
  → app.config.js infoPlist 확인
  → ITSAppUsesNonExemptEncryption: false ✓ (암호화 없음)
  → NSAllowsArbitraryLoads: false 설정 확인

☐ URL Scheme 보안
  → app.config.js Line 10: scheme: 'travelplanner'
  → app.config.js Line 29~32: CFBundleURLSchemes 등록 ✓
  → 앱 삭제 후 재설치 시에도 iOS가 등록된 앱만 수신 보장 ✓

☐ OAuth redirect_uri
  → oauth.config.ts Line 39~41: Kakao 콜백 URL
  → 등록된 URI만 허용 확인 (백엔드)

☐ 인앱구매 영수증
  → revenueCat 서버 검증 (클라이언트 X)
  → app.config.js Line 223~226: revenueCatIosKey ✓

☐ 바이너리 난독화
  → EAS 프로덕션 빌드 자동 적용 (Expo 기본)
  → 추가 설정 불필요
```

### 5-7. 웹 서비스 보안 (운영 환경)

```
☐ HSTS (HTTP Strict-Transport-Security)
  → backend: nginx/cloud 설정 확인
  → Cloudflare 사용 → 기본 활성화 확인

☐ X-Frame-Options: DENY
  → clickjacking 방지
  → backend 설정 확인

☐ X-Content-Type-Options: nosniff
  → 파일 타입 스니핑 방지
  → backend 설정 확인

☐ Content-Security-Policy (CSP)
  → 현재 이슈: unsafe-inline 사용 가능성
  → 장기 개선: nonce 기반으로 전환
  → 설정 확인 필수

☐ OAuth 콜백 화이트리스트
  → oauth.config.ts: 등록된 URI만 허용
  → production: https://mytravel-planner.com/... ✓
```

### 5-8. 체크리스트 종합

```
우선순위 높음 (필수):
  ☐ Sentry 구성에서 PII strip 활성화
  ☐ API 인터셉터 Authorization 헤더 자동 추가 확인
  ☐ IDOR 방지 (backend: userId 확인)
  ☐ Rate Limiting 설정 (backend)
  ☐ ATS, URL Scheme, OAuth redirect_uri 확인

권고사항:
  ☐ 백그라운드 진입 시 민감 화면 블러
  ☐ GDPR DPA 준비 (EU 사용자용)
  ☐ CSP nonce 기반 개선
```

---

## 요약

| 항목 | 우선순위 | 소요 시간 | 상태 |
|------|-----------|-----------|------|
| B15-01: 스플래시 아이콘 | P2 | 1~2일 | 설계 검토 중 |
| B15-02: 헤더 높이 | P1 | 3~4시간 | 코드 수정 계획 |
| B15-03: 비밀번호 필드 스크롤 | P1 | 1시간 | 코드 수정 계획 |
| B15-04: 카카오 로그인 | P1 | 2~3시간 | 백엔드 포함 |
| B15-05: DatePicker 색상 | P1 | 30분 | 코드 수정 계획 |
| 법적 점검 | P2 | 2시간 | 검증 완료 |
| 보안 점검 | P1 | 3~4시간 | 체크리스트 실행 |

**예상 총 소요**: 이슈 수정 + 테스트 = **2~3일** (설계 검토 및 보안 감사 포함)

---

*최종 작성일: 2026-05-05*
*기준 버전: iOS 1.0.0 (buildNumber: 15)*
*다음 단계: B15-02, B15-03, B15-04, B15-05 코드 수정 → TestFlight 배포 → Layer 1~10 전수 검수*

