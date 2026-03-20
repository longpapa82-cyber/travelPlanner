# SNS 로그인 출시 전 체크리스트

> **최종 업데이트**: 2026-03-20
> **목적**: Android 프로덕션 출시를 위한 SNS 로그인 설정 검증 및 완료

---

## 📋 출시 전략

### Phase 1: Android 우선 출시 (즉시)
- ✅ **Google OAuth**: 설정 완료, 테스트 사용자 추가 필요
- ✅ **Kakao OAuth**: 설정 완료, Redirect URI 확인 필요
- ⏸️ **Apple Sign-In**: Android 출시 후 iOS 준비 시 진행

### Phase 2: iOS 출시 (Android 출시 이후)
- 🔜 **Apple Sign-In**: iOS 앱 준비 시 설정 (현재 미설정)

---

## 🔴 Phase 1: Android 출시 - 즉시 조치 필요

### 1. Google OAuth 동의 화면 설정 ⚠️ **CRITICAL**

#### 현재 상태 (2026-03-20 확인)
```yaml
게시 상태: 테스트 중
테스트 사용자: 0명
사용자 한도: 100명
외부 유형: 외부
```

**문제점**: 테스트 사용자가 0명이므로 **현재 아무도 Google 로그인 불가**

#### Option A: 프로덕션 게시 (권장) ✅

**장점**:
- 모든 Google 계정으로 즉시 로그인 가능
- 사용자 수 제한 없음
- 별도 테스트 사용자 관리 불필요

**작업 절차**:
1. [ ] Google Cloud Console 접속
   ```
   https://console.cloud.google.com/apis/credentials/consent?project=tripplanner-486511
   ```

2. [ ] "테스트 중" 섹션에서 **"프로덕션으로 게시"** 버튼 클릭

3. [ ] 검증 요구사항 확인
   - **TravelPlanner 사용 범위**: `email`, `profile` (민감하지 않음)
   - **예상 결과**: 즉시 승인 (민감한 범위 없음)
   - **검증 필요 시**: 1-6주 소요 (드물음)

4. [ ] 게시 상태 확인
   - 상태: "프로덕션" 표시 확인
   - 사용자 한도: "제한 없음" 확인

5. [ ] 테스트
   ```bash
   # 새로운 Google 계정으로 로그인 테스트 (테스트 사용자 목록에 없는 계정)
   # 프로덕션 URL: https://mytravel-planner.com
   # 또는 개발 환경에서 테스트
   ```

**예상 소요 시간**: 5분 (검증 불필요 시)

---

#### Option B: 테스트 사용자 추가 (임시 대안) ⚠️

**단점**:
- 최대 100명 제한
- 각 사용자를 수동 등록해야 함
- 프로덕션 출시 불가 (비공개 베타 테스트 전용)

**작업 절차** (프로덕션 게시 실패 시만 사용):
1. [ ] Google Cloud Console → OAuth 동의 화면 → 대상
2. [ ] "테스트 사용자" 섹션 → **"+ Add users"** 클릭
3. [ ] 테스트 사용자 이메일 추가
   ```
   longpapa82@gmail.com
   [추가 테스터 이메일]
   ```
4. [ ] 저장 후 테스트

**권장**: Option A (프로덕션 게시) 우선 시도

---

### 2. Google OAuth Redirect URI 확인 ✅

#### 확인 위치
```
https://console.cloud.google.com/apis/credentials?project=tripplanner-486511
```

#### 확인할 OAuth 2.0 클라이언트

**TravelPlanner (웹 애플리케이션)**
- Client ID: `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- 승인된 리디렉션 URI에 다음 등록 확인:
  - [ ] `https://mytravel-planner.com/api/auth/google/callback`
  - [ ] `http://localhost:3001/api/auth/google/callback` (개발용)

**TravelPlanner Android**
- Client ID: `48805541090-4gqgm...` (CLAUDE.md 기록)
- 패키지 이름: `com.longpapa82.travelplanner`
- SHA-1 인증서 지문:
  - [ ] Upload Key: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
  - [ ] Play Signing Key: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`

**TravelPlanner Android (Play Signing)** - CLAUDE.md에 등록 완료 ✅
- Client ID: `48805541090-826gn...`

---

### 3. Kakao OAuth 설정 확인 ✅

#### Kakao Developers Console 접속
```
https://developers.kakao.com/console/app
```

#### 확인 사항

**3-1. 앱 설정 → 플랫폼**
- [ ] **Web 플랫폼**
  - 사이트 도메인: `https://mytravel-planner.com` 등록 확인

