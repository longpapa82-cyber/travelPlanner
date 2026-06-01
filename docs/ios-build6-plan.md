# iOS Build 6 전체 검수 및 출시 계획

> 작성일: 2026-05-04  
> 기준 빌드: 1.0.0 (5) 테스트 결과  
> **최우선 원칙**: 운영 중인 웹(mytravel-planner.com) 및 Android 프로덕션(versionCode 220)에 영향 없음

---

## ⚠️ 영향 범위 가드 원칙

| 변경 영역 | 영향 범위 | 가드 방법 |
|-----------|-----------|-----------|
| frontend/src (iOS 전용 수정) | iOS만 | Platform.OS === 'ios' 조건부 코드, Android 동작 동일 유지 |
| frontend/src (공통 컴포넌트) | iOS + Android + 웹 | 수정 전 Android 동작 스냅샷, 수정 후 재검증 필수 |
| backend/src | 웹 + 앱 전체 | 서버 배포 없이 해결 최우선. 불가피 시 롤백 계획 수립 후 배포 |
| app.config.js / app.json | iOS 빌드에만 반영 | EAS production-ios 프로파일로만 빌드 |

---

## 📋 계획 1: 버그 원인 분석 및 수정 계획

### 🔴 P0 — 즉시 수정 필요 (출시 차단)

#### P0-1: Google Sign-In 강제 종료 (Build 4, 5 모두 재현)

**현상**: 계정 선택 후 앱 강제 종료  
**원인 분석**:
- Build 5에서 `googleNativeSignIn.ts`의 lazy `require()` → top-level `import`로 수정했으나 여전히 크래시 발생
- 크래시가 계정 선택 *이후* 발생 → import 타이밍 문제가 아니라 **Google Sign-In SDK 응답 처리 단계 크래시**
- 가능한 원인:
  1. `@react-native-google-signin/google-signin` v13+ New Architecture 호환성 미충족
  2. iOS 번들 ID / reversed client ID `CFBundleURLTypes` 미등록
  3. `GoogleService-Info.plist` 미포함 (EAS 빌드 시 누락 가능)
  4. `offlineAccess: false` 상태에서 `serverAuthCode` 접근 시 null crash

**수정 방법**:
```
1. Sentry / Crashlytics 크래시 로그 확인 → 정확한 stack trace 파악
2. app.config.js에 googleServicesFile 경로 명시 확인
3. iOS URL Scheme에 reversed client ID 등록 여부 확인
   (CFBundleURLSchemes: ['com.googleusercontent.apps.48805541090-9gh3sp9...'])
4. Build 5 EAS 빌드 로그에서 GoogleService-Info.plist 포함 여부 확인
5. @react-native-google-signin 버전 New Architecture 호환 여부 확인
```

**영향 범위**: iOS 전용. Android/웹 영향 없음.

---

#### P0-2: 날짜 선택 spinner 여전히 미표시 (Build 5 수정 후에도 재현)

**현상**: 터치 시 진동은 있으나 UI 안 보임  
**원인 분석**:
- Build 5에서 height: 216 적용, top-level import 수정했으나 재현
- `DatePicker.tsx`의 iOS spinner는 `display="spinner"` prop 명시 필요 가능성
- 또는 부모 컨테이너의 `overflow: 'hidden'` / height 제약으로 clipped
- Android의 경우 `display="default"` 사용 → iOS에서도 동일하게 fallthrough되는 경우 캘린더 모드 진입

**수정 방법**:
```
1. DatePicker.tsx에 Platform.OS === 'ios' 조건으로 display="spinner" 명시 추가
2. 부모 View의 overflow, height 제약 검토
3. modal={false} 설정 시도 (inline 렌더링 강제)
```

**영향 범위**: iOS 전용. Android/웹 영향 없음 (`display="spinner"` iOS 전용 prop).

---

### 🟡 P1 — 출시 전 수정 필요

#### P1-1: 카카오 로그인 후 카카오톡 앱으로 복귀 문제

**현상**: 로그인 완료 후 myTravel 앱이 아닌 카카오톡 앱으로 복귀  
**원인 분석**:
- `oauth.service.ts`의 iOS 딥링크 처리는 `Linking.addEventListener('url', ...)` 방식
- Android는 `deeplinkPromise` race 패턴이 있으나 **iOS에서는 `Promise.resolve(null)` 반환** → 딥링크 감지 불가
- 카카오 네이티브 앱이 redirect를 처리하면 Custom Tab이 dismiss되고 딥링크가 오는데, iOS에서 이를 수신하는 로직 미구현
- 해결: iOS도 Android와 동일하게 `Linking.addEventListener` race 패턴 적용

