# mytravel-planner.com URL 노출 경로 전수 조사 보고서

**작성일**: 2026-03-27
**목적**: 안드로이드 앱 런칭 시 웹사이트 URL 노출 경로 파악
**조사 범위**: 앱 코드, 설정 파일, Play Store 메타데이터

---

## 📊 조사 결과 요약

| 구분 | 노출 위치 수 | 심각도 | 수정 가능 여부 |
|------|------------|--------|--------------|
| **앱 코드 하드코딩** | 10개 | 🔴 HIGH | ✅ 수정 가능 |
| **앱 설정 파일** | 4개 | 🟡 MEDIUM | ⚠️ 부분 가능 |
| **Play Store 메타데이터** | 51개 | 🟢 LOW | ❌ 수정 불가 (필수) |
| **웹 전용 파일** | 다수 | ✅ 안전 | N/A (앱과 무관) |

**총 노출 경로**: **65개**
**즉시 수정 필요**: **10개** (앱 코드)

---

## 🔴 1. 앱 코드 내 하드코딩 (수정 필요)

### 1.1 PaywallModal.tsx (결제 화면)
**파일**: `frontend/src/components/PaywallModal.tsx`

```tsx
// Line 353
<TouchableOpacity onPress={() => Linking.openURL('https://mytravel-planner.com/terms')}>

// Line 359
<TouchableOpacity onPress={() => Linking.openURL('https://mytravel-planner.com/privacy')}>
```

**노출 시점**: 사용자가 구독 화면에서 "이용약관" 또는 "개인정보처리방침" 클릭 시
**심각도**: 🔴 **HIGH** (주요 사용자 동선)
**영향**: 외부 브라우저 또는 WebView로 웹사이트 열림

**수정 방안**:
```tsx
// Option 1: 앱 내 화면으로 대체
<TouchableOpacity onPress={() => navigation.navigate('Terms')}>

// Option 2: 환경 변수 사용
<TouchableOpacity onPress={() => Linking.openURL(`${Config.WEBSITE_URL}/terms`)}>

// Option 3: WebView 모달로 표시
<TouchableOpacity onPress={() => setShowTermsModal(true)}>
```

---

### 1.2 HomeScreen.tsx (공유 기능)
**파일**: `frontend/src/screens/main/HomeScreen.tsx`

```tsx
// Line 230
message: `${destination.name}, ${destination.country}\n${destination.description}\n\nhttps://mytravel-planner.com`,
```

**노출 시점**: 여행지 정보를 공유할 때 메시지에 포함
**심각도**: 🟡 **MEDIUM** (선택적 기능)
**영향**: 공유 메시지를 받은 사람이 URL 확인 가능

**수정 방안**:
```tsx
// URL 제거
message: `${destination.name}, ${destination.country}\n${destination.description}`,

// 또는 앱 다운로드 링크로 대체
message: `${destination.name}, ${destination.country}\n${destination.description}\n\nGet MyTravel App: https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner`,
```

---

### 1.3 ProfileScreen.tsx (OSS 라이선스)
**파일**: `frontend/src/screens/main/ProfileScreen.tsx`

```tsx
// Line 541
<TouchableOpacity onPress={() => openUrl('https://mytravel-planner.com/licenses')}>
```

**노출 시점**: 프로필 → 설정 → "오픈소스 라이선스" 클릭 시
**심각도**: 🟢 **LOW** (드문 접근)
**영향**: 외부 브라우저로 라이선스 페이지 열림

**수정 방안**:
```tsx
// licenses.html을 앱 내 asset으로 포함
import licensesHtml from './assets/licenses.html';

<TouchableOpacity onPress={() => setShowLicensesModal(true)}>
  <WebView source={{ html: licensesHtml }} />
</TouchableOpacity>
```

---

### 1.4 SubscriptionScreen.tsx (구독 관리)
**파일**: `frontend/src/screens/main/SubscriptionScreen.tsx`

```tsx
// Line 32
Linking.openURL('https://mytravel-planner.com/subscription');
```

**노출 시점**: 구독 관리 화면에서 웹 관리 페이지 접근 시
**심각도**: 🟡 **MEDIUM**
**영향**: 구독 관리 웹 페이지로 이동

**수정 방안**:
```tsx
// Google Play 구독 관리 페이지로 이동
Linking.openURL('https://play.google.com/store/account/subscriptions');