- [ ] **Android 플랫폼**
  - 패키지명: `com.longpapa82.travelplanner` 등록 확인
  - 마켓 URL: `market://details?id=com.longpapa82.travelplanner` (선택)
  - 키 해시: Play Console 업로드 키/서명 키에서 계산된 값 등록 확인
    ```bash
    # 키 해시 계산 방법 (참고):
    # keytool -exportcert -alias upload -keystore upload-keystore.jks | openssl sha1 -binary | openssl base64
    ```

**3-2. 제품 설정 → 카카오 로그인**
- [ ] **활성화 상태**: ON
- [ ] **Redirect URI** 등록 확인:
  - `https://mytravel-planner.com/api/auth/kakao/callback`
  - `http://localhost:3001/api/auth/kakao/callback` (개발용)

**3-3. 제품 설정 → 카카오 로그인 → 동의 항목**
- [ ] **이메일** (필수 동의) ✅
- [ ] **닉네임** (선택 동의 권장) - 프로필 표시용
- [ ] **프로필 사진** (선택 동의 권장) - 아바타 표시용

**3-4. 보안 → REST API 키 확인**
- [ ] REST API 키가 `.env.production`의 `KAKAO_CLIENT_ID`와 일치하는지 확인
  ```bash
  # backend/.env.production
  KAKAO_CLIENT_ID=91c9b16550779b270207bfe44648c2dc
  ```

- [ ] Client Secret (보안 설정)이 `.env.production`의 `KAKAO_CLIENT_SECRET`과 일치하는지 확인
  ```bash
  # backend/.env.production
  KAKAO_CLIENT_SECRET=BaEEc0nvozmuK8P20AnQX51KrLxl4zGg
  ```

---

### 4. 프로덕션 환경 변수 최종 검증 ✅

#### Backend 환경 변수 확인
```bash
# backend/.env.production 파일 위치
/Users/hoonjaepark/projects/travelPlanner/backend/.env.production
```

**필수 항목**:
- [ ] `GOOGLE_CLIENT_ID`: 48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com
- [ ] `GOOGLE_CLIENT_SECRET`: GOCSPX-quxo... (설정됨 ✅)
- [ ] `GOOGLE_CALLBACK_URL`: https://mytravel-planner.com/api/auth/google/callback
- [ ] `KAKAO_CLIENT_ID`: 91c9b16550779b270207bfe44648c2dc
- [ ] `KAKAO_CLIENT_SECRET`: BaEEc0... (설정됨 ✅)
- [ ] `KAKAO_CALLBACK_URL`: https://mytravel-planner.com/api/auth/kakao/callback
- [ ] `FRONTEND_URL`: https://mytravel-planner.com

**Apple (iOS 출시 전까지 불필요)**:
- ⏸️ `APPLE_CLIENT_ID`: (Phase 2에서 설정)
- ⏸️ `APPLE_TEAM_ID`: (Phase 2에서 설정)
- ⏸️ `APPLE_KEY_ID`: (Phase 2에서 설정)
- ⏸️ `APPLE_PRIVATE_KEY_PATH`: (Phase 2에서 설정)
- ⏸️ `APPLE_CALLBACK_URL`: (Phase 2에서 설정)

---

### 5. Android E2E 테스트 (출시 전 최종 검증) 🧪