**수정 방법**:
```typescript
// oauth.service.ts 수정
const deeplinkPromise = (Platform.OS === 'android' || Platform.OS === 'ios')
  ? new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 30_000);
      const sub = Linking.addEventListener('url', ({ url }) => {
        if (url.includes('/auth/callback')) {
          clearTimeout(timer);
          resolve(url);
        }
      });
      cleanups.push(() => sub.remove());
    })
  : Promise.resolve(null);
```

**영향 범위**: iOS 전용 수정. Android 동작 변경 없음. 웹 영향 없음.

---

#### P1-2: 이메일 로그인 시 암호 저장 팝업 표시

**현상**: iOS에서 브라우저처럼 비밀번호 저장 제안 팝업 노출  
**원인 분석**:
- `LoginScreen.tsx`의 password TextInput에 `autoComplete="off"`, `importantForAutofill="no"` 적용됐으나 iOS는 이 prop을 무시
- iOS에서는 `textContentType="oneTimeCode"` 또는 `textContentType="newPassword"` 트릭 또는 `textContentType="none"` 명시 필요

**수정 방법**:
```typescript
// LoginScreen.tsx password TextInput에 추가
textContentType="none"     // iOS 자동완성 비활성화
```

**영향 범위**: iOS 전용 prop. Android/웹 영향 없음.

---

#### P1-3: 탭 바 아이콘 상단 치우침

**현상**: 탭 바 하단 여백은 추가됐으나 아이콘이 상단에 치우침  
**원인 분석**:
- `MainNavigator.tsx`: `height: 60 + Math.max(insets.bottom, 0)`, `paddingBottom: Math.max(insets.bottom, 8)`
- `paddingTop`이 0 → 아이콘이 상단에 붙음
- 중앙 정렬을 위해 `paddingTop` 균형 추가 필요

**수정 방법**:
```typescript
// MainNavigator.tsx tabBarStyle 수정
paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : Math.max(insets.bottom, 5),
paddingTop: 8,   // 추가: 아이콘 상단 여백
height: 60 + Math.max(insets.bottom, 0),
```

**영향 범위**: 공통 컴포넌트 수정. Android도 `paddingTop: 8` 적용되나 기존 동작과 차이 미미 (현재 0 → 8). **Android 실기기 재검증 필요**.

---

### 🟢 P2 — 선택적 개선

#### P2-1: 스플래시 화면 깜빡임 (0.1초 이전 이미지)

**현상**: 앱 실행 시 약 0.1초간 이전 버전 스플래시 이미지 노출  
**원인**: iOS의 앱 스냅샷(background task snapshot) 캐시. 기기에 이전 빌드 스냅샷이 남아있어 발생. Build 6 설치 후 자연 소멸 가능성 높음.  
**대응**: Build 6 신규 설치 후 재현 여부 확인. 재현 시 `expo-splash-screen` 도입 검토.

---

## 📋 계획 2: iOS 앱 전체 기능 검수 계획

> **원칙**: 모든 테스트는 TestFlight Build 6 설치 후 실기기(iPhone)에서 진행. Android/웹 동작은 병행 spot-check.

### Layer 1 — 인증 흐름 (P0 수정 후)

| # | 테스트 항목 | 기대 결과 | iOS 전용? |
|---|-------------|-----------|-----------|
| 1 | 이메일 로그인 | 로그인 성공, 암호 저장 팝업 없음 | ✓ |
| 2 | 이메일 회원가입 | 회원가입 성공 | - |
| 3 | Google 로그인 | 계정 선택 → 앱 내 로그인 완료 (크래시 없음) | ✓ |
| 4 | Apple 로그인 | Face ID → 로그인 성공 | ✓ |
| 5 | 카카오 로그인 | 카카오 앱 → myTravel 앱 복귀 → 로그인 완료 | ✓ |
| 6 | 로그아웃 | 로그아웃 후 로그인 화면 이동, 재로그인 가능 | - |
| 7 | 자동 로그인 | 앱 재시작 시 세션 유지 | - |

### Layer 2 — 핵심 기능

| # | 테스트 항목 | 기대 결과 |
|---|-------------|-----------|
| 8 | 여행 생성 (AI) | 여행 제목, 날짜 선택, AI 생성 완료 |
| 9 | **날짜 선택 spinner** | spinner UI 표시 및 날짜 선택 가능 |
| 10 | 여행 목록 조회 | 생성된 여행 목록 표시 |
| 11 | 여행 상세 / 편집 | 일정 추가, 수정, 삭제 |
| 12 | 장소 검색 | 자동완성 정상 동작 |
| 13 | 공지사항 폼 (관리자) | 날짜 선택 포함 정상 동작 |
| 14 | 프로필 수정 | 프로필 이미지, 닉네임 변경 |
| 15 | 알림 | 알림 수신, 읽음 처리 |
| 16 | 탐색 화면 | 지도/리스트 뷰 정상 표시 |

