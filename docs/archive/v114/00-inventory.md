# V114 알파 테스트 이슈 Frontend 소스 인벤토리

작성일: 2026-04-15  
조사 수준: Very Thorough  
범위: Frontend 소스코드 + i18n + 템플릿

---

## 1. V114-2a CoachMark 좌표 어긋남

### 1.1 CoachMark 컴포넌트 주요 부분
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/components/tutorial/CoachMark.tsx`
- **라인 범위**: 31-99 (좌표 계산 로직)

**구현 요약**:
- `SPOT_PADDING = 12`, `TOOLTIP_GAP = 24` 상수 정의 (라인 31-33)
- Modal 내부에서 spotlight 렌더링 (라인 100-151)
- 웹 데스크톱 모드에서 centerOffset 계산 (라인 69-75)
- `measureInWindow()` 반환값을 직접 사용하여 `spotX`, `spotY` 계산 (라인 77-80)
- 문제점: Modal의 좌표계와 measureInWindow의 뷰포트 좌표계 불일치 가능성

**수정 후보 지점**:
1. 라인 77-80: spotX/spotY 계산 시 Modal 좌표 오프셋 고려
2. 라인 69-75: 웹 데스크톱 모드의 containerOffset 적용이 spotlight에만 적용되고 tooltip에는 별도 처리 (라인 82-84)
3. 라인 95-98: arrowLeft 계산에서 clampedX/clampedW 기반인데, 원본 x/y 좌표계와 혼용

### 1.2 HomeScreen의 createTripRef 측정 로직
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/main/HomeScreen.tsx`
- **라인 범위**: 137-166 (createTripRef, 측정 로직)

**구현 요약**:
- createTripRef를 ScrollView 내부의 Button wrapper View에 할당 (라인 304)
- animationDone 플래그가 true가 되어야 측정 시작 (라인 153)
- requestAnimationFrame 사용하여 paint commit 후 측정 (라인 158-163)
- measureInWindow로 x, y, width, height 획득하여 state 저장

**수정 후보 지점**:
1. 라인 304: ref가 할당된 View가 ScrollView 내부이므로, ScrollView의 offset 고려 필요
2. 라인 158-163: measureInWindow 결과가 뷰포트 좌표임을 명시적으로 주석 추가
3. 라인 204-315: "heroActions" View 내부의 Button이 target인데, 정확히 어느 엘리먼트를 측정하는지 명확히

### 1.3 TutorialContext 제어 로직
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/contexts/TutorialContext.tsx`
- **라인 범위**: 63-64 (showCoachMark 조건)

**구현 요약**:
- showCoachMark는 여러 조건의 AND: loaded, authenticated, verified, !welcomeCompleted, coachCompleted, !coachCompleted (라인 64)
- useSafeAreaInsets 사용하지 않음 (Context 자체는 UI 직접 렌더링 안 함)

**수정 후보 지점**:
1. 라인 64: showCoachMark 조건이 복합적이므로, 실제로는 "welcomeCompleted && !coachCompleted" 만 필요 (코멘트 명확화)

---

## 2. V114-2b 건너뛰기 버튼 텍스트

### 2.1 CoachMark 건너뛰기 버튼
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/components/tutorial/CoachMark.tsx`
- **라인**: 138-139

**구현 요약**:
```tsx
<TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
  <Text style={styles.dismissText}>{t('coach.dismiss')}</Text>
</TouchableOpacity>
```
- i18n 키: `tutorial.coach.dismiss`
- 현재 텍스트: "건너뛰기" (라인 22, `tutorial.json` ko)

**i18n 위치**:
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/i18n/locales/ko/tutorial.json` 라인 22

**수정 후보 지점**:
1. 라인 139: `t('coach.dismiss')` → 이미 "건너뛰기"로 번역됨
2. 라인 225-227: dismissText 스타일 - 색상이 '#94A3B8' (회색)으로 시각적으로 약한 느낌

### 2.2 WelcomeModal의 Skip 버튼 (있는지 확인)
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/components/tutorial/WelcomeModal.tsx` (추정)
- **조사 결과**: 파일명이 명확하지 않음. 코드에서 `<WelcomeModal />` import 있으나 (라인 54, HomeScreen.tsx) 정확한 위치 미확인

**수정 후보 지점**:
1. WelcomeModal.tsx 파일 위치 확인 필요
2. Skip 버튼 있으면 i18n 키 일관성 확인