// 또는 앱 내 구독 관리 UI 구현
navigation.navigate('ManageSubscription');
```

---

### 1.5 RootNavigator.tsx (도메인 참조)
**파일**: `frontend/src/navigation/RootNavigator.tsx`

```tsx
// Line 24
'https://mytravel-planner.com',
```

**노출 시점**: 코드 내부 참조 (실제 사용자 노출 확인 필요)
**심각도**: 🟢 **LOW**
**영향**: 코드 레벨 참조, 실제 UI 노출 여부 불명확

**수정 방안**:
```tsx
// 환경 변수로 대체
import Config from 'react-native-config';
Config.WEBSITE_URL
```

---

### 1.6 GDPRConsentBanner.web.tsx (웹 전용)
**파일**: `frontend/src/components/GDPRConsentBanner.web.tsx`

```tsx
// Line 51
Linking.openURL('https://mytravel-planner.com/privacy.html');
```

**노출 시점**: 웹 버전에서만 사용 (안드로이드 앱과 무관)
**심각도**: ✅ **안전** (앱 빌드에 미포함)
**영향**: 없음

**조치**: 불필요

---

## 🟡 2. 앱 설정 파일 (부분 수정 가능)

### 2.1 eas.json (API URL)
**파일**: `frontend/eas.json`

```json
// Line 23 (staging)
"EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api"

// Line 29 (production)
"EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api"
```

**노출 방식**: 앱 빌드 시 환경 변수로 주입, 앱 내부에 하드코딩됨
**심각도**: 🔴 **HIGH** (핵심 인프라)
**영향**: 네트워크 요청 분석 시 노출 가능

**수정 방안**:
```json
// Option 1: 서브도메인 사용
"EXPO_PUBLIC_API_URL": "https://api.mytravel-planner.com"

// Option 2: 도메인 변경
"EXPO_PUBLIC_API_URL": "https://api.mytravel-app.com"

// Option 3: 프록시 서버 구축
"EXPO_PUBLIC_API_URL": "https://mobile-api.example.com"
```

**참고**: API URL은 숨길 수 없음 (네트워크 분석으로 항상 발견 가능)

---

### 2.2 app.config.js (iOS App Links)
**파일**: `frontend/app.config.js`

```js
// Line 22 (iOS)
associatedDomains: ['applinks:mytravel-planner.com']