### Layer 3 — UI/UX

| # | 테스트 항목 | 기대 결과 |
|---|-------------|-----------|
| 17 | 탭 바 여백 | 아이콘 상/하 균형 여백, 홈 버튼과 겹침 없음 |
| 18 | 키보드 동작 | 텍스트 입력 시 필드 가리지 않음 |
| 19 | Safe Area | 노치/Dynamic Island 영역 침범 없음 |
| 20 | 다크/라이트 모드 | 모드 전환 시 전체 화면 정상 렌더링 |
| 21 | 스크롤 | 긴 목록 스크롤 자연스러움 |
| 22 | 앱 실행 플리커 | Build 6 신규 설치 후 플리커 없음 확인 |

### Layer 4 — 광고 (TestFlight 단계 제한적 검증)

| # | 테스트 항목 | 기대 결과 |
|---|-------------|-----------|
| 23 | 광고 초기화 | 앱 실행 시 AdMob 초기화 완료 로그 |
| 24 | 광고 미표시 (TestFlight) | TestFlight 단계 = App Store 미연결 = 정상 (광고 미노출이 정상) |
| 25 | 프리미엄 계정 광고 차단 | 구독 계정 로그인 시 광고 로드 시도 없음 |

---

## 📋 계획 3: iOS 보안 점검 계획

> **원칙**: 서버 사이드 변경 없이 클라이언트 보안 항목만 점검. 기존 보안 인프라(JWT, rate limit, 2FA 등) 유지.

### S1 — 인증 보안