---

## 3. V114-3 계정 삭제 팝업 하단 흰 공백

### 3.1 DeleteAccountModal (ProfileScreen 내부)
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/main/ProfileScreen.tsx`
- **라인 범위**: 740-770 (Delete Account Modal)

**구현 요약**:
```tsx
<Modal visible={showDeleteConfirm} transparent animationType="slide">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
      {/* Header + Body + Button */}
    </View>
  </View>
</Modal>
```
- modalContent에 고정 높이 없음 (flex 미지정)
- Button이 내부에 있고 하단 패딩 없음

**스타일 분석**:
- `styles.modalContent`: 라인 823-850대에 정의 (파일 크기 관계로 정확한 라인 미확인)
- `styles.modalOverlay`: Modal의 반투명 오버레이

**수정 후보 지점**:
1. modalContent 스타일에 `maxHeight` 또는 명시적 높이 제약 추가
2. modalBody 또는 Button에 `marginBottom` 추가하여 SafeAreaView 기반 하단 여유 확보
3. animationType="slide"가 bottom sheet처럼 동작하는지, flex 레이아웃이 하단 공백을 생성하는지 확인

---

## 4. V114-4a ConsentScreen [동의하고 시작하기] 버튼 하단 밀착

### 4.1 ConsentScreen 버튼 영역
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/consent/ConsentScreen.tsx`
- **라인 범위**: 275-295 (Footer + Button)

**구현 요약**:
```tsx
<View
  style={[
    styles.footer,
    {
      backgroundColor,
      borderTopColor: borderColor,
      paddingTop: 24,
      paddingBottom: Math.max(insets.bottom, 16) + 20,
    },
  ]}
>
  <Button
    onPress={handleSubmit}
    loading={submitting}
    disabled={submitting || !hasAllRequired}
  >
    {hasAllRequired ? ... : ...}
  </Button>
</View>
```

**구현 현황**:
- useSafeAreaInsets() 사용함 (라인 43)
- insets.bottom 반영됨 (라인 282: `Math.max(insets.bottom, 16) + 20`)
- paddingTop도 24로 명시적 지정

**수정 후보 지점**:
1. 라인 282: `Math.max(insets.bottom, 16) + 20` 값이 충분한지 실제 기기에서 테스트 필요
2. Button 컴포넌트의 내부 padding이 추가로 있는지 확인
3. ScrollView의 contentContainerStyle이 footer를 포함하는지 확인 (라인 159-162)

---

## 5. V114-4b/4c 개인정보 처리방침 중복 "(필수)" 텍스트 + 필수 아이콘

### 5.1 ConsentScreen 필수 항목 렌더링
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/consent/ConsentScreen.tsx`
- **라인 범위**: 198-227 (RequiredConsents Section)

**구현 요약**:
```tsx
{requiredConsents.map((consent, index) => {
  const isSelected = selectedConsents[consent.type];
  const translationKey = `types.${consent.type}`;
  
  return (
    <TouchableOpacity ...>
      <Icon name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} ... />
      <Text style={[styles.consentLabel, { color: textPrimary, flex: 1 }]}>
        {t(`${translationKey}.title`)}
      </Text>
      <View style={[styles.requiredBadge, { backgroundColor: colors.error.main }]}>
        <Text style={styles.requiredText}>{t('required')}</Text>
      </View>
    </TouchableOpacity>
  );
})}
```

**i18n 분석**:
- 라인 219: `t('required')` → `/i18n/locales/ko/consent.json` 라인 4: "필수"
- 라인 200: `t('types.${consent.type}.title')` 사용

**consent.json 내용** (라인 16-51):
- `types.privacy_required.title`: **"개인정보 처리방침 (필수)"** ← 이미 (필수) 포함됨!
- 라인 221-223: 추가로 Badge에서 `t('required')` 렌더링 → **중복**

**수정 후보 지점**:
1. consent.json 라인 23에서 title을 "개인정보 처리방침"으로 변경 (괄호 제거)
2. 또는 라인 221-223의 requiredBadge를 isRequired 조건으로만 표시하고 중복 제거
3. 라인 221의 badge 스타일이 아이콘처럼 보이는지 (원형 뱃지 vs 텍스트)

---

## 6. V114-5 수동 생성 진입 시 AI 남은 횟수 오표기

### 6.1 CreateTripScreen AI 모드 정보 표시
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/trips/CreateTripScreen.tsx`
- **라인 범위**: 1565-1603 (AI Info Section)