#### 테스트 환경
- **기기**: Android 실제 기기 (Google Play Store 서명 키 사용)
- **빌드**: EAS Production Build (versionCode 19 or 20)
- **백엔드**: 프로덕션 환경 (https://mytravel-planner.com)

#### 테스트 시나리오

**5-1. Google Sign-In (Native SDK)**
1. [ ] 앱 실행 → 로그인 화면
2. [ ] "Google로 로그인" 버튼 클릭
3. [ ] Native Google Account Picker 표시 확인
4. [ ] 계정 선택 → 권한 동의 화면 (최초 1회)
5. [ ] 로그인 성공 → 홈 화면 리디렉션
6. [ ] 프로필 화면에서 이메일/이름 표시 확인

**예상 에러 (발생 시 조치)**:
- `API_NOT_CONNECTED`: Google Play Services 업데이트 필요
- `SIGN_IN_CANCELLED`: 사용자가 취소 (정상)
- `SIGN_IN_FAILED`: Client ID 불일치 → Google Cloud Console 확인
- `12501`: SHA-1 인증서 미등록 → Google Cloud Console에 Play Signing Key 추가

**5-2. Kakao Sign-In (OAuth Redirect)**
1. [ ] 앱 실행 → 로그인 화면
2. [ ] "Kakao로 로그인" 버튼 클릭
3. [ ] Kakao 인증 화면 (WebBrowser) 표시
4. [ ] Kakao 계정 로그인 → 동의 화면
5. [ ] 앱으로 리디렉션 (`travelplanner://auth/callback?code=...`)
6. [ ] 로그인 성공 → 홈 화면
7. [ ] 프로필 화면에서 Kakao 닉네임/이미지 표시 확인

**예상 에러 (발생 시 조치)**:
- `redirect_uri_mismatch`: Redirect URI 미등록 → Kakao Developers Console 확인
- `invalid_client`: Client ID/Secret 불일치 → .env.production 확인
- `KOE006`: 패키지명 불일치 → Kakao 앱 설정에서 Android 패키지명 확인

**5-3. 로그아웃 및 재로그인**
1. [ ] 프로필 → 로그아웃
2. [ ] 로그인 화면으로 리디렉션 확인
3. [ ] 다른 SNS로 재로그인 (계정 전환 테스트)
4. [ ] JWT 토큰 갱신 정상 작동 확인

---

### 6. 로그 모니터링 및 에러 추적 📊

#### 백엔드 로그 확인
```bash
# 프로덕션 서버 SSH 접속 후
docker logs -f travelplanner-backend --tail 100 | grep -i oauth

# 또는 로컬에서 원격 로그 확인
ssh your-server "docker logs -f travelplanner-backend --tail 100 | grep -i oauth"
```

**확인할 로그**:
- [ ] `[GoogleStrategy] User authenticated: { providerId, email }` ✅
- [ ] `[KakaoStrategy] User authenticated: { providerId, email }` ✅
- [ ] `[AuthService] OAuth temp code created: { code, expiresAt }` ✅
- [ ] `[AuthService] Code exchanged for JWT: { userId }` ✅
- [ ] **에러 로그 없음** ✅

**에러 발생 시 확인**:
- `invalid_grant`: Authorization code 만료 (60초 제한)
- `unauthorized_client`: Client ID 불일치
- `access_denied`: 사용자가 권한 거부

#### Frontend 로그 확인
```bash
# React Native Debugger 또는 Expo Dev Tools에서 확인
# 또는 Sentry 대시보드 (설정 시)
```

**확인할 로그**:
- [ ] `[AuthContext] loginWithGoogle: start`
- [ ] `[nativeGoogleSignIn] ID Token received`
- [ ] `[apiService] exchangeGoogleIdToken: success`
- [ ] `[AuthContext] User logged in: { userId, email }`

---

## 🔜 Phase 2: iOS 출시 준비 (Android 출시 이후)

### Apple Sign-In 설정 (iOS 앱 준비 시 진행)

**현재 상태**: ⏸️ 미설정 (iOS 출시 전까지 불필요)

**진행 시점**: Android 앱이 Play Store에서 안정화된 이후 (예상: 2-4주 후)

#### 작업 계획 (향후)

**Step 1: Apple Developer Console 설정**
1. [ ] https://developer.apple.com/account 로그인
2. [ ] Certificates, Identifiers & Profiles → Identifiers
3. [ ] App ID: `com.travelplanner.app` 선택
4. [ ] "Sign In with Apple" 활성화 확인
5. [ ] Services ID 생성:
   - Identifier: `com.travelplanner.app.service`
   - Display Name: `TravelPlanner Sign In`
   - Web Authentication Configuration:
     - Primary App ID: `com.travelplanner.app`
     - Domains: `mytravel-planner.com`
     - Return URLs:
       - `https://mytravel-planner.com/api/auth/apple/callback`
       - `https://mytravel-planner.com/auth/callback`
6. [ ] Keys 생성:
   - Key Name: `TravelPlanner Sign In Key`
   - Enable: Sign In with Apple
   - Download `.p8` 파일 (⚠️ 1회만 다운로드 가능)
   - Key ID 기록 (예: `ABC123XYZ`)
7. [ ] Team ID 확인:
   - Account → Membership → Team ID (예: `DEF456UVW`)

**Step 2: 백엔드 설정**
```bash
# 1. secrets 디렉토리 생성
mkdir -p /Users/hoonjaepark/projects/travelPlanner/backend/secrets

# 2. Apple Private Key 저장
cp ~/Downloads/AuthKey_ABC123XYZ.p8 backend/secrets/apple-private-key.p8
chmod 600 backend/secrets/apple-private-key.p8

# 3. .env.production에 추가
APPLE_CLIENT_ID=com.travelplanner.app.service
APPLE_TEAM_ID=DEF456UVW
APPLE_KEY_ID=ABC123XYZ
APPLE_PRIVATE_KEY_PATH=./secrets/apple-private-key.p8
APPLE_CALLBACK_URL=https://mytravel-planner.com/api/auth/apple/callback

# 4. .gitignore 확인
echo "secrets/" >> backend/.gitignore  # 이미 있으면 skip
```

**Step 3: iOS E2E 테스트**
1. [ ] iOS 실제 기기에서 앱 실행
2. [ ] "Apple로 로그인" 버튼 클릭
3. [ ] Apple 인증 화면 → Face ID/Touch ID 인증
4. [ ] 이메일 공유 옵션 선택 (이메일 숨기기 or 공유)
5. [ ] 로그인 성공 → 홈 화면
6. [ ] 프로필에서 Apple ID 표시 확인

---

## 📝 최종 체크리스트 (Android 출시 전)

### Pre-Flight Checklist ✈️

**Google OAuth** (P0 - Critical)
- [ ] OAuth 동의 화면 프로덕션 게시 완료 (또는 테스트 사용자 추가)
- [ ] Redirect URI 등록 확인: `https://mytravel-planner.com/api/auth/google/callback`
- [ ] Android OAuth 클라이언트 2개 등록 확인 (Upload Key + Play Signing Key)
- [ ] 실제 기기에서 Google Sign-In 성공

**Kakao OAuth** (P0 - Critical)
- [ ] Redirect URI 등록 확인: `https://mytravel-planner.com/api/auth/kakao/callback`
- [ ] Android 플랫폼 패키지명 등록 확인: `com.longpapa82.travelplanner`
- [ ] 동의 항목 설정 확인 (이메일 필수)
- [ ] 실제 기기에서 Kakao Sign-In 성공

**환경 변수** (P1 - Important)
- [ ] `.env.production`에 프로덕션 Callback URL 설정
- [ ] Client Secret이 Git에 커밋되지 않았는지 확인
- [ ] 프로덕션 배포 시 `.env.production` 적용 확인

**테스트** (P0 - Critical)
- [ ] Android 실제 기기에서 Google/Kakao 2개 SNS 로그인 모두 성공
- [ ] 로그아웃 후 재로그인 성공
- [ ] 계정 전환 (Google ↔ Kakao) 정상 작동
- [ ] 백엔드 OAuth 에러 로그 0건

**Apple Sign-In** (P3 - Low Priority)
- [ ] ⏸️ iOS 출시 전까지 보류
- [ ] ⏸️ Android 안정화 이후 Phase 2로 진행

---

## 🚨 트러블슈팅

### Google Sign-In 실패 시

**증상**: "API_NOT_CONNECTED" 또는 "SIGN_IN_FAILED"

**원인 및 해결**:
1. **SHA-1 인증서 미등록**
   ```bash
   # Play Signing Key SHA-1 확인
   # Google Cloud Console → OAuth 2.0 클라이언트 → TravelPlanner Android (Play Signing)
   # SHA-1: 13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25
   ```

2. **webClientId 불일치**
   ```typescript
   // frontend/src/services/googleNativeSignIn.ts:13-14
   const WEB_CLIENT_ID = '48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com';
   // Google Cloud Console의 "TravelPlanner" 웹 클라이언트 ID와 일치해야 함
   ```

3. **Google Play Services 없음/구버전**
   ```
   해결: 기기에서 Google Play Services 업데이트
   ```

---

### Kakao Sign-In 실패 시

**증상**: "KOE006" 또는 "redirect_uri_mismatch"

**원인 및 해결**:
1. **패키지명 불일치**
   ```bash
   # Kakao Developers Console → 앱 설정 → 플랫폼 → Android
   # 패키지명: com.longpapa82.travelplanner
   # app.config.js의 android.package와 일치해야 함
   ```

2. **Redirect URI 미등록**
   ```bash
   # Kakao Developers Console → 카카오 로그인 → Redirect URI
   # https://mytravel-planner.com/api/auth/kakao/callback 등록 확인
   ```

3. **Client Secret 불일치**
   ```bash
   # backend/.env.production
   # KAKAO_CLIENT_SECRET=BaEEc0nvozmuK8P20AnQX51KrLxl4zGg
   # Kakao Developers Console → 보안 → Client Secret과 일치해야 함
   ```

---

### OAuth Redirect 실패 시

**증상**: "Invalid redirect URI" 또는 무한 로딩

**원인 및 해결**:
1. **Deep Link 미등록**
   ```javascript
   // app.config.js:10
   scheme: 'travelplanner',

   // android.intentFilters:49
   { scheme: 'travelplanner' }
   ```

2. **App Links 미검증**
   ```bash
   # Android App Links 검증
   # https://mytravel-planner.com/.well-known/assetlinks.json 접근 가능해야 함
   # CLAUDE.md에 따르면 이미 등록 완료 ✅
   ```

3. **Callback URL 환경 변수 오타**
   ```bash
   # backend/.env.production 확인
   GOOGLE_CALLBACK_URL=https://mytravel-planner.com/api/auth/google/callback
   KAKAO_CALLBACK_URL=https://mytravel-planner.com/api/auth/kakao/callback
   # 슬래시(/), 프로토콜(https), 도메인 확인
   ```

---

## 📅 타임라인 (예상)

### Week 1: Android 출시 준비 (현재)
- **Day 1 (오늘)**:
  - [ ] Google OAuth 프로덕션 게시 (5분)
  - [ ] Kakao Redirect URI 확인 (10분)
  - [ ] `.env.production` 최종 검증 (5분)

- **Day 2**:
  - [ ] Android E2E 테스트 (30분)
  - [ ] 로그 모니터링 (10분)
  - [ ] 이슈 수정 (필요 시)

- **Day 3**:
  - [ ] 최종 빌드 및 Play Store 제출 준비

### Week 2-4: Android 안정화
- 사용자 피드백 수집
- 버그 수정 및 핫픽스
- 성능 모니터링

### Week 5+: iOS 출시 준비 (Phase 2)
- Apple Sign-In 설정
- iOS 앱 빌드 및 테스트
- App Store 제출

---

## 🎯 성공 기준

### Android 출시 Go/No-Go
- ✅ Google Sign-In 성공률 > 95%
- ✅ Kakao Sign-In 성공률 > 95%
- ✅ OAuth 에러 로그 < 1% (사용자 취소 제외)
- ✅ E2E 테스트 모두 통과
- ✅ 프로덕션 환경에서 2개 SNS 정상 작동

### iOS 출시 Go/No-Go (향후)
- ✅ Apple Sign-In 성공률 > 95%
- ✅ Google Sign-In (iOS) 정상 작동
- ✅ Kakao Sign-In (iOS) 정상 작동
- ✅ App Store 심사 통과

---

## 📚 참고 문서

- [Google OAuth 2.0 설정 가이드](https://developers.google.com/identity/protocols/oauth2)
- [Kakao 로그인 개발 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [Apple Sign In 설정 가이드](https://developer.apple.com/sign-in-with-apple/get-started/)
- [TravelPlanner CLAUDE.md](../CLAUDE.md) - Google Cloud/Play Console 설정 정보

---

**마지막 업데이트**: 2026-03-20
**다음 리뷰**: Android 출시 후