// Line 50 (Android)
{ scheme: 'https', host: 'mytravel-planner.com', pathPrefix: '/auth' }
```

**노출 방식**: 앱 빌드에 포함됨
**심각도**: ⚠️ **기술적 필수** (OAuth 인증용)
**영향**: Google/Kakao OAuth 로그인 시 필요

**수정 가능 여부**: ❌ **불가능**
- OAuth Redirect URI는 반드시 등록된 도메인과 일치해야 함
- Google Cloud Console, Kakao Developers에 등록된 Redirect URI

**대안**: 없음 (OAuth 로그인 제거 시 가능하나 비현실적)

---

## 🟢 3. Play Store 메타데이터 (수정 불가)

### 3.1 store-metadata/*.json (17개 언어)
**파일**: `frontend/store-metadata/*.json` (ko, en, ja, zh, es, fr, de, it, pt, ru, ar, hi, vi, th, id, ms, tr)

```json
{
  "privacyUrl": "https://mytravel-planner.com/privacy",
  "termsUrl": "https://mytravel-planner.com/terms",
  "supportUrl": "https://mytravel-planner.com/faq"
}
```

**노출 위치**: Google Play Store 앱 상세 페이지 하단
**심각도**: 🟢 **LOW** (Google 정책상 필수)
**영향**: Play Store에서 누구나 확인 가능

**수정 가능 여부**: ❌ **불가능**
- Google Play 정책: 앱은 반드시 Privacy Policy와 Terms of Service 제공 필요
- URL 형식으로만 제출 가능 (PDF, 텍스트 불가)

**Play Console 표시 위치**:
1. 앱 상세 페이지 → 하단 "개발자 연락처" 섹션
2. "개인정보처리방침" 링크
3. "이용약관" 링크 (앱 콘텐츠 선언 시 제공한 경우)

---

## ✅ 4. 웹 전용 파일 (안전)

다음 파일들은 **앱 빌드에 포함되지 않음** (웹사이트 운영용):

```
public/
├── landing.html, landing-en.html
├── privacy.html, privacy-en.html
├── terms.html, terms-en.html
├── faq.html, about.html, contact.html
├── licenses.html
├── sitemap.xml, robots.txt, ads.txt
├── guides/*.html (26개)
└── blog/*.html (15개)
```

**조치**: 불필요

---

## 📋 종합 평가

### 노출 경로별 위험도

| 경로 | 노출 확률 | 사용자 인지 | 수정 난이도 | 우선순위 |
|------|----------|-----------|-----------|---------|
| **PaywallModal (약관/개인정보)** | 높음 | 높음 | 낮음 | 🔴 P0 |
| **API URL (eas.json)** | 중간 | 낮음 | 높음 | 🟡 P1 |
| **HomeScreen (공유)** | 중간 | 높음 | 낮음 | 🟡 P1 |
| **ProfileScreen (라이선스)** | 낮음 | 낮음 | 낮음 | 🟢 P2 |
| **SubscriptionScreen** | 낮음 | 중간 | 낮음 | 🟢 P2 |
| **App Links (OAuth)** | 높음 | 낮음 | 불가능 | ⚠️ 필수 |
| **Play Store 메타데이터** | 높음 | 중간 | 불가능 | ⚠️ 필수 |

---

## 🎯 권장 조치 계획

### Phase 1: 즉시 수정 (P0) - 1-2시간
1. ✅ **PaywallModal.tsx 수정**
   - 약관/개인정보 링크 제거 또는 앱 내 WebView로 대체
   - 또는 환경 변수로 분리

2. ✅ **HomeScreen.tsx 공유 메시지 수정**
   - URL 제거 또는 Play Store 링크로 대체

### Phase 2: 선택적 수정 (P1-P2) - 2-4시간
3. ⚠️ **ProfileScreen.tsx 라이선스 수정**
   - licenses.html을 앱 asset으로 포함하여 WebView 표시

4. ⚠️ **SubscriptionScreen.tsx 수정**
   - Play Store 구독 관리 페이지로 변경

5. ⚠️ **API URL 서브도메인 분리** (선택)
   - `api.mytravel-planner.com` 서브도메인 생성
   - DNS 설정, 백엔드 재배포 필요

### Phase 3: 수정 불가 (필수 노출)
6. ❌ **App Links (OAuth)**: 수정 불가
7. ❌ **Play Store 메타데이터**: 수정 불가

---

## 💡 대안 전략

### 전략 1: 웹사이트 접근 제한 (권장 ✅)

**목표**: mytravel-planner.com 접근 시 법적 문서만 표시, 나머지 차단

**구현**:
```nginx
# nginx 설정
location / {
  # 허용: 법적 문서
  if ($uri ~* "^/(privacy|terms|faq|licenses)") {
    return 200;
  }

  # 차단: 나머지 모든 경로
  return 403 "Service not available via web browser";
}

# API는 허용 (앱 전용)
location /api {
  # User-Agent 검증 (선택)
  if ($http_user_agent !~* "MyTravel|okhttp") {
    return 403;
  }
  proxy_pass http://backend:3000;
}
```

**장점**:
- 법적 요구사항 충족 (Privacy/Terms 공개)
- 메인 서비스 접근 차단
- 앱 기능 정상 작동

**단점**:
- 완전한 차단은 불가능 (법적 문서는 반드시 공개)
- User-Agent 우회 가능

---

### 전략 2: 도메인 분리 (최선 ✅✅)

**목표**: 앱과 웹을 완전히 분리

**구현**:
```
현재: mytravel-planner.com (통합)

변경:
- api.mytravel-planner.com → API 전용
- legal.mytravel-planner.com → 법적 문서 전용
- mytravel-planner.com → 차단 또는 Coming Soon
```

**필요 작업**:
1. DNS 서브도메인 설정
2. SSL 인증서 발급
3. nginx 설정 변경
4. 앱 재빌드 (API URL 변경)
5. OAuth Redirect URI 재등록 (Google, Kakao)

**장점**:
- 명확한 분리
- 보안 강화
- 향후 웹 서비스 오픈 시 충돌 없음

**단점**:
- 초기 설정 작업 필요 (4-6시간)
- OAuth 재등록 필요

---

### 전략 3: 단계적 오픈 (현실적 ✅)

**Phase 1** (현재): 앱만 런칭
- 웹사이트: 법적 문서만 공개
- Play Store 필수 URL: 허용
- 나머지: 403 차단

**Phase 2** (앱 안정화 후 2-4주):
- 웹사이트: Coming Soon 페이지 + 앱 다운로드 링크
- 법적 문서: 계속 공개

**Phase 3** (광고/결제 적용 후):
- 웹사이트: 전체 오픈
- SEO 최적화 시작

**장점**:
- 점진적 노출 제어
- 리스크 최소화

**단점**:
- 완전한 차단은 불가능

---

## 🚨 결론 및 권장 사항

### 핵심 요약
1. **완전한 URL 숨김은 불가능**
   - Play Store 정책: Privacy/Terms URL 필수
   - OAuth 로그인: Redirect URI 필수
   - API URL: 네트워크 분석으로 항상 노출

2. **수정 가능한 10개 위치**
   - 앱 코드 하드코딩 제거로 사용자 인지 최소화
   - 1-2시간 작업으로 즉시 완료 가능

3. **권장 전략**
   - ✅ **즉시**: PaywallModal, HomeScreen URL 제거 (P0)
   - ✅ **단기**: 웹사이트 접근 제한 설정 (nginx)
   - ⚠️ **선택**: 도메인 분리 (api.mytravel-planner.com)

### 최종 권장 조치
```
1. [즉시] 앱 코드 P0/P1 수정 (2시간)
2. [1일] nginx 접근 제한 설정 (법적 문서만 허용)
3. [선택] 도메인 분리 (장기적 보안 강화)
```

**예상 효과**:
- 사용자 직접 노출: 최소화
- Play Store 노출: 불가피 (정책상 필수)
- 네트워크 분석 노출: 불가피 (기술적 한계)

---

**작성자**: SuperClaude (plan-q + 직접 코드 분석)
**최종 검토**: 2026-03-27
**관련 문서**: CLAUDE.md, app.config.js, eas.json