**구현 요약**:
```tsx
{planningMode === 'ai' && (
  <View ...>
    {isPremium || isAdmin ? (
      <Text>{t('create.aiInfo.unlimited', ...)}</Text>
    ) : aiTripsRemaining === -1 ? (
      <Text>{t('create.aiInfo.loading', ...)}</Text>
    ) : (
      <Text>
        {aiTripsRemaining > 0
          ? t('create.aiInfo.remaining', { remaining: aiTripsRemaining, total: aiTripsLimit > 0 ? aiTripsLimit : 3 })
          : t('create.aiInfo.limitReached', { total: aiTripsLimit > 0 ? aiTripsLimit : 3 })}
      </Text>
    )}
  </View>
)}
```

**문제**:
- 라인 1606: `planningMode === 'ai'` 조건이므로 manual 모드에서는 표시 안 됨
- 그런데 manual 모드로 진입할 때 AI 남은 횟수가 표시되는 이슈가 있다면, 다른 곳에서 렌더링 중

**수정 후보 지점**:
1. 라인 143-148: isAiLimitReached일 때 자동으로 manual로 전환됨
2. 만약 AI 정보가 manual 모드에서도 보인다면, 라인 1565 조건 확인
3. i18n `trips.ko.json` 라인 64: `"remaining": "이번 달 AI 자동 생성 {{remaining}}/{{total}}회 남음"` ← 올바른 형식

---

## 7. V114-6b 구독 회원 남은 횟수 "월 30회"

### 7.1 SubscriptionScreen 사용량 표시
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/main/SubscriptionScreen.tsx`
- **라인 범위**: 148-171 (AI Trip Usage Section - Free Users Only)

**구현 요약**:
```tsx
{!isPremium && (
  <View style={[styles.section, ...]}>
    <Text style={[styles.sectionTitle, ...]}>{t('paywall.aiLimitTitle')}</Text>
    <View style={styles.usageBar}>
      <View style={[styles.usageBarBg, ...]}>
        <View style={[styles.usageBarFill, { width: `${Math.min(100, (aiTripsUsed / 3) * 100)}%`, ... }]} />
      </View>
      <Text style={[styles.usageText, ...]}>
        {aiTripsUsed} / 3 {t('paywall.aiUsed')}
      </Text>
    </View>
  </View>
)}
```

**문제 분석**:
- 라인 167: "3" 하드코딩 (aiTripsRemaining/aiTripsLimit 미사용)
- 프리미엄 회원 정보가 화면 상단 (라인 54-121)에만 있고, "월 30회" 텍스트 없음
- i18n `premium.json` 라인 19: `"unlimitedAi": "월 30회 AI 여행 계획"`

**수정 후보 지점**:
1. 라인 54-121: isPremium이 true인 경우, aiTripsRemaining 또는 aiTripsLimit 표시 로직 없음
2. Feature Comparison (라인 190)에서 `"30/mo"` 하드코딩됨 - 구독 상태 변경 시 업데이트 필요
3. PremiumContext에서 aiTripsLimit을 구독 상태에 맞게 반환하는지 확인

---

## 8. V114-6a 관리자 구독 "다음 결제일 시간까지"

### 8.1 SubscriptionScreen 결제일 표시
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/main/SubscriptionScreen.tsx`
- **라인 범위**: 93-109 (Plan Metadata - NextBillingDate)

**구현 요약**:
```tsx
{expiresAt && (
  <View style={styles.planMetaRow}>
    <Icon
      name={planType ? 'autorenew' : 'calendar-end'}
      size={16}
      color="#FFFFFFCC"
    />
    <Text style={[styles.planMetaText, { color: '#FFFFFFCC' }]}>
      {planType
        ? t('status.renewsOn', {
            defaultValue: '다음 결제일: {{date}}',
            date: formatDate(expiresAt),
          })
        : t('status.expiresOn', { date: formatDate(expiresAt) })}
    </Text>
  </View>
)}
```

**구현 현황**:
- planType이 존재하면 renewsOn (다음 결제일), 없으면 expiresOn (만료일)
- formatDate (라인 46-48): `new Date(dateStr).toLocaleDateString()`
- i18n `premium.json` 라인 51: `"renewsOn": "다음 결제일: {{date}}"` ← 시간 정보 없음

**문제**:
- "다음 결제일 시간까지" 라는 텍스트가 없음. 시간 부분만 누락된 것 같음.

