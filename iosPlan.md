# MyTravel — iOS App Store 출시 마스터 플랜

> **최우선 원칙**: Android(Google Play) 프로덕션 서비스에 영향 0건
> **목표**: App Store 첫 심사 통과 (거부 없이)
> **예상 일정**: 최단 4주 / 표준 6주 / 최장 9주 (Apple 심사 지연 포함)

---

## 목차

1. [전체 타임라인 및 마일스톤](#1-전체-타임라인-및-마일스톤)
2. [P0 필수 작업 — 심사 거부 직결](#2-p0-필수-작업--심사-거부-직결)
3. [P1 필수 작업 — 출시 전 완료](#3-p1-필수-작업--출시-전-완료)
4. [P2 권장 작업 — 품질 향상](#4-p2-권장-작업--품질-향상)
5. [Apple Developer Account 설정](#5-apple-developer-account-설정)
6. [EAS Build iOS 설정](#6-eas-build-ios-설정)
7. [RevenueCat iOS 설정](#7-revenuecat-ios-설정)
8. [Apple Sign-In 완전 구현](#8-apple-sign-in-완전-구현)
9. [ATT (App Tracking Transparency)](#9-att-app-tracking-transparency)
10. [App Store Connect 메타데이터](#10-app-store-connect-메타데이터)
11. [TestFlight 전략](#11-testflight-전략)
12. [심사 통과 전략](#12-심사-통과-전략)
13. [Android 공존 리스크 관리](#13-android-공존-리스크-관리)
14. [Go/No-Go 체크리스트](#14-gonogo-체크리스트)
15. [신규 불변식](#15-신규-불변식)

---

## 1. 전체 타임라인 및 마일스톤

```
W1 (준비)    Apple Developer 가입 → Bundle ID → ASC 앱 레코드 생성
W2 (빌드)    EAS iOS credentials → IAP 등록 → RC iOS 키 → TestFlight 첫 빌드
W3 (구현)    ATT 구현 → Apple Sign-In + token revoke → Sandbox 결제 E2E 검증
W4 (스토어)  스크린샷 17개 언어 → Privacy Nutrition Label → 메타데이터 완성
W5 (검증)    TestFlight External 7일 → 회귀 테스트 → 심사 제출
W6 (출시)    Apple Review (평균 24~48h) → 단계적 출시 (1%→10%→100%)
```

### 주차별 상세

| 주차 | 마일스톤 | 담당 영역 | Android 영향 |
|------|----------|-----------|-------------|
| W1 | Apple Developer Program 가입 완료 | 계정/설정 | 없음 |
| W1 | Bundle ID `com.travelplanner.app` 등록 | ASC | 없음 |
| W1 | App Store Connect 앱 레코드 생성 | ASC | 없음 |
| W2 | EAS iOS Certificate + Provisioning Profile | 빌드 | 없음 |
| W2 | RevenueCat iOS App 등록 + `appl_` 키 발급 | RC | **확인 필요** |
| W2 | App Store IAP 상품 등록 (월간/연간) | ASC | 없음 |
| W2 | TestFlight Internal 첫 빌드 성공 | 빌드 | 없음 |
| W3 | ATT prompt 구현 + 테스트 | 코드 | 없음 |
| W3 | Apple Sign-In token revoke 구현 | 코드 | 없음 |
| W3 | iOS Paddle 링크 완전 숨김 | 코드 | 없음 |
| W3 | Sandbox 결제 전체 플로우 E2E | QA | 없음 |
| W4 | 스크린샷 제작 (iPhone 6.7", 6.5") | 마케팅 | 없음 |
| W4 | Privacy Nutrition Label 입력 | ASC | 없음 |
| W4 | ko/en/ja 메타데이터 완성 | ASC | 없음 |
| W5 | TestFlight External 베타 (최소 7일) | QA | 없음 |
| W5 | Go/No-Go 체크리스트 전항목 통과 | QA | 없음 |
| W5 | App Store 심사 제출 | ASC | 없음 |
| W6 | 심사 통과 → 단계적 출시 | 출시 | 없음 |

---

## 2. P0 필수 작업 — 심사 거부 직결

> 이 항목 미완료 시 **100% 심사 거부**. 절대 건너뛰지 말 것.

### P0-1. Apple Guideline 3.1.1 — IAP 강제 (웹 결제 링크 숨김)

**✅ 코드 검증 완료 — 추가 작업 불필요**

실제 코드 확인 결과:

- `PaywallModal.tsx`: Paddle 결제는 `Platform.OS === 'web'` 조건 안에만 존재 (`handleRestore`/`handlePurchase` 모두). iOS/Android 네이티브에서는 **이미 RevenueCat IAP만 사용**.
- `SubscriptionScreen.tsx:37~44`: 구독 관리 URL이 **이미 Platform별 분기** 구현됨:
  ```typescript
  if (Platform.OS === 'ios') {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  } else if (Platform.OS === 'android') {
    Linking.openURL('https://play.google.com/store/account/subscriptions?package=com.longpapa82.travelplanner');
  } else {
    // Web only: Paddle 포털
    Linking.openURL('https://mytravel-planner.com/subscription');
  }
  ```

**결론**: Guideline 3.1.1 관련 코드는 이미 iOS 안전. 별도 수정 없이 빌드 가능.

### P0-2. Apple Guideline 4.8 — Sign in with Apple 동등 노출

**문제**: Google/Kakao 로그인 제공 시 Apple Sign-In이 동일한 크기/위치에 있어야 함  
**현재 상태**: 코드는 구현되어 있으나 Apple Review 시 prominence 검토 필수  
**위치**: `frontend/src/screens/auth/LoginScreen.tsx`

체크리스트:
- [ ] Apple 로그인 버튼이 Google/Kakao와 동일한 크기
- [ ] Apple 로그인 버튼이 다른 소셜 로그인보다 아래에 위치하지 않음 (동등 이상)
- [ ] Apple 로그인 버튼 디자인이 Apple HIG 준수 (공식 검정/흰색 버튼)

### P0-3. Apple Guideline 5.1.1(v) — 계정 삭제 + Apple Token Revoke

**문제**: Apple ID로 가입한 유저 탈퇴 시 Apple authorization token revoke 필수  
**현재 상태**: RC DELETE는 구현됨, Apple token revoke **미구현**

**구현 필요 내용**:

```typescript
// backend/src/auth/apple.service.ts (신규)
async revokeAppleToken(userId: string): Promise<void> {
  const user = await this.usersService.findById(userId);
  if (!user.appleRefreshToken) return;

  // Apple Token Revocation Endpoint
  const clientSecret = await this.generateAppleClientSecret();
  await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.APPLE_BUNDLE_ID,
      client_secret: clientSecret,
      token: user.appleRefreshToken,
      token_type_hint: 'refresh_token',
    }),
  });
}
```

`UsersService.remove()`에 통합:
```typescript
// 탈퇴 플로우: RC DELETE → Apple revoke → DB 삭제
async remove(userId: string): Promise<void> {
  await this.revenuecatClient.deleteSubscriber(userId);  // 기존
  await this.appleService.revokeAppleToken(userId);       // 신규
  await this.userRepository.delete(userId);               // 기존
}
```

**DB 스키마 추가** (마이그레이션):
```sql
ALTER TABLE users ADD COLUMN apple_refresh_token TEXT;
ALTER TABLE users ADD COLUMN apple_sub VARCHAR(255);
```

### P0-4. ATT (App Tracking Transparency) 구현

**문제**: AdMob personalized ads 사용 시 iOS 14.5+ ATT prompt 필수. 미구현 시 App Store 거부.  
**현재 상태**: 미구현

→ 상세 구현은 [섹션 9](#9-att-app-tracking-transparency) 참조

### P0-5. Demo Account 제공

**문제**: 로그인이 필요한 앱은 심사자를 위한 데모 계정 필수  
**조치**:
- App Store Connect 심사 노트에 데모 계정 정보 기입
- 데모 계정 생성: `review@mytravel-demo.com` / `Demo1234!`
- 모든 기능이 접근 가능한 프리미엄 계정으로 설정

---

## 3. P1 필수 작업 — 출시 전 완료

### P1-1. RevenueCat iOS 앱 등록 및 키 연동

```typescript
// frontend/src/services/revenueCat.ts
// 현재: REVENUECAT_IOS_KEY = '' (빈 값)
// 수정: eas.json production env에 REVENUECAT_IOS_KEY 추가
```

`eas.json` 수정:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
        "EXPO_PUBLIC_APP_URL": "https://mytravel-planner.com",
        "REVENUECAT_ANDROID_KEY": "goog_BeyiIKXfhmqtbtzaEGMRICChtQd",
        "REVENUECAT_IOS_KEY": "appl_XXXXXXXXXXXXXXXXXXXXXXXXXX",
        "SENTRY_DSN": "..."
      }
    }
  },
  "submit": {
    "production": {
      "android": { ... },
      "ios": {
        "appleId": "systemplanners12@gmail.com",
        "ascAppId": "YOUR_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### P1-2. App Store IAP 상품 등록

App Store Connect → 앱 내 구입:
```
월간 구독:
  Product ID: com.travelplanner.app.premium.monthly
  가격: $3.99 (Tier 4)
  한국: ₩5,500

연간 구독:
  Product ID: com.travelplanner.app.premium.yearly
  가격: $29.99 (Tier 29)
  한국: ₩44,000
```

RevenueCat Entitlement 매핑:
- Entitlement: `premium` (Android와 동일)
- iOS Offering에 위 Product ID 연결

### P1-3. Universal Links (Associated Domains) 확인

`app.json`에 이미 설정됨:
```json
"associatedDomains": ["applinks:mytravel-planner.com"]
```

백엔드에 `apple-app-site-association` 파일 확인:
```bash
curl https://mytravel-planner.com/.well-known/apple-app-site-association
```
없으면 nginx에 추가:
```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "TEAMID.com.travelplanner.app",
      "paths": ["/auth/*", "/app/*"]
    }]
  }
}
```

### P1-4. Sentry iOS 설정

`eas.json`에 iOS Sentry DSN 추가 (Android와 동일 DSN 사용 가능):
```json
"SENTRY_DSN": "https://350b24245c83bb14bc60b074844878d3@o4511263608471552.ingest.de.sentry.io/4511263624265808"
```

### P1-5. iOS 전용 UI 버그 검증

TestFlight에서 반드시 확인할 iOS 전용 이슈:

| 항목 | 확인 방법 | Android 대응 여부 |
|------|----------|------------------|
| Safe Area Inset (노치/Dynamic Island) | 실기기 테스트 | 별도 |
| Keyboard Avoiding View | 입력창 있는 모든 화면 | iOS 전용 `behavior="padding"` |
| StatusBar 스타일 | 라이트/다크 모드 전환 | 별도 |
| Haptic Feedback | 버튼 탭 | iOS 전용 |
| Back Gesture (swipe-back) | 모든 스택 화면 | 해당 없음 |
| ScrollView momentum | 관성 스크롤 | iOS 기본동작 |
| Large Title NavigationBar | iOS 15+ | 해당 없음 |

### P1-6. AdMob iOS 검증

`app.json`에 iOS App ID 이미 설정:
```json
"extra": {
  "eas": { ... }
}
```

`app.config.js` 또는 `app.json`에 다음 확인:
```json
{
  "expo": {
    "plugins": [
      ["expo-ads-admob", {
        "androidAppId": "ca-app-pub-7330738950092177~5475101490",
        "iosAppId": "ca-app-pub-7330738950092177~7468498577"
      }]
    ]
  }
}
```

---

## 4. P2 권장 작업 — 품질 향상

### P2-1. Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

// 버튼 탭 시
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// 결제 성공 시
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

### P2-2. iOS Share Sheet

여행 일정 공유 기능에 iOS 네이티브 Share Sheet 활용:
```typescript
import { Share } from 'react-native';
await Share.share({ message: tripUrl, url: tripUrl });
```

### P2-3. 위젯 (추후)

iOS 16+ Lock Screen Widget — 여행 D-Day 카운터 등 (Phase 2 고려)

---

## 5. Apple Developer Account 설정

### 5-1. 프로그램 가입

**개인(Individual) vs 조직(Organization)**:

| 구분 | 개인 | 조직 |
|------|------|------|
| 연 비용 | $99 | $99 |
| 스토어 표시 | 개인명 | 사업자명 |
| D-U-N-S 번호 | 불필요 | 필요 (2주 소요) |
| 권장 | 초기 출시 | 사업자 등록 후 |

→ **사업자 등록증이 있으므로 Organization 권장** (D-U-N-S 먼저 신청)

```
D-U-N-S 신청: https://developer.apple.com/enroll/duns-lookup/
처리 기간: 최대 5 영업일 (실제 2~3일)
```

### 5-2. 가입 절차

```
1. https://developer.apple.com/programs/enroll/ 접속
2. Apple ID로 로그인 (2FA 필수)
3. Entity Type: Organization 선택
4. D-U-N-S 번호 입력
5. 법인명/주소 입력
6. $99 결제 (달러 카드 필요)
7. 승인 이메일 대기 (1~3일)
```

### 5-3. 필수 설정

```
Certificates, Identifiers & Profiles:
  ① App ID 등록
     - Bundle ID: com.travelplanner.app
     - Capabilities: Sign In with Apple, Associated Domains, In-App Purchase
  
  ② Distribution Certificate 생성 (EAS가 자동 처리 가능)
  
  ③ App Store Connect API Key 생성
     - Role: Admin
     - 다운로드 후 EAS에 등록
```

---

## 6. EAS Build iOS 설정

### 6-1. EAS Credentials 설정

```bash
cd frontend

# iOS credentials 설정 (자동 생성 권장)
eas credentials --platform ios

# 선택: Expo가 자동으로 Certificate + Profile 생성
# → Apple Developer Portal에 자동 등록됨
```

### 6-2. eas.json iOS 프로파일 추가

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Release"
      }
    },
    "staging": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Release"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
        "EXPO_PUBLIC_APP_URL": "https://mytravel-planner.com",
        "REVENUECAT_IOS_KEY": "appl_XXXXXX",
        "SENTRY_DSN": "..."
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
        "EXPO_PUBLIC_APP_URL": "https://mytravel-planner.com",
        "REVENUECAT_ANDROID_KEY": "goog_BeyiIKXfhmqtbtzaEGMRICChtQd",
        "REVENUECAT_IOS_KEY": "appl_XXXXXX",
        "SENTRY_DSN": "..."
      },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "production"
      },
      "ios": {
        "appleId": "systemplanners12@gmail.com",
        "ascAppId": "FILL_AFTER_ASC_CREATION",
        "appleTeamId": "FILL_AFTER_DEVELOPER_ACCOUNT"
      }
    }
  }
}
```

### 6-3. iOS 빌드 명령어

```bash
# Simulator 빌드 (테스트용)
eas build --platform ios --profile development --local

# TestFlight 빌드
eas build --platform ios --profile production

# TestFlight 제출
eas submit --platform ios --profile production

# Android + iOS 동시 빌드 (시간 절약)
eas build --platform all --profile production
```

### 6-4. app.json iOS 섹션 완성

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.travelplanner.app",
      "buildNumber": "1",
      "usesAppleSignIn": true,
      "associatedDomains": [
        "applinks:mytravel-planner.com"
      ],
      "config": {
        "usesNonExemptEncryption": false,
        "googleMapsApiKey": "YOUR_IOS_MAPS_KEY"
      },
      "infoPlist": {
        "CFBundleURLTypes": [{
          "CFBundleURLSchemes": ["travelplanner"]
        }],
        "NSUserTrackingUsageDescription": "This allows us to show you personalized travel deals and offers.",
        "NSPhotoLibraryUsageDescription": "MyTravel needs access to your photo library to add photos to your trips.",
        "NSLocationWhenInUseUsageDescription": "We use your location to find nearby places for your trip.",
        "ITSAppUsesNonExemptEncryption": false
      }
    }
  }
}
```

---

## 7. RevenueCat iOS 설정

> **Android 서비스 영향 0**: iOS App은 별도 플랫폼으로 추가. 기존 Android 설정 변경 없음.

### 7-1. RC 대시보드에서 iOS App 추가

```
RevenueCat Dashboard → Project: travelPlanner
→ Apps → Add New App
→ Platform: App Store
→ App Name: MyTravel
→ Bundle ID: com.travelplanner.app
→ App Store Connect API Key 등록
→ 생성된 iOS Public Key (appl_XXXX) 복사
```

### 7-2. iOS Offering 설정

**옵션 A (권장): 동일 Entitlement, iOS Offering 추가**
```
Entitlement: "premium" (기존 Android와 공유)
  ↓
Products:
  Android: goog_monthly, goog_yearly (기존 유지)
  iOS: ios_monthly (com.travelplanner.app.premium.monthly)
       ios_yearly  (com.travelplanner.app.premium.yearly)
  ↓
Offering:
  "default" (기존 Android offering 유지)
  "ios_default" (iOS 전용 신규 offering 생성)
```

**코드에서 분기**:
```typescript
// frontend/src/services/revenueCat.ts
const offeringIdentifier = Platform.OS === 'ios' ? 'ios_default' : 'default';
const offerings = await Purchases.getOfferings();
const offering = offerings.all[offeringIdentifier] ?? offerings.current;
```

### 7-3. RC 불변식 준수 (기존 #16 확장)

iOS에서도 동일하게 적용:
- `purchasePackage()` 직전 `Purchases.logIn(userId)` 호출 (불변식 #16)
- 탈퇴 시 RC DELETE (불변식 #15)
- preflight dual-source 검증 (불변식 #10)

### 7-4. iOS Sandbox 테스트 계정

```
App Store Connect → Users and Access → Sandbox Testers
→ Add Tester
→ Email: sandbox@mytravel-test.com
→ Password: Test1234!
```

Sandbox 결제 특성:
- 월간 구독: 실제 1달 → Sandbox 5분
- 연간 구독: 실제 1년 → Sandbox 1시간
- 결제 취소: 즉시 반영

---

## 8. Apple Sign-In 완전 구현

### 8-1. 백엔드 Apple OAuth 엔드포인트

```typescript
// backend/src/auth/apple.strategy.ts
import { Strategy as AppleStrategy } from 'passport-apple';

@Injectable()
export class AppleStrategy extends PassportStrategy(AppleStrategy, 'apple') {
  constructor(private usersService: UsersService) {
    super({
      clientID: process.env.APPLE_BUNDLE_ID,      // com.travelplanner.app
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      privateKeyString: process.env.APPLE_PRIVATE_KEY,
      callbackURL: `${process.env.API_URL}/auth/apple/callback`,
      scope: ['name', 'email'],
      passReqToCallback: true,
    });
  }

  async validate(req, accessToken, refreshToken, idToken, profile, done) {
    const { sub: appleSub, email } = idToken;
    let user = await this.usersService.findByAppleSub(appleSub);
    if (!user) {
      user = await this.usersService.createFromApple({
        appleSub,
        email,
        appleRefreshToken: refreshToken,
      });
    }
    return done(null, user);
  }
}
```

### 8-2. Apple Client Secret 생성

Apple Sign-In은 JWT client_secret을 매 요청마다 생성해야 함 (최대 6개월 만료):

```typescript
// backend/src/auth/apple.service.ts
import * as jwt from 'jsonwebtoken';

generateAppleClientSecret(): string {
  const privateKey = process.env.APPLE_PRIVATE_KEY; // .p8 파일 내용
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: 'https://appleid.apple.com',
    issuer: process.env.APPLE_TEAM_ID,
    subject: process.env.APPLE_BUNDLE_ID,
    keyid: process.env.APPLE_KEY_ID,
  });
}
```

### 8-3. Apple Token Revoke (P0-3)

```typescript
// backend/src/users/users.service.ts
async remove(userId: string): Promise<void> {
  const user = await this.findById(userId);

  // 1. RC DELETE (기존 불변식 #15)
  await this.revenuecatClient.deleteSubscriber(userId).catch(() => {});

  // 2. Apple token revoke (신규 불변식 #57)
  if (user.appleRefreshToken) {
    const clientSecret = this.appleService.generateAppleClientSecret();
    await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.APPLE_BUNDLE_ID,
        client_secret: clientSecret,
        token: user.appleRefreshToken,
        token_type_hint: 'refresh_token',
      }),
    }).catch(() => {}); // fail-close: 실패해도 탈퇴 진행
  }

  // 3. DB 삭제
  await this.userRepository.delete(userId);
}
```

### 8-4. 환경변수 추가

```bash
# .env (backend)
APPLE_BUNDLE_ID=com.travelplanner.app
APPLE_TEAM_ID=YOUR_TEAM_ID            # Apple Developer 계정에서 확인
APPLE_KEY_ID=YOUR_KEY_ID              # ASC → Keys에서 생성
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

---

## 9. ATT (App Tracking Transparency)

### 9-1. 구현 위치

**ConsentScreen 완료 직후 → AdMob 초기화 직전** (불변식 #56):

```typescript
// frontend/src/lib/att.ts
import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';

export async function requestATTPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;

  const { status } = await TrackingTransparency.getTrackingPermissionsAsync();

  if (status === 'undetermined') {
    const { status: requested } =
      await TrackingTransparency.requestTrackingPermissionsAsync();
    return requested === 'granted';
  }

  return status === 'granted';
}
```

### 9-2. AdMob 연동

```typescript
// frontend/src/lib/admob.ts
import { requestATTPermission } from './att';
import mobileAds from 'react-native-google-mobile-ads';

export async function initializeAdMob(): Promise<void> {
  if (Platform.OS === 'ios') {
    await requestATTPermission();
  }

  await mobileAds().initialize();
}
```

### 9-3. app.json 설정

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSUserTrackingUsageDescription": "개인화된 여행 광고와 혜택을 보여드리기 위해 사용됩니다."
      }
    }
  }
}
```

### 9-4. GDPR + ATT 순서

```
앱 첫 실행
  → ConsentScreen (GDPR/개인정보 동의)
  → ATT Prompt (iOS 14.5+만)
  → AdMob 초기화
  → 광고 로드
```

---

## 10. App Store Connect 메타데이터

### 10-1. 기본 정보

```
앱 이름: MyTravel - AI 여행 계획
부제(Subtitle): AI로 완성하는 완벽한 여행
카테고리: Travel (기본) / Utilities (보조)
연령 등급: 4+ (광고 있으므로 실제 설정 주의)
```

### 10-2. 스크린샷 규격

**필수 규격**:
| 기기 | 해상도 | 개수 |
|------|--------|------|
| iPhone 6.7" (iPhone 15 Pro Max) | 1290×2796 | 최대 10장 |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242×2688 | 최대 10장 |
| iPad Pro 12.9" (선택) | 2048×2732 | 최대 10장 |

**촬영 도구**:
```bash
# Expo Simulator 스크린샷
# Xcode iOS Simulator에서 Cmd+S로 저장
```

**필수 스크린 (우선순위)**:
1. 홈/여행 목록 (메인)
2. AI 여행 생성 화면
3. 여행 상세/일정
4. 지도 뷰
5. 프로필/구독 화면

### 10-3. 앱 설명 (ko/en/ja 우선)

```
[한국어 짧은 설명 — 30자 이내]
AI가 만들어주는 나만의 완벽한 여행 계획

[한국어 자세한 설명 — 4000자 이내]
MyTravel은 AI 기술로 여행 계획을 자동으로 생성해주는 스마트 여행 앱입니다.

주요 기능:
• AI 자동 일정 생성 — 목적지, 기간, 취향을 입력하면 완벽한 일정 완성
• 17개 언어 지원 — 전 세계 어디서나 편리하게
• 실시간 날씨 정보 — 여행지 날씨를 일정에 반영
• 지도 통합 — 장소별 위치와 경로 한눈에 확인
• 오프라인 저장 — 인터넷 없이도 일정 확인 가능

프리미엄 기능:
• 무제한 여행 계획 생성
• 광고 없는 깔끔한 경험
• 우선 고객 지원
```

### 10-4. Privacy Nutrition Label (필수)

App Store Connect → Privacy → 데이터 유형별 입력:

| 데이터 | 사용 목적 | 추적 여부 |
|--------|----------|---------|
| Email | 계정 생성 | 아니오 |
| Name | 프로필 | 아니오 |
| User ID | 앱 기능 | 아니오 |
| 광고 ID | 광고 (ATT 동의 후) | 예 |
| 구매 이력 | 결제 처리 | 아니오 |
| 충돌 데이터 | 앱 개선 | 아니오 |

### 10-5. 키워드 (100자 이내, 쉼표 구분)

```
travel,여행,trip,AI,itinerary,planner,schedule,vacation,일정,여행계획,트립,투어,tour
```

---

## 11. TestFlight 전략

### 11-1. Internal 테스터 (즉시 시작 가능)

```
대상: 개발팀 (최대 100명)
리뷰 없이 즉시 빌드 배포
목적: 개발 중 빠른 피드백
```

### 11-2. External 테스터 (심사 전 필수)

```
대상: 실제 사용자 (최대 10,000명)
App Store 간단 심사 후 배포 (1~2일)
최소 진행 기간: 7일 (심사 제출 전 권장)
```

### 11-3. TestFlight 체크리스트

Internal 단계에서 확인:
- [ ] 앱 정상 실행 (크래시 없음)
- [ ] Google Sign-In 동작
- [ ] Apple Sign-In 동작
- [ ] Kakao Sign-In 동작
- [ ] AI 여행 생성 기능
- [ ] RC Sandbox 결제 성공
- [ ] ATT 프롬프트 정상 표시
- [ ] AdMob 광고 표시 (ATT 동의 후)
- [ ] 탈퇴 기능 (Apple token revoke 포함)
- [ ] 네트워크 오프라인 대응
- [ ] 다크 모드 대응
- [ ] Dynamic Island / notch 영역 처리

---

## 12. 심사 통과 전략

### 12-1. 심사 거부 빈도 높은 항목

| 항목 | 대응 |
|------|------|
| 3.1.1 외부 결제 링크 | iOS에서 Paddle 링크 완전 숨김 |
| 4.8 Apple Sign-In | Google/Kakao와 동등 prominence |
| 5.1.1(v) 계정 삭제 | Apple token revoke 구현 |
| 2.1 크래시 | TestFlight Internal 7일 이상 테스트 |
| 1.2 개인정보 목적 불일치 | Privacy Label 정확히 기재 |
| 5.1.2 어린이 데이터 | 광고 있으면 연령 등급 주의 |

### 12-2. 심사 노트 작성

```
심사 노트 (영문):

Demo Account:
Email: review@mytravel-demo.com
Password: Demo1234!

This account has Premium features enabled for review purposes.

Key Features to Test:
1. AI Trip Generation: Tap "+" → Enter destination → Generate
2. Premium Paywall: Profile → Upgrade to Premium
3. Apple Sign-In: Login screen → "Continue with Apple"

Note:
- AI generation requires internet connection
- Sandbox payment testing is available with Apple Sandbox account
- App supports 17 languages
```

### 12-3. 빠른 심사 팁

- 심사 노트에 기능 설명 명확히 기재
- 스크린샷에 앱의 핵심 가치 명확히 표현
- Privacy Policy URL 유효성 확인 (mytravel-planner.com/privacy 접근 가능)
- Support URL 유효성 확인
- 마케팅 URL (선택)

---

## 13. Android 공존 리스크 관리

### 13-1. 코드 변경 격리 원칙

| 변경 유형 | 격리 방법 | Android 영향 |
|-----------|----------|-------------|
| iOS 전용 UI | `Platform.OS === 'ios'` 조건부 | 없음 |
| iOS 전용 기능 | `*.ios.ts` 파일 분리 | 없음 |
| 공유 로직 수정 | 기존 로직 유지 + iOS 조건 추가 | 테스트 필요 |
| 백엔드 변경 | Feature flag + 회귀 테스트 | 316/416 기준 유지 |

### 13-2. 백엔드 변경 시 프로토콜

```
1. 변경 범위 확인: Android 공유 엔드포인트 여부
2. 마이그레이션 시 기존 데이터 보호 검증
3. 배포 전 Backend Jest 416/416 PASS 확인
4. 카나리 배포: 5% 트래픽 → 이상 없으면 100%
5. 롤백 기준: 5xx 에러 1% 초과 시 즉시 롤백
```

### 13-3. RevenueCat 공존 설정

```
Android 기존 Entitlement: "premium" (변경 없음)
iOS 신규 Product: com.travelplanner.app.premium.*
공유 Entitlement: "premium" (Android/iOS 모두 동일)
→ DB 구독 상태 확인 로직 변경 없음
→ 백엔드 webhook 처리: platform 필드로 분기
```

### 13-4. 공유 백엔드 Apple Sign-In 추가 시 주의

```typescript
// 기존 Google/Kakao 엔드포인트 변경 없음
// Apple 엔드포인트 신규 추가만
@Get('apple')
@Get('apple/callback')
// → Android에서 이 엔드포인트 호출 없으므로 영향 없음
```

### 13-5. DB 마이그레이션 안전 기준

```sql
-- 추가만 허용 (기존 컬럼/테이블 변경 금지)
ALTER TABLE users ADD COLUMN apple_sub VARCHAR(255);
ALTER TABLE users ADD COLUMN apple_refresh_token TEXT;

-- 인덱스 추가 (기존 쿼리에 영향 없음)
CREATE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub);
```

---

## 14. Go/No-Go 체크리스트

### 기술 체크리스트

**P0 (전부 통과해야 심사 제출 가능)**:
- [ ] Apple Sign-In 동작 확인 (TestFlight)
- [ ] Apple token revoke 구현 및 테스트
- [ ] ATT prompt 정상 표시 확인
- [ ] iOS에서 Paddle 링크 숨김 확인
- [ ] RC Sandbox 결제 전체 플로우 통과
- [ ] 탈퇴 플로우 iOS 검증 (RC DELETE + Apple revoke)
- [ ] 데모 계정 생성 및 모든 기능 접근 확인

**P1 (심사 전 완료)**:
- [ ] TestFlight External 7일 이상 운영
- [ ] 크래시 0건 (Sentry iOS 대시보드)
- [ ] Frontend TypeScript 0 errors
- [ ] Backend Jest 416/416 PASS
- [ ] Privacy Nutrition Label 입력 완료
- [ ] 스크린샷 6.7" / 6.5" 업로드
- [ ] 앱 설명 ko/en/ja 완성
- [ ] Privacy Policy URL 유효 확인
- [ ] Support URL 유효 확인
- [ ] Associated Domains 동작 확인

**Android 공존 확인**:
- [ ] Android 빌드 정상 동작 (회귀 없음)
- [ ] Android RevenueCat 결제 정상
- [ ] 공유 백엔드 5xx 에러 0건
- [ ] 마이그레이션 후 기존 Android 유저 데이터 정상

### 출시 체크리스트

- [ ] Apple Developer Program 가입 완료
- [ ] App Store Connect 앱 레코드 생성
- [ ] Bundle ID `com.travelplanner.app` 등록
- [ ] IAP 상품 등록 (월간/연간)
- [ ] RC iOS 앱 등록 + appl_ 키 설정
- [ ] eas.json iOS submit 설정 완료
- [ ] 심사 노트 작성 (영문)
- [ ] 단계적 출시 설정: 1%→10%→100%

---

## 15. 신규 불변식

iOS 출시 후 `CLAUDE.md` 핵심 불변식에 추가:

```
#56 ATT prompt는 ConsentScreen 직후 + AdMob init 직전에만 호출
    위치: frontend/src/lib/att.ts + admob.ts
    위반 시: iOS 앱 심사 거부 (ATT 미구현) 또는 광고 수익 손실

#57 Apple ID 탈퇴 시 RC DELETE + Apple token revoke 모두 fail-close
    위치: backend/src/users/users.service.ts
    위반 시: Apple Guideline 5.1.1(v) 위반 → 심사 거부 또는 앱 삭제

#58 iOS에서 외부 결제 링크(Paddle) 완전 숨김
    Platform.OS !== 'ios' 조건 필수
    위반 시: Apple Guideline 3.1.1 위반 → 즉시 심사 거부

#59 Apple Sign-In은 다른 소셜 로그인과 동등 prominence
    Button 크기/위치 동일, Apple HIG 준수 디자인
    위반 시: Apple Guideline 4.8 위반 → 심사 거부
```

---

## 부록 A. 비용 분석 (iOS 추가)

| 항목 | 비용 | 비고 |
|------|------|------|
| Apple Developer Program | $99/년 | 연간 갱신 |
| App Store 수수료 | 30% (첫해 15%) | 소규모 개발자 프로그램 |
| EAS Build (iOS) | 무료 티어 or 월 $29 | 월 15빌드 초과 시 |
| Sentry iOS | 기존 플랜 공유 | 추가 비용 없음 |
| RC iOS | 기존 플랜 공유 | 추가 비용 없음 |
| AdMob iOS | 수익 발생 시 | eCPM iOS > Android 통상 |

---

## 부록 B. 긴급 롤백 절차

심사 통과 후 iOS 전용 심각한 버그 발생 시:

```
1. App Store Connect → 버전 → Pause Phased Release
   (단계적 출시 중이면 즉시 일시정지)

2. 빠른 수정 후 긴급 빌드
   eas build --platform ios --profile production

3. Expedited Review 요청
   App Store Connect → 앱 → 버전 정보 → 연락처 정보 → 신속 검토 요청

4. Android 롤백 불필요 (iOS 전용 이슈)
   단, 공유 백엔드 이슈면 Android도 영향 → 즉시 이전 버전 배포
```

---

*최종 업데이트: 2026-05-01*  
*작성: plan-q + Claude Code*  
*다음 검토: Apple Developer Program 가입 완료 시*
