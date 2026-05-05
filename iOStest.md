# iOS 빌드 16 테스트 분석 및 수정 계획

> **최종 수정**: 2026-05-05
> **현재 기준 버전**: iOS 1.0.0 (buildNumber: 16)
> **핵심 원칙**: 웹(www.mytravel-planner.com) 및 Android V220 운영 환경에 영향 없음
> **격리 전략**: 모든 수정은 iOS 전용 조건(`Platform.OS === 'ios'`) 사용, 서버 수정 시 기존 동작 유지

---

## 목차

1. [빌드 16 버그 원인 분석 및 수정 계획](#1-빌드-16-버그-원인-분석-및-수정-계획)
2. [수정 후 검수 계획](#2-수정-후-검수-계획)
3. [최근 5개 버전 재발 방지 재점검 계획](#3-최근-5개-버전-재발-방지-재점검-계획)
4. [iOS 앱 전체 기능 검수 계획](#4-ios-앱-전체-기능-검수-계획)
5. [개인정보 및 시스템 보안 점검 계획](#5-개인정보-및-시스템-보안-점검-계획)

---

## 1. 빌드 16 버그 원인 분석 및 수정 계획

### B16-01: 비밀번호 입력 시 키보드가 비번 영역 가림 (P1)

**증상**: 비번 입력란 터치 시 키보드가 올라오면서 필드를 살짝 가림 (사용은 가능하나 UX 불편)

**근본 원인**
```
LoginScreen.tsx Line 208:
  keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}

기기별 StatusBar 높이:
  - iPhone SE 2세대 (홈 버튼): 20pt
  - iPhone 14 (노치): 44pt
  - iPhone 14 Pro (Dynamic Island): 54pt
  - iPhone 15 Pro Max (Dynamic Island): 59pt

60 오프셋은 SE 기기에서는 충분하지만
노치/Dynamic Island 기기에서 44~59pt StatusBar에
NavBar 높이(56pt)까지 더하면 100~115pt가 필요

결과: 오프셋 부족 → KeyboardAvoidingView가 충분히 밀어올리지 못함
     → 키보드가 비번 필드를 살짝 가림
```

**수정 방법**
```typescript
// frontend/src/screens/auth/LoginScreen.tsx
// 현재:
keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}

// 수정: useSafeAreaInsets().top을 반영한 동적 오프셋
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  style={styles.container}
  enabled={Platform.OS === 'ios'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
>

// insets.top: 기기별 StatusBar 높이 자동 반영
// 56: 헤더 높이 (sharedHeaderOptions와 일치)
// SE(20+56=76), iPhone14(44+56=100), ProMax(59+56=115) — 기기별 정확 처리
```

**영향 범위**: `frontend/src/screens/auth/LoginScreen.tsx` Line 204~209  
**Android/Web 영향**: 없음 (Platform.OS === 'ios' 조건)

---

### B16-02: 이메일 로그인 시 암호 저장 팝업 재등장 (P1)

**증상**: 로그인 시도 시 iOS Safari와 동일한 "암호 저장" keychain 팝업 표시

**근본 원인**
```
iOS 암호 저장 팝업 트리거 조건:
  - TextInput에 textContentType="username" (이메일 필드) +
    textContentType="oneTimeCode" (비번 필드) 조합
  
현재 코드:
  LoginScreen.tsx Line 257: textContentType="username"  ← 이메일 필드
  LoginScreen.tsx Line 286: textContentType="oneTimeCode"  ← 비번 필드

왜 팝업이 뜨는가:
  iOS AutoFill 엔진은 username + (password OR oneTimeCode) 조합을 
  "로그인 폼"으로 인식함.
  oneTimeCode는 비번 자동완성 팝업을 막지 못하고
  "저장할 계정" 팝업(keychain save)을 유발함.

정확한 차이:
  textContentType="newPassword"  → 새 비번 저장 팝업
  textContentType="password"     → 기존 비번 자동완성 팝업
  textContentType="oneTimeCode"  → SMS 인증코드 자동입력 (비번 팝업 부분 차단)
  textContentType="none"         → AutoFill 완전 비활성화 (팝업 없음)

근본 해결책:
  이메일 필드와 비번 필드 모두 textContentType="none" 으로 설정
  → iOS AutoFill이 "로그인 폼"으로 인식하지 못함 → 팝업 없음
```

**수정 방법**
```typescript
// frontend/src/screens/auth/LoginScreen.tsx

// 이메일 필드 (Line 257):
// 변경 전:
textContentType="username"
// 변경 후:
textContentType="none"

// 비번 필드 (Line 286):
// 현재: textContentType="oneTimeCode" → 유지하거나 "none"으로 변경
// 권장: "none" (완전 차단)
textContentType="none"

// 추가 보강 (이미 있음, 유지):
autoComplete="off"
importantForAutofill="no"
```

**영향 범위**: `frontend/src/screens/auth/LoginScreen.tsx` Line 257, 286  
**Android/Web 영향**: 없음 (iOS AutoFill 전용 prop)

---

### B16-03: SNS 로그인 취소 시 로딩 인디케이터 지속 (P1)

**증상**: SNS(Google/Apple/Kakao) 로그인 중 [취소] 버튼 클릭 후에도 로딩 스피너가 계속 표시됨

**근본 원인**
```
코드 흐름:
  handleGoogleLogin() / handleAppleLogin() / handleKakaoLogin()
  → setIsLoading(true)
  → loginWithGoogle/Apple/Kakao() — 취소 시 throw new Error('XXX_CANCELLED')
  → catch(error) → showToast(getAuthErrorMessage(error))
  → finally → setIsLoading(false)  ← 이것은 정상 작동

문제: catch 블록의 showToast() 호출

APPLE_SIGNIN_CANCELLED 처리 (LoginScreen.tsx Line 140~145):
  AUTH_ERROR_I18N = {
    GOOGLE_SIGNIN_CANCELLED: 'login.alerts.googleCancelled',
    KAKAO_SIGNIN_CANCELLED: 'login.alerts.kakaoCancelled',
    // APPLE_SIGNIN_CANCELLED 가 없음! ← 버그
    OAUTH_FAILED: 'login.alerts.oauthFailed',
    ...
  }

  getAuthErrorMessage('APPLE_SIGNIN_CANCELLED'):
    → AUTH_ERROR_I18N['APPLE_SIGNIN_CANCELLED'] = undefined
    → fallback: t('login.alerts.networkError')  ← "네트워크 오류" 표시

실제 증상:
  Apple 취소 → "네트워크 오류" Toast 표시 → 사용자 혼란
  Google/Kakao 취소 → "X 로그인이 취소되었습니다" (정상)
  
  로딩은 finally에서 setIsLoading(false)가 실행되어 멈추지만
  취소 시에도 Toast가 표시되어 UX가 나빠 보임

추가 문제:
  취소는 에러가 아니므로 Toast 자체를 표시하지 않아야 함
  현재: 취소해도 "X 로그인이 취소되었습니다" Toast 표시 → 불필요한 알림
```

**수정 방법**
```typescript
// frontend/src/screens/auth/LoginScreen.tsx

// 1. AUTH_ERROR_I18N에 Apple 취소 추가 (Line 140~145):
const AUTH_ERROR_I18N: Record<string, string> = {
  GOOGLE_SIGNIN_CANCELLED: 'login.alerts.googleCancelled',
  KAKAO_SIGNIN_CANCELLED: 'login.alerts.kakaoCancelled',
  APPLE_SIGNIN_CANCELLED: 'login.alerts.appleCancelled',  // ← 추가
  OAUTH_FAILED: 'login.alerts.oauthFailed',
  GOOGLE_SIGNIN_UNAVAILABLE: 'login.alerts.googleUnavailable',
};

// 2. 취소 에러는 Toast 표시하지 않도록 핸들러 수정:
const CANCELLED_CODES = new Set([
  'GOOGLE_SIGNIN_CANCELLED',
  'KAKAO_SIGNIN_CANCELLED',
  'APPLE_SIGNIN_CANCELLED',
]);

const handleGoogleLogin = async () => {
  setIsLoading(true);
  try {
    await loginWithGoogle();
  } catch (error: any) {
    const code = error?.message ?? '';
    if (!CANCELLED_CODES.has(code)) {
      // 취소가 아닌 실제 오류만 Toast 표시
      showToast({ type: 'error', message: getAuthErrorMessage(error), position: 'top' });
    }
  } finally {
    setIsLoading(false);
  }
};
// handleAppleLogin, handleKakaoLogin 동일 패턴 적용

// 3. i18n 추가 (auth.json 17개 언어):
// "appleCancelled": "Apple 로그인이 취소되었습니다"
```

**수정 파일**:
- `frontend/src/screens/auth/LoginScreen.tsx` (3개 핸들러 + AUTH_ERROR_I18N)
- `frontend/src/i18n/locales/*/auth.json` (17개 언어 — appleCancelled 키 추가)

**Android/Web 영향**: 없음 (동일 패턴이 개선될 뿐, 기존 동작 변경 없음)

---

### B16-04: 카카오 로그인 후 카카오톡 앱으로 복귀 (P2 — OS 제한)

**증상**: 카카오 인증 완료 후 myTravel 앱이 아닌 카카오톡 앱으로 포그라운드 이동

**근본 원인 (OS 레벨 제한)**
```
iOS 앱 포그라운드 전환 메커니즘:
  - iOS는 앱이 다른 앱을 programmatic하게 포그라운드로 전환하는 것을 금지
  - 허용된 방법: URL scheme openURL() — 단, 앱이 이미 registered scheme을 처리하는 경우

카카오 인증 흐름:
  1. myTravel → WebBrowser.openAuthSessionAsync() → 카카오 OAuth 페이지
  2. 카카오 OAuth가 카카오톡 앱으로 리다이렉트 (앱 인터셉트)
  3. 카카오톡에서 [확인] 클릭
  4. 카카오톡 → travelplanner:// 딥링크로 myTravel에 code 전달
  5. myTravel의 Linking.addEventListener가 딥링크 수신
  
문제:
  Step 4에서 카카오톡이 "전달자" 역할을 하므로
  카카오톡이 포그라운드 → iOS가 카카오톡을 유지
  myTravel은 딥링크를 받아 처리하지만 백그라운드 상태 유지

이전 시도 (B15-04에서 제거한 이유):
  Linking.openURL(callbackUrl) 시도 → code 이중 교환 → 500 에러
  완전히 제거한 것이 올바른 결정 (500 에러 제거)

현재 상태:
  - 로그인 자체는 정상 동작 (code 교환, 토큰 발급 모두 정상)
  - 단지 카카오톡이 포그라운드에 남아있는 UI 문제
  - 사용자가 직접 myTravel을 탭하면 로그인 완료 상태로 진입

해결 가능성 평가:
  완전 자동 포그라운드 전환: iOS 정책상 불가
  부분 개선: 사용자에게 앱 복귀 안내 UI 표시 (이미 B15 때 kakaoReturnHint 추가)
```

**수정 방향 (UX 안내 강화)**
```typescript
// 이미 구현된 내용 확인:
// LoginScreen에 카카오 로그인 버튼 아래 힌트 텍스트 표시
// auth.json: "kakaoReturnHint": "로그인 후 카카오톡에서 myTravel 앱으로 자동 복귀됩니다"

// 추가 개선: 카카오 로그인 진행 중 모달/팝업에서 안내 강화
// "카카오톡에서 로그인 완료 후 myTravel 앱을 눌러 주세요"
// → 사용자가 무엇을 해야 하는지 명확히 인지
```

**결론**: 로그인 기능 자체는 100% 정상. OS 제한으로 자동 포그라운드 전환 불가. UX 안내로 대응.  
**Android/Web 영향**: 없음

---

### B16-05: 앱 아이콘 직각 사각형 — 디자인 개선 (P2)

**증상**: 홈 화면 아이콘이 딱딱한 직각 사각형 느낌 (iOS의 자동 squircle 마스크 적용 후에도)

**사용자 요청**: 배경 컬러 전체 + 중앙 아이콘 이미지 배치 (배경색과 스플래시 일치)

**근본 원인**
```
현재 icon.png 구조:
  - 1024x1024 PNG
  - 내부: 파란 배경 + 비행기+텍스트 로고
  - iOS squircle 마스크 자동 적용되지만 내부 디자인 자체가 꽉 차있어
    사각 느낌 유지

사용자 원하는 방향:
  - 배경: 앱 테마 컬러 (#3B82F6 또는 현재 배경색) 단색
  - 중앙: 아이콘 이미지 (비행기) — 70~75% 크기로 여백 있게 배치
  - 결과: iOS squircle 마스킹 후 배경색이 보여 자연스러운 라운드 아이콘
  - 스플래시 배경 (#FAFAF9)과의 자연스러운 연결

전 세계 앱 벤치마킹 (글로벌 표준):
  Airbnb: 단색 배경 + 중앙 로고 (80% 크기)
  Google Maps: 단색 배경 + 핀 아이콘
  Booking.com: 단색 배경 + 'B' 텍스트 (대문자 단순화)
  → 공통: 단색 배경 + 단순 아이콘 + 충분한 여백
```

**수정 방법 (Python Pillow 사용)**
```python
# 현재 앱 배경색 확인 필요: app.config.js Line 18: backgroundColor: '#FAFAF9'
# 앱 primary color: theme.colors.primary → #3B82F6

# 새 아이콘 생성:
# 1. 1024x1024 캔버스 (#3B82F6 배경)
# 2. 기존 비행기 아이콘 이미지를 708x708 (69%)으로 리사이즈
# 3. 중앙 배치 (158, 158)
# 4. PNG 저장 (알파 채널 없음)

from PIL import Image

BG_COLOR = (59, 130, 246)   # #3B82F6 (primary blue)
SIZE = 1024
ICON_RATIO = 0.69

bg = Image.new('RGB', (SIZE, SIZE), BG_COLOR)
icon = Image.open('icon_src.png').convert('RGBA')
icon_size = int(SIZE * ICON_RATIO)  # 708px
icon = icon.resize((icon_size, icon_size), Image.LANCZOS)

offset = (SIZE - icon_size) // 2   # 158
bg.paste(icon, (offset, offset), icon)
bg.save('assets/icon.png')
```

**실행 순서**:
1. 기존 비행기 아이콘 소스 파일 확인 (transparent PNG)
2. Python 스크립트로 새 icon.png 생성
3. app.config.js의 splash backgroundColor와 통일 여부 확인
4. buildNumber 올린 후 빌드 → TestFlight 확인

**Android/Web 영향**: 없음 (아이콘만 교체, 각 플랫폼 독립 마스킹)

---

### B16-06: 오류 로그 점검 (image-69.png) — 조사 항목

**오류 로그 점검 방법**
```bash
# 프로덕션 서버 오류 로그 조회
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose logs --tail=200 2>&1 | grep -E 'ERROR|500|exception' | head -50"

# 또는 Admin 대시보드에서 확인:
# https://mytravel-planner.com/admin (관리자 로그인)
# → Error Logs 메뉴 → 오늘 날짜 필터
```

**점검 항목**:
- 500 에러 발생 건수 및 경로
- Kakao OAuth 관련 오류 (이중 code 교환 시도)
- 인증 실패 패턴 (특정 엔드포인트 반복 실패)
- 비정상 요청 패턴 (DoS, 크롤러)

---

## 2. 수정 후 검수 계획

### 2-1. B16-01 (키보드 가림) 검수

```
기기: iPhone 14 Pro (Dynamic Island), iPhone SE 2세대
환경: 라이트/다크모드

시나리오:
  ☐ 로그인 화면 진입
  ☐ 이메일 입력 완료
  ☐ 비밀번호 필드 터치
  ☐ 키보드 올라옴 → 비밀번호 필드 100% 보임 (가리지 않음)  ← 핵심
  ☐ 비밀번호 입력 가능 (타이핑 정상)
  ☐ [로그인] 버튼 보임
  ☐ iPhone SE에서도 동일하게 정상
```

### 2-2. B16-02 (암호 저장 팝업) 검수

```
기기: iPhone 모든 기종
환경: 처음 로그인 / 재로그인

시나리오:
  ☐ 이메일 + 비밀번호 입력
  ☐ [로그인] 버튼 클릭
  ☐ 로그인 성공
  ☐ "암호 저장" 또는 "키체인에 저장" 팝업 없음  ← 핵심
  ☐ 로그아웃 후 재로그인 시도
  ☐ 자동완성 팝업 없음  ← 핵심
  ☐ 로그인 정상 완료
```

### 2-3. B16-03 (SNS 취소) 검수

```
기기: iPhone
테스트 계정: Google, Apple, Kakao 각각

시나리오 A — Google 취소:
  ☐ [Google로 시작하기] 클릭
  ☐ Google 계정 선택 화면에서 [취소] 클릭
  ☐ Toast 메시지 없음 (또는 조용히 처리)  ← 핵심
  ☐ 로딩 인디케이터 즉시 사라짐  ← 핵심
  ☐ 로그인 화면으로 복귀

시나리오 B — Apple 취소:
  ☐ [Apple로 시작하기] 클릭
  ☐ Face ID 화면 또는 선택 화면에서 [취소]
  ☐ "네트워크 오류" Toast 없음  ← 핵심 (기존 버그)
  ☐ 로딩 즉시 사라짐
  ☐ 로그인 화면 복귀

시나리오 C — Kakao 취소:
  ☐ [카카오로 시작하기] 클릭
  ☐ 카카오 화면에서 뒤로가기 또는 취소
  ☐ Toast 없음 또는 조용한 처리
  ☐ 로딩 즉시 사라짐
```

### 2-4. B16-04 (카카오 복귀) 확인

```
시나리오:
  ☐ [카카오로 시작하기] 클릭
  ☐ 카카오 인증 페이지 진입
  ☐ 계정 입력 후 [확인] 클릭
  ☐ 카카오톡 앱으로 이동 (정상 — OS 제한)
  ☐ 힌트 문구 표시 확인 "myTravel 앱으로 돌아가세요"
  ☐ myTravel 앱 탭 후 로그인 완료 상태  ← 핵심
  ☐ statuscode:500 오류 없음  ← 핵심 (B15-04 수정 유지)
```

### 2-5. B16-05 (아이콘) 검수

```
  ☐ 홈 화면에 앱 아이콘 표시
  ☐ 배경: 파란색(#3B82F6) 단색
  ☐ 중앙 비행기 아이콘 명확히 보임
  ☐ 충분한 여백 (사방 15% 이상)
  ☐ iOS squircle 마스크 후 자연스러운 라운드 처리
  ☐ 스플래시 화면 배경과 자연스럽게 연결
  ☐ 앱스토어 제출 전 1024x1024 PNG 규격 확인
```

### 2-6. 회귀 테스트 (자동화)

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm test -- --coverage --passWithNoTests
cd backend && npx tsc --noEmit
npm run validate:static
```

---

## 3. 최근 5개 버전 재발 방지 재점검 계획

> 빌드 12~16의 반복 이슈를 항목별로 점검하여 재발 여부를 확인

### 재점검 매트릭스

| 이슈 | v12 | v13 | v14 | v15 | v16 | 상태 | 재발 여부 |
|------|-----|-----|-----|-----|-----|------|---------|
| 스플래시 이전 이미지 깜빡임 | ❌ | ❌ | ✅수정 | - | - | **해결** | 확인 필요 |
| 이메일 암호 저장 팝업 | ❌ | ❌ | ❌ | ❌ | ❌ | **미해결** | 재발 중 |
| 카카오 앱 복귀 안됨 | ❌ | ❌ | ❌ | ❌ | ❌ | **OS 제한** | 로그인 정상 |
| DatePicker 흰색 | ❌ | ❌ | ❌ | ❌ | ✅수정 | **해결** | 재점검 필요 |
| 이중 뒤로가기 버튼 | ❌ | ❌ | ❌ | ✅수정 | - | **해결** | 확인 필요 |
| 헤더 높이 불일치 | ❌ | ❌ | ❌ | ❌ | ✅수정 | **해결** | 재점검 필요 |
| 비번 필드 과도 스크롤 | - | - | ❌ | ❌ | ✅수정 | **해결** | 재점검 필요 |
| 카카오 500 오류 | - | - | - | ❌ | ✅수정 | **해결** | 재점검 필요 |
| SNS 취소 시 로딩 지속 | - | - | - | - | ❌ | **신규** | B16-03 |
| 키보드 비번 가림 | - | - | ❌ | - | ❌ | **부분 재발** | B16-01 |

### 항목별 재점검 시나리오

**[R-01] 스플래시 이전 이미지 — 재발 확인**
```
빌드 14에서 splash-icon.png 교체로 해결됨
재점검:
  ☐ 앱 완전 종료 후 아이콘 탭
  ☐ 0.1초 이내 이전 앱 이미지 깜빡임 없음
  ☐ #FAFAF9 배경 + 현재 아이콘 로딩 확인
```

**[R-02] 암호 저장 팝업 — 반복 미해결**
```
v12~v16까지 5번 연속 미해결
근본 원인: textContentType="username" 유지 (이메일 필드)
재점검:
  ☐ B16-02 수정 후 팝업 완전 제거 확인
  ☐ 비번 변경 화면도 동일 prop 적용 확인
```

**[R-03] DatePicker 흰색 — 수정 유지 확인**
```
v15에서 display="spinner"로 해결
재점검:
  ☐ 새 여행 만들기 → 출발일 클릭
  ☐ 스피너 UI에서 날짜 숫자 명확히 보임
  ☐ 라이트모드: 검은 텍스트
  ☐ 다크모드: 흰 텍스트
  ☐ 도착일 동일 확인
  ☐ 날짜 선택 후 필드 반영 확인
```

**[R-04] 이중 뒤로가기 버튼 — 수정 유지 확인**
```
v15에서 headerBackVisible: false (iOS 전용) 추가
재점검:
  ☐ 새 여행 만들기 화면 진입
  ☐ 왼쪽 상단 뒤로가기 버튼 1개만 표시
  ☐ 버튼 클릭 → 이전 화면 정상 복귀
  ☐ 다른 스택 화면(편집, 경비 등)도 확인
```

**[R-05] 헤더 높이 불일치 — 수정 유지 확인**
```
v16에서 headerStyle: { height: 56 } 수정
재점검:
  ☐ 홈 → 탐색 → 내여행 → 알림 → 프로필 탭 전환 10회
  ☐ 모든 탭에서 헤더 상단 기준선 동일
  ☐ iPhone SE, 14, Pro Max 각각 확인
  ☐ 세로/가로 방향 전환 후에도 일관성 유지
```

**[R-06] 카카오 500 오류 — 수정 유지 확인**
```
v16에서 Linking.openURL(callbackUrl) 제거
재점검:
  ☐ 카카오 로그인 성공 후 앱 복귀
  ☐ 복귀 시 "statuscode:500" 오류 없음
  ☐ 로그아웃 후 즉시 재로그인 시도
  ☐ 두 번째 로그인도 오류 없음
```

---

## 4. iOS 앱 전체 기능 검수 계획

> 웹/Android 서비스 영향 없는 iOS 전용 검수

### Layer 1: 앱 실행 및 기본 UI

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 앱 아이콘 | 홈 화면 아이콘 디자인 | 파란 배경 + 비행기 아이콘 | P2 |
| 스플래시 | 첫 실행 시 스플래시 | #FAFAF9 배경 + 아이콘, 깜빡임 없음 | P1 |
| 다크모드 | 기기 설정 → 다크 | 전체 다크 테마 | P1 |
| 라이트모드 | 기기 설정 → 라이트 | 전체 라이트 테마 | P1 |
| Dynamic Island | iPhone 14 Pro/15 Pro | 헤더/UI 가리지 않음 | P1 |
| 탭바 | 하단 5개 탭 전환 | 아이콘+텍스트 정상, 깜빡임 없음 | P1 |
| 헤더 일관성 | 탭 전환 10회 | 헤더 높이 동일 | P1 |
| 언어 전환 | 앱 내 언어 설정 변경 | 즉시 반영 | P1 |
| 방향 전환 | 세로→가로→세로 | 레이아웃 정상 | P2 |

### Layer 2: 인증

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 이메일 로그인 | 정상 계정 | 홈 진입, 팝업 없음 | **P0** |
| 이메일 로그인 실패 | 틀린 비번 | 오류 메시지 (로딩 멈춤) | P1 |
| Google 로그인 | 계정 선택 → 로그인 | 정상 로그인 | P1 |
| Google 로그인 취소 | [취소] 클릭 | 로딩 즉시 종료, Toast 없음 | P1 |
| Apple 로그인 | Face ID → 확인 | 정상 로그인 | P1 |
| Apple 로그인 취소 | [취소] 클릭 | 로딩 즉시 종료, 네트워크 오류 Toast 없음 | **P0** |
| Kakao 로그인 | 카카오 인증 → 복귀 | 로그인 완료, 500 오류 없음 | P1 |
| Kakao 로그인 취소 | 뒤로가기 | 로딩 종료, Toast 없음 | P1 |
| 자동 로그인 | 앱 재실행 | 로그인 유지 | P1 |
| 로그아웃 | 프로필 → 로그아웃 | 로그인 화면 이동 | P1 |
| 세션 만료 | 토큰 만료 후 API | 자동 갱신 또는 재로그인 | P1 |
| 비밀번호 입력 UI | 비번 필드 탭 | 키보드 올라옴, 필드 가리지 않음 | P1 |

### Layer 3: 여행 관리

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 여행 생성 | 목적지/날짜 입력 → 생성 | 정상 생성 | P1 |
| 출발일 DatePicker | 출발일 필드 클릭 | 스피너 UI, 날짜 보임 | **P0** |
| 도착일 DatePicker | 도착일 필드 클릭 | 스피너 UI, 날짜 보임 | **P0** |
| 날짜 유효성 | 출발 > 도착 입력 | "출발일은 종료일보다 이전이어야 합니다" | P1 |
| AI 여행 생성 | AI 일정 자동 생성 | 로딩 후 정상 생성 | P1 |
| 광고 보고 인사이트 | 광고 버튼 클릭 | 광고 재생 → 인사이트 표시 | P1 |
| 여행 목록 | 내 여행 탭 | 생성 여행 카드 | P1 |
| 여행 상세 | 카드 클릭 | TripDetail 화면 | P1 |
| 뒤로가기 | ← 버튼 | 목록 복귀 (버튼 1개) | P1 |
| 여행 수정 | 편집 후 저장 | 저장 완료 | P1 |
| 여행 삭제 | 삭제 확인 | 목록 제거 | P1 |
| 활동 추가/수정/삭제 | 일정 관리 | 정상 처리 | P1 |
| 지도 핀 | 활동 위치 | 좌표 정상 표시 | P2 |

### Layer 4: 탐색 및 검색

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 탐색 화면 | 탐색 탭 | 여행지 콘텐츠 | P2 |
| 장소 검색 | 목적지 검색 | 자동완성 결과 | P1 |
| 날씨 정보 | 여행지 날씨 | 날씨 데이터 표시 | P2 |

### Layer 5: 프로필 및 설정

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 프로필 조회 | 프로필 탭 | 이름/이메일 표시 | P1 |
| 프로필 이미지 변경 | 사진 선택 | 이미지 변경 성공 | P1 |
| 언어 설정 | 앱 내 언어 | 즉시 반영 | P1 |
| 테마 설정 | 라이트/다크 | 즉시 반영 | P1 |
| 알림 설정 | 푸시 on/off | 설정 저장 | P2 |
| 계정 삭제 | 탈퇴 플로우 | 데이터 삭제, 로그인 화면 | P2 |

### Layer 6: 알림

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 알림 목록 | 알림 탭 | 수신된 알림 표시 | P2 |
| 알림 읽음 | 항목 탭 | 읽음 상태 변경 | P2 |

### Layer 7: 구독/결제

| 항목 | 검수 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 프리미엄 업그레이드 | 구독 화면 진입 | 요금제 표시 | P1 |
| 구독 처리 | 구독 시도 | RevenueCat 정상 처리 | P1 |
| 구독 후 광고 제거 | 구독 완료 | 광고 미노출 | P1 |
| 구독 취소 | 관리 화면 | 취소 후 만료일까지 프리미엄 | P1 |

### Layer 8: 오류 처리

| 항목 | 확인 내용 | 기대 결과 | 우선순위 |
|------|-----------|-----------|---------|
| 오프라인 | 네트워크 끄기 | 오류 메시지, 크래시 없음 | P1 |
| 서버 오류 | API 500 | 사용자 친화 메시지 | P1 |
| 타임아웃 | 느린 네트워크 | 로딩 → 타임아웃 처리 | P2 |

---

## 5. 개인정보 및 시스템 보안 점검 계획

> 기존 웹/Android 운영 서비스 영향 없이 iOS 앱 관련 항목 집중 점검

### 5-1. 인증 보안 (iOS 전용)

**A. textContentType 보안 강화 확인**
```
수정 후 점검:
  ☐ 이메일/비번 필드 textContentType="none" 확인
  ☐ 키체인 저장 없음 확인 (iCloud Keychain에 앱 항목 없음)
  ☐ 비밀번호 화면 캡처 방지 여부 (선택)
```

**B. OAuth 토큰 저장 (iOS Keychain)**
```
  ☐ Refresh Token: Keychain만 저장 (AsyncStorage X)
    → AuthContext.tsx의 secureStorage 사용 확인
  ☐ Access Token: 메모리에만 보관 (앱 재실행 시 재발급)
  ☐ 로그아웃 시 모든 토큰 Keychain에서 삭제 확인
  ☐ 기기 분실 시나리오: 새 기기에서 로그인 → 이전 토큰 무효화
```

**C. Apple Sign-In 보안**
```
  ☐ identityToken JWKS 서버 검증 (backend auth.service.ts)
  ☐ 로그아웃 시 Apple refresh token 폐기 API 호출
  ☐ 첫 로그인만 이름 제공 — 이후 Apple이 이메일 숨김 허용 대응
```

**D. Kakao OAuth 보안**
```
  ☐ state nonce 생성/검증 (oauth.service.ts Line 30~44 확인)
  ☐ code 일회성 사용 — 서버 측 중복 처리 방지
  ☐ redirect_uri 화이트리스트 (백엔드 확인)
  ☐ B15-04 수정 후 code 이중 교환 시도 없음 확인
```

### 5-2. 데이터 전송 보안

```
  ☐ HTTPS 강제 적용
    → app.config.js의 EXPO_PUBLIC_API_URL: https://mytravel-planner.com/api
    → HTTP 요청 차단 (ATS 설정 확인)
  ☐ API 인터셉터 Bearer 토큰 자동 추가 (api.ts 확인)
  ☐ 인증 필요 엔드포인트에서 토큰 없이 401 응답
  ☐ 민감 정보 네트워크 로그 미노출:
    → 비밀번호, 토큰이 console.log에 없음
    → Sentry 오류 보고 시 PII strip 확인
```

### 5-3. 기기 내 데이터 저장

```
  ☐ AsyncStorage에 토큰/비밀번호 없음 확인
    → 저장 가능 항목: 언어 설정, 테마, 세션 플래그만
  ☐ Keychain 항목:
    → STORAGE_KEYS.AUTH_TOKEN: secureStorage (Keychain)
    → STORAGE_KEYS.REFRESH_TOKEN: secureStorage (Keychain)
  ☐ 앱 삭제 후 Keychain 항목 처리 정책 확인
    (iOS는 앱 삭제 후에도 Keychain 남음 — 재설치 시 자동 로그인 방지 필요)
```

### 5-4. 개인정보 수집 vs 처리방침 일치

**iOS Privacy Manifest 확인**
```
app.config.js Line 138~191 NSPrivacyCollectedDataTypes:
  ☐ EmailAddress: 수집 O (계정 생성 시)
  ☐ UserID: 수집 O (DB 저장 ID)
  ☐ PhotosOrVideos: 수집 O (여행 사진 업로드)
  ☐ DeviceID: 수집 O (광고 식별)
  ☐ PurchaseHistory: 수집 O (RevenueCat 구독)
  ☐ CrashData: 수집 O (Sentry)
  ☐ AdvertisingData: 수집 O (AdMob)
  
  실제 수집 여부와 매니페스트 일치 확인:
  ☐ 위치 정보: 수집 안 함 → Manifest에 없음 (일치)
  ☐ 연락처: 수집 안 함 → Manifest에 없음 (일치)
```

**만 14세 이상 동의 확인**
```
  ☐ 회원가입 화면(RegisterScreen)에 "만 14세 이상" 체크박스 있음 확인
  ☐ 체크 없이 가입 시도 시 차단
  ☐ 개인정보처리방침 art7과 구현 일치 확인
```

**데이터 내보내기/삭제 권리**
```
  ☐ 앱 내 계정 삭제 기능 있음 확인
  ☐ 삭제 요청 시 30일 이내 파기 (법정 의무)
  ☐ 데이터 내보내기: ProfileScreen에 버튼 있는지 확인
    → 없다면 추가 구현 계획 수립 (GDPR 의무)
```

### 5-5. 앱스토어 제출 전 보안 체크

```
  ☐ ITSAppUsesNonExemptEncryption: false (app.config.js Line 38)
    → 암호화 수출 규정 준수 선언 (현재 설정 OK)
  ☐ NSUserTrackingUsageDescription 설정 (app.config.js Line 34)
    → 광고 추적 동의 문구 있음
  ☐ NSPhotoLibraryUsageDescription 설정 (app.config.js Line 36)
    → 사진 접근 동의 문구 있음
  ☐ URL Scheme 보안: travelplanner:// 등록 확인
  ☐ Associated Domains: mytravel-planner.com 확인
  ☐ Privacy Policy URL: 앱 내 표시 및 앱스토어 등록 확인
```

### 5-6. 서버 측 보안 (iOS 요청 관련, 웹/Android 공용)

> ⚠️ 아래 항목은 서버 측이므로 수정 시 웹/Android에도 영향. **읽기 전용 점검만 수행**

```
  📋 점검 전용 (수정 불가):
  ☐ 카카오 OAuth code 일회성 처리 — Redis 기반 중복 방지
  ☐ Rate limiting: 로그인 분당 10회, 전체 API 100회
  ☐ IDOR 방지: 타 사용자 여행 403 응답
  ☐ 관리자 API: isAdmin 가드 동작 확인
  ☐ 오류 로그에 PII(이메일/이름) 미포함
  ☐ Refresh Token Redis eviction 방지 (V220 불변식)
  ☐ isLoggingOut lock 동작 (V220 불변식)

  → 이슈 발견 시: iOS 전용 수정이 불가능한 경우 별도 서버 배포 계획 수립
    단, 기존 웹/Android 동작 변경 없는 범위에서만 수정
```

---

## 6. 빌드 17 수정 순서 및 일정

| 순위 | 항목 | 파일 | 소요 | 웹/Android 영향 |
|------|------|------|------|----------------|
| 1 | B16-02: 암호 저장 팝업 | LoginScreen.tsx | 10분 | 없음 |
| 2 | B16-03: SNS 취소 로딩 | LoginScreen.tsx + auth.json×17 | 30분 | 없음 |
| 3 | B16-01: 키보드 가림 | LoginScreen.tsx | 10분 | 없음 |
| 4 | B16-05: 앱 아이콘 | icon.png (Python) | 1~2시간 | 없음 |
| 5 | B16-04: 카카오 UX 안내 | LoginScreen.tsx (옵션) | 20분 | 없음 |

**수정 완료 후**: TS 타입 체크 → 단위 테스트 → buildNumber 17 → EAS 로컬 빌드 → TestFlight 업로드

---

## 요약

| 항목 | 우선순위 | 상태 | 비고 |
|------|---------|------|------|
| B16-01: 키보드 비번 가림 | P1 | 수정 예정 | insets.top 동적 오프셋 |
| B16-02: 암호 저장 팝업 | P1 | 수정 예정 | textContentType="none" |
| B16-03: SNS 취소 로딩 | P1 | 수정 예정 | Apple 취소 코드 누락 |
| B16-04: 카카오 앱 복귀 | P2 | OS 제한 | 로그인 정상, UX 안내 |
| B16-05: 앱 아이콘 | P2 | 수정 예정 | 파란 배경 + 중앙 아이콘 |
| B16-06: 오류 로그 점검 | P2 | 조사 필요 | 서버 로그 확인 |
| 재발 방지 점검 | P1 | 계획 수립 | v12~v16 6개 항목 |
| 전체 기능 검수 | P1 | 계획 수립 | Layer 1~8 체계적 검수 |
| 보안/개인정보 | P1 | 계획 수립 | iOS 전용 + 서버 읽기 전용 |

**예상 소요**: 코드 수정 2~3시간 + 빌드/업로드 30분 + 검수 2~3시간 = **총 1일**

---

*최종 수정: 2026-05-05*
*기준 버전: iOS 1.0.0 (buildNumber: 16)*
*다음 단계: B16-02 → B16-03 → B16-01 → B16-05 → buildNumber 17 → TestFlight*