**수정 후보 지점**:
1. 라인 48: formatDate 함수가 date만 반환. toLocaleString() 사용 시 시간 포함 가능
2. i18n 라인 51: `"renewsOn"` 번역이 "다음 결제일: {{date}}"이므로, 시간 포함 원하면 formatDate 수정 필요
3. expiresAt이 ISO datetime 문자열인지 확인 (백엔드 응답 확인 필요)

---

## 9. V114-1 비번 재설정 링크 웹으로 가는 문제

### 9.1 이메일 템플릿 resetUrl 생성
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/backend/templates/email/reset-password-ko.hbs`
- **라인**: 31, 40

**구현 요약**:
```handlebars
<a href="{{resetUrl}}" target="_blank" ...>비밀번호 재설정</a>
...
{{resetUrl}}
```

**문제**:
- resetUrl이 어디서 생성되는지 이 파일에는 명시되지 않음
- backend 소스에서 resetUrl 생성 로직 필요

### 9.2 App Links / Deep Linking 설정
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/dist/.well-known/assetlinks.json`

**구현 현황**:
```bash
ls -la /Users/hoonjaepark/projects/travelPlanner/frontend/dist/.well-known/assetlinks.json
```
assetlinks.json 파일 존재 확인됨

**수정 후보 지점**:
1. `/reset` 또는 `/reset-password` 경로가 assetlinks.json에 등록되어 있는지 확인
2. Android 측: AndroidManifest.xml에 intent-filter for `/reset` 경로 확인 필요 (EAS로 빌드 시 위치: `platforms/android-*/`)
3. 백엔드의 resetUrl 생성 로직: `https://mytravel-planner.com/reset?token=...` 형식인지, 앱 deep link 형식인지 확인
4. 웹 서버의 `/reset` 라우트: frontend/web/ 디렉토리에 해당 페이지 있는지 확인 (현재 없음)

---

## 10. V114-8 미인증 재가입 UX

### 10.1 RegisterScreen 회원가입 처리
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/auth/RegisterScreen.tsx`
- **라인 범위**: 97-109 (handleRegister error handling)

**구현 요약**:
```tsx
try {
  await register(email, password, name);
} catch (error: any) {
  // V112 Wave 5: EmailNotVerifiedError is the happy path
  if (error instanceof EmailNotVerifiedError) return;
  showToast({ type: 'error', message: error.response?.data?.message || ... });
}
```

**현황**:
- EmailNotVerifiedError 발생 시 조용히 반환 (자동으로 EmailVerificationCodeScreen으로 navigate)
- 다른 에러는 toast 표시

**수정 후보 지점**:
1. 라인 104: EMAIL_EXISTS, EMAIL_NOT_VERIFIED 같은 응답 코드 처리 필요 (응답 형식 확인 필요)
2. AuthContext의 register 함수에서 어떤 에러를 throw하는지 확인

### 10.2 LoginScreen 로그인 처리
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/auth/LoginScreen.tsx`
- **라인 범위**: 101-116 (handleLogin error handling)

**구현 요약**:
```tsx
try {
  await login(email, password);
} catch (error: any) {
  if (error instanceof TwoFactorRequiredError) {
    navigation.navigate('TwoFactorLogin', { tempToken: error.tempToken });
    return;
  }
  if (error instanceof EmailNotVerifiedError) return;
  setLoginError(error.response?.data?.message || ...);
}
```

**현황**:
- TwoFactorRequiredError: 2FA 화면으로 navigate
- EmailNotVerifiedError: 조용히 반환 (자동으로 verification 화면으로)
- 다른 에러: loginError state 업데이트 (라인 112)

**수정 후보 지점**:
1. 라인 111: EMAIL_NOT_VERIFIED 응답 처리 명시적 필요 (401 상태 코드 확인)
2. 라인 112: 서버 응답 형식이 `error.response?.data?.message`인지 확인
3. AuthContext의 login 함수 확인 필요

### 10.3 AuthContext 에러 처리
- **파일**: `/Users/hoonjaepark/projects/travelPlanner/frontend/src/contexts/AuthContext.tsx`
- **라인 범위**: (정확한 라인 미확인, 전체 파일 필요)

**수정 후보 지점**:
1. register 함수: 어떤 조건에서 EmailNotVerifiedError 발생하는지
2. login 함수: 401 EMAIL_NOT_VERIFIED 응답 처리 로직
3. 에러 클래스 정의 위치 확인