| # | 점검 항목 | 점검 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| S1-1 | Keychain 저장 여부 | 코드 리뷰: secureStorage → Keychain 사용 | Access Token만 저장, Refresh Token 미저장 (불변식 #28) |
| S1-2 | OAuth CSRF nonce | 코드 리뷰: oauth.service.ts state 파라미터 | CSPRNG nonce 포함, 콜백 검증 (불변식 #27) |
| S1-3 | Apple Sign-In token revoke | 코드 리뷰: 탈퇴 시 Apple token revoke API 호출 | App Store Guideline 5.1.1 준수 |
| S1-4 | 자동완성 비활성화 | 실기기 확인 | 이메일/비밀번호 필드 암호 저장 팝업 없음 |
| S1-5 | 생체인증 우회 | Face ID 취소 후 앱 상태 확인 | 취소 시 로그인 화면 유지 |

### S2 — 데이터 보호

| # | 점검 항목 | 점검 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| S2-1 | 스크린 캡처 방지 | 결제/민감 화면에서 스크린샷 | 민감 정보 노출 없음 (필요 시 SecureView 적용) |
| S2-2 | 백그라운드 스냅샷 | 홈 버튼 누른 직후 앱 전환 화면 | 민감 화면 블러 처리 여부 확인 |
| S2-3 | 클립보드 보안 | 비밀번호 필드 복사 | 복사 불가 또는 즉시 클리어 |
| S2-4 | 네트워크 통신 암호화 | Charles Proxy/Proxyman으로 트래픽 확인 | 모든 API 호출 HTTPS, 인증서 검증 |
| S2-5 | API 키 노출 | 번들 파일 strings 명령 검사 | 소스코드/번들에 API key 하드코딩 없음 |

### S3 — 런타임 보안

| # | 점검 항목 | 점검 방법 | 기대 결과 |
|---|-----------|-----------|-----------|
| S3-1 | 탈옥 탐지 | 탈옥 기기에서 실행 (또는 정적 분석) | 탈옥 기기 경고 또는 기능 제한 |
| S3-2 | 디버거 연결 탐지 | lldb attach 시도 | 프로덕션 빌드에서 방어 동작 |
| S3-3 | 세션 만료 처리 | access token 만료 후 API 호출 | 자동 refresh 또는 로그인 화면 이동 |
| S3-4 | 다중 기기 로그인 | 동일 계정 2기기 동시 로그인 | refresh token rotation으로 이전 세션 만료 |

### S4 — App Store 보안 정책

| # | 점검 항목 | 기대 결과 |
|---|-----------|-----------|
| S4-1 | NSAppTransportSecurity | Info.plist에 ATS 예외 없음 (또는 최소화) |
| S4-2 | 암호화 문서 | ITSAppUsesNonExemptEncryption: false 선언 완료 ✅ |
| S4-3 | 개인정보 접근 권한 | 사용하지 않는 권한 Info.plist 미선언 |
| S4-4 | Privacy Manifest | PrivacyInfo.xcprivacy 파일 포함 여부 (SDK 요구사항) |

---

## 📋 계획 4: App Store 출시 전 최종 검수 계획

### Go/No-Go 판정 기준

| 항목 | 기준 | 현재 상태 |
|------|------|-----------|
| P0 버그 0건 | Google 로그인, 날짜 선택 수정 완료 | ❌ 미완료 |
| P1 버그 0건 | 카카오 복귀, 암호 저장 팝업, 탭 바 수정 완료 | ❌ 미완료 |
| Layer 1~4 테스트 PASS | 위 26개 항목 통과 | ⏳ 대기 |
| 보안 점검 S1~S4 PASS | 크리티컬 이슈 0건 | ⏳ 대기 |
| TestFlight 내부 테스트 승인 | 실기기 검증 완료 | ⏳ 대기 |

### 최종 체크리스트 (제출 직전)

**App Store Connect 설정**
- [ ] 앱 이름, 설명 (ko/en/ja) 최종 확인
- [ ] 스크린샷 최신 버전 업로드 (iPhone 6.7" 필수)
- [ ] 프리뷰 영상 (선택)
- [ ] 앱 카테고리: 여행
- [ ] 연령 등급 4+
- [ ] 개인정보 처리방침 URL
- [ ] 앱 암호화 문서 ✅ (완료)

**앱 콘텐츠 선언**
- [ ] 광고 포함 여부 선언
- [ ] 인앱 구매 선언
- [ ] 데이터 수집 항목 (사용자 ID, 구매 내역, 위치 등)

**기술 요구사항**
- [ ] iOS 최소 버전 지원 확인 (Expo SDK 54 → iOS 16+)
- [ ] Privacy Manifest 포함 여부
- [ ] 앱 추적 투명성 (ATT) 팝업 동작
- [ ] 딥링크 (travelplanner://) 정상 동작
- [ ] Universal Link (mytravel-planner.com) 정상 동작

---

## 📋 계획 3-B: iOS 오류 로그 체계 점검 계획

> **목표**: Android/웹과 동일하게 iOS 오류가 서버 Admin 대시보드 + Sentry에 체계적으로 수집되는지 검증

### 현재 오류 로그 인프라 현황

| 채널 | 구현 상태 | iOS 적용 여부 |
|------|-----------|--------------|
| 서버 DB `error_logs` 테이블 | ✅ 완료 (platform/deviceOS/deviceModel/breadcrumbs 필드 포함) | `platform: 'ios'`로 필터링 가능 |
| `api.ts reportError()` | ✅ 완료 (FIFO 큐, 50건 재시도) | `deviceOS: Platform.OS` 자동 포함 |
| Sentry (`@sentry/react-native`) | ✅ 완료 (initSentry 호출, 메모리 경고 캡처) | iOS/Android 모두 지원 |
| Global 에러 핸들러 (`ErrorUtils`) | ✅ 완료 (App.tsx, RN 전용) | iOS에도 동일 적용 |
| AllExceptionsFilter (서버 5xx) | ✅ 완료 | 서버 오류는 플랫폼 무관 |

### L1 — Google Sign-In 크래시 로그 수집 검증 (P0 연계)

```
검증 방법:
1. Build 5(또는 6)에서 Google Sign-In 시도 → 크래시 재현
2. Admin 대시보드 → 오류 로그 → platform: 'ios' 필터
3. 크래시 stack trace가 error_logs 테이블에 저장됐는지 확인
4. Sentry 대시보드에서 동일 크래시 이슈 확인

기대 결과:
- error_logs 테이블에 platform='ios', severity='fatal' 레코드 존재
- Sentry Issues에 Google Sign-In 관련 크래시 그룹화
- deviceModel 필드로 기기 모델 식별 가능
```

### L2 — 오류 로그 iOS 전용 필드 검증

| 필드 | iOS 기대값 | 검증 방법 |
|------|-----------|-----------|
| `platform` | `'ios'` | Admin 에러 로그 필터링 |
| `deviceOS` | `'ios'` | 로그 상세 확인 |
| `deviceModel` | `'iPhone14,5'` 형식 | expo-device로 수집 여부 확인 |
| `appVersion` | `'1.0.0'` | 로그 상세 확인 |
| `screen` | 오류 발생 화면명 | routeName 필드 확인 |
| `breadcrumbs` | 오류 직전 행동 이력 | Sentry breadcrumb 연동 확인 |

### L3 — 오류 미수집 시나리오 점검

```
점검 항목:
1. 네트워크 오프라인 상태에서 오류 발생
   → FIFO 큐(50건)에 저장 후 온라인 복구 시 자동 드레인 확인
   
2. 앱 강제 종료(크래시) 시나리오
   → Sentry Native SDK가 next launch에 크래시 보고 전송하는지 확인
   → 서버 DB에는 크래시 전 마지막 breadcrumb이라도 저장됐는지 확인

3. OAuth 취소(KAKAO_SIGNIN_CANCELLED 등)
   → reportError 미전송 확인 (불변식 #26: 취소는 로그 제외)

4. Admin 대시보드 iOS 필터 동작
   → /admin/error-logs?platform=ios 쿼리 정상 동작 확인
```

### L4 — Sentry 소스맵 업로드 확인

```
EAS 빌드 시 Sentry 소스맵이 자동 업로드되는지 확인:
1. EAS 빌드 로그에서 "Sentry" 또는 "sourcemap" 키워드 검색
2. Sentry 대시보드 → Releases → iOS 버전 소스맵 포함 여부
3. 소스맵 없으면: Sentry minified stack trace → 디버깅 불가

수정 방법 (미업로드 시):
app.config.js에 @sentry/react-native/metro 플러그인 설정 확인
```

---

## 💳 iOS 구독 테스트 방법 (최종 레포트 포함)

> **Android와의 차이**: Android는 라이선스 테스터(결제 관리자 계정)로 실제 결제 없이 테스트 가능. **iOS는 별도 Sandbox Tester 계정 생성 필요** (라이선스 테스터 개념 없음).

### iOS 구독 테스트 2가지 방법

#### 방법 A: Sandbox Tester 계정 (권장)
```
1. App Store Connect → 사용자 및 액세스 → Sandbox → 테스터
2. "+" 클릭 → 테스트용 이메일 주소로 새 Apple ID 생성
   (실제 존재하는 이메일 필요, 기존 Apple ID와 무관)
3. 기기 설정 → App Store → Sandbox 계정으로 로그인
4. TestFlight 앱에서 구독 시도
   → 실제 결제 없이 Sandbox 환경에서 처리
   → 구독 기간이 실제의 1/60로 단축 (월간 = 5분, 연간 = 1시간)
5. RevenueCat 대시보드에서 Sandbox 구매 내역 확인
```

#### 방법 B: StoreKit Configuration (Xcode 시뮬레이터, 개발 중)
```
- Xcode 시뮬레이터에서만 사용 가능
- TestFlight/실기기 테스트에는 적용 불가
- EAS 빌드 환경에서는 사용 어려움
```

### 결제 테스트 시나리오

| # | 시나리오 | 검증 항목 |
|---|----------|-----------|
| T1 | 월간 구독 구매 | 결제 완료 → 서버 tier 'premium' 전환 → 광고 제거 |
| T2 | 연간 구독 구매 | 결제 완료 → 서버 tier 'premium' 전환 |
| T3 | 구독 갱신 | Sandbox 5분 후 자동 갱신 → tier 유지 |
| T4 | 구독 취소 | 취소 후 만료일까지 premium 유지 (불변식 #1) |
| T5 | 구독 중 로그아웃 | 로그아웃 시 RC logOut 호출 확인 (불변식 #1) |
| T6 | 구독 후 재가입 (탈퇴 후) | phantom 구독 방지 검증 (불변식 #15) |
| T7 | 이미 구독 중인 계정 구매 시도 | 중복 구매 차단 메시지 표시 (불변식 #11) |

### RevenueCat Sandbox 확인 방법
```
RevenueCat 대시보드 → Customers → Sandbox 토글 ON
→ Sandbox Tester Apple ID로 검색
→ 구독 상태, 이벤트, webhook 수신 확인
```

---

## 📅 예상 일정

| 단계 | 내용 | 예상 소요 |
|------|------|-----------|
| Build 6 수정 | P0 2건 + P1 3건 코드 수정 | 1일 |
| Build 6 EAS 빌드 + TestFlight | `eas build --platform ios --profile production-ios` | 30분 |
| Layer 1~4 실기기 검증 | 26개 테스트 항목 | 1일 |
| 보안 점검 S1~S4 | 정적 분석 + 실기기 | 0.5일 |
| iOS 구독 Sandbox 테스트 T1~T7 | Sandbox Tester 계정 설정 포함 | 0.5일 |
| App Store 제출 | 최종 체크리스트 확인 후 제출 | 0.5일 |
| **총계** | | **~3.5일** |