---

## 11. Jest 테스트 커버리지 상태

### 11.1 관련 테스트 파일 현황
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/__tests__/LoginScreen.test.tsx` - 존재
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/__tests__/TwoFactorLoginScreen.test.tsx` - 존재
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/contexts/__tests__/AuthContext.test.tsx` - 존재
- CoachMark 테스트: **없음** (추가 필요)
- ConsentScreen 테스트: **없음** (추가 필요)
- CreateTripScreen 테스트: **없음** (추가 필요)
- SubscriptionScreen 테스트: **없음** (추가 필요)
- ProfileScreen 테스트: **없음** (추가 필요)

**수정 후보 지점**:
1. 각 이슈별로 테스트 추가 (현재 범위 밖)

---

## 추가 조사 필요 사항

### 1. Backend API 응답 형식
- resetUrl 생성 로직: reset-password 엔드포인트에서 어떤 URL 생성하는가?
- EMAIL_EXISTS, EMAIL_NOT_VERIFIED 같은 에러 코드 형식 확인
- aiTripsUsed/aiTripsLimit/aiTripsRemaining 필드가 PremiumContext에서 올바르게 매핑되는가?

### 2. 웹/앱 Deep Linking 설정
- assetlinks.json의 정확한 내용 및 `/reset` 경로 등록 여부
- Android EAS 빌드 설정에서 intent-filter 등록 여부
- iOS 대응 (Universal Links) 설정 여부

### 3. 좌표 측정 및 레이아웃 이슈
- HomeScreen의 ScrollView 내부에서 measureInWindow 호출 시, ScrollView의 contentOffset이 좌표에 영향을 주는가?
- Modal 내부에서 spotlight 렌더링할 때, LayoutAnimation 또는 다른 rendering 이슈 있는가?
- useSafeAreaInsets이 모든 플랫폼(Android, iOS, Web)에서 일관되게 동작하는가?

### 4. i18n 키 일관성
- consent.json의 "types.privacy_required.title" vs Badge 텍스트 중복 여부 재확인
- trips.json의 aiInfo 관련 키들이 CreateTripScreen, SubscriptionScreen에서 모두 올바르게 사용되는가?

### 5. 구독 상태 관리
- PremiumContext: aiTripsLimit, aiTripsUsed, aiTripsRemaining의 정의 및 계산 로직
- SubscriptionScreen에서 isPremium 상태 업데이트 감시 필요
- Paywall 표시 로직이 aiTripsRemaining === 0과 isAiLimitReached의 동기화 여부

### 6. Modal/SafeAreaView 상호작용
- ConsentScreen footer의 `paddingBottom: Math.max(insets.bottom, 16) + 20`이 모든 디바이스에서 충분한가?
- DeleteAccountModal의 높이 제약 및 keyboard avoidance 설정 확인

### 7. 어댑터/호환성
- formatDate 함수 (SubscriptionScreen 라인 46-48)의 locale 설정
- toLocaleDateString() vs toLocaleString() 시간 포함 여부

---

## 파일 구조 요약

```
frontend/
├── src/
│   ├── components/
│   │   └── tutorial/
│   │       └── CoachMark.tsx (이슈 2a-2b)
│   ├── screens/
│   │   ├── main/
│   │   │   ├── HomeScreen.tsx (이슈 2a)
│   │   │   ├── ProfileScreen.tsx (이슈 3)
│   │   │   └── SubscriptionScreen.tsx (이슈 6a-6b)
│   │   ├── consent/
│   │   │   └── ConsentScreen.tsx (이슈 4a-4c)
│   │   ├── trips/
│   │   │   └── CreateTripScreen.tsx (이슈 5)
│   │   └── auth/
│   │       ├── RegisterScreen.tsx (이슈 8)
│   │       └── LoginScreen.tsx (이슈 8)
│   ├── contexts/
│   │   └── TutorialContext.tsx (이슈 2a)
│   └── i18n/
│       └── locales/ko/
│           ├── tutorial.json (이슈 2b)
│           ├── consent.json (이슈 4b-4c)
│           └── trips.json (이슈 5, 6b)
├── web/
│   ├── privacy.html
│   └── terms.html
└── dist/
    └── .well-known/
        └── assetlinks.json (이슈 1)

backend/
└── templates/
    └── email/
        └── reset-password-*.hbs (이슈 1)
```

