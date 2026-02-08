# OAuth Client 등록 가이드

**목적**: Google, Apple, Kakao OAuth 로그인을 실제로 사용하기 위한 Client 등록 방법

---

## 🔵 1. Google OAuth Client 등록

### 사전 준비
- Google 계정 필요
- Google Cloud Platform 접근 권한

### 등록 단계

#### Step 1: Google Cloud Console 접속
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택

#### Step 2: OAuth 동의 화면 구성
1. 좌측 메뉴: **API 및 서비스** > **OAuth 동의 화면**
2. **외부** 사용자 유형 선택 (개인/테스트용)
3. 앱 정보 입력:
   ```
   앱 이름: TravelPlanner
   사용자 지원 이메일: your-email@example.com
   개발자 연락처: your-email@example.com
   ```
4. **범위 추가**:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
5. **저장 후 계속**

#### Step 3: OAuth 클라이언트 ID 만들기
1. 좌측 메뉴: **API 및 서비스** > **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** > **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름: `TravelPlanner Web Client`
5. **승인된 리디렉션 URI** 추가:
   ```
   개발: http://localhost:3000/api/auth/google/callback
   프로덕션: https://yourdomain.com/api/auth/google/callback
   ```
6. **만들기** 클릭

#### Step 4: 클라이언트 정보 저장
팝업에서 다음 정보 복사:
```
클라이언트 ID: xxx.apps.googleusercontent.com
클라이언트 보안 비밀번호: GOCSPX-xxxxx
```

#### Step 5: .env 파일 업데이트
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

### 테스트
```bash
# Backend 재시작
cd backend && npm run start:dev

# Frontend 실행
cd frontend && npm start

# LoginScreen에서 "Continue with Google" 버튼 클릭
```

---

## 🍎 2. Apple Sign-In 등록

### 사전 준비
- Apple Developer Program 계정 ($99/year)
- Bundle ID 준비 (예: `com.yourcompany.travelplanner`)

### 등록 단계

#### Step 1: Services ID 생성
1. [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId) 접속
2. **+** 버튼 클릭 > **Services IDs** 선택
3. 정보 입력:
   ```
   Description: TravelPlanner Sign-In
   Identifier: com.yourcompany.travelplanner.signin
   ```
4. **Continue** > **Register**

#### Step 2: Sign In with Apple 구성
1. 방금 생성한 Services ID 클릭
2. **Sign In with Apple** 체크박스 활성화
3. **Configure** 버튼 클릭
4. **Primary App ID** 선택 (앱의 Bundle ID)
5. **Website URLs** 섹션:
   ```
   Domains and Subdomains: localhost (개발용)
   Return URLs: http://localhost:3000/api/auth/apple/callback
   ```
6. **Next** > **Done** > **Continue** > **Save**

#### Step 3: Key 생성
1. [Keys 섹션](https://developer.apple.com/account/resources/authkeys/list) 이동
2. **+** 버튼 클릭
3. 정보 입력:
   ```
   Key Name: TravelPlanner Sign-In Key
   Sign In with Apple: 체크
   ```
4. **Configure** 클릭 > Primary App ID 선택
5. **Save** > **Continue** > **Register**
6. **Download** 버튼으로 `.p8` 파일 다운로드
7. **Key ID** 복사 (나중에 다시 볼 수 없음!)

#### Step 4: Team ID 확인
1. [Membership 페이지](https://developer.apple.com/account/#/membership/) 이동
2. **Team ID** 복사

#### Step 5: .env 파일 업데이트
```env
APPLE_CLIENT_ID=com.yourcompany.travelplanner.signin
APPLE_TEAM_ID=ABC123XYZ
APPLE_KEY_ID=DEF456UVW
APPLE_PRIVATE_KEY_PATH=./secrets/AuthKey_DEF456UVW.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback
```

#### Step 6: Private Key 파일 저장
```bash
# Backend 프로젝트에 secrets 디렉토리 생성
cd backend
mkdir -p secrets

# 다운로드한 .p8 파일을 secrets/ 디렉토리로 이동
mv ~/Downloads/AuthKey_*.p8 ./secrets/

# .gitignore에 secrets/ 추가 (이미 있음)
```

### 중요 사항
- **iOS 전용**: Apple Sign-In은 iOS 기기에서만 작동
- **프로덕션 설정**: 실제 도메인으로 변경 필요
- **Private Key 보안**: `.p8` 파일은 절대 커밋하지 말 것

---

## 💬 3. Kakao OAuth 등록

### 사전 준비
- Kakao 계정 필요

### 등록 단계

#### Step 1: 애플리케이션 생성
1. [Kakao Developers](https://developers.kakao.com/) 접속 및 로그인
2. **내 애플리케이션** > **애플리케이션 추가하기**
3. 정보 입력:
   ```
   앱 이름: TravelPlanner
   사업자명: 개인 (또는 회사명)
   ```
4. **저장** 클릭

#### Step 2: 앱 키 확인
1. 생성된 앱 클릭 > **앱 설정** > **앱 키**
2. **REST API 키** 복사

#### Step 3: 플랫폼 설정
1. **앱 설정** > **플랫폼**
2. **Web 플랫폼 등록** 클릭
3. 사이트 도메인:
   ```
   http://localhost:3000
   ```
4. **저장**

#### Step 4: Kakao Login 활성화
1. **제품 설정** > **카카오 로그인**
2. **활성화 설정** ON
3. **Redirect URI** 등록:
   ```
   http://localhost:3000/api/auth/kakao/callback
   ```
4. **저장**

#### Step 5: 동의 항목 설정
1. **제품 설정** > **카카오 로그인** > **동의항목**
2. 필수 동의 항목:
   - 프로필 정보 (닉네임/프로필 사진) - **필수 동의**
   - 카카오계정 (이메일) - **선택 동의**
3. **저장**

#### Step 6: Client Secret 발급 (선택사항)
1. **제품 설정** > **카카오 로그인** > **보안**
2. **Client Secret** > **코드 생성** 클릭
3. **활성화 상태** ON
4. 생성된 코드 복사

#### Step 7: .env 파일 업데이트
```env
KAKAO_CLIENT_ID=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret  # 선택사항
KAKAO_CALLBACK_URL=http://localhost:3000/api/auth/kakao/callback
```

### 테스트 계정 설정 (개발 중)
1. **앱 설정** > **카카오 로그인** > **테스트 앱**
2. 테스트할 Kakao 계정 추가
3. 승인 대기 없이 즉시 테스트 가능

---

## 🔧 4. Backend .env 파일 최종 업데이트

### 파일 위치
```
backend/.env
```

### 전체 OAuth 설정
```env
# OAuth - Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# OAuth - Apple
APPLE_CLIENT_ID=com.yourcompany.travelplanner.signin
APPLE_TEAM_ID=ABC123XYZ
APPLE_KEY_ID=DEF456UVW
APPLE_PRIVATE_KEY_PATH=./secrets/AuthKey_DEF456UVW.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback

# OAuth - Kakao
KAKAO_CLIENT_ID=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret
KAKAO_CALLBACK_URL=http://localhost:3000/api/auth/kakao/callback

# Frontend URL (Deep Link)
FRONTEND_URL=exp://localhost:8081
```

### Backend 재시작
```bash
cd backend
npm run start:dev
```

---

## ✅ 5. 통합 테스트

### 테스트 체크리스트

#### Google Login
- [ ] Backend 서버 실행 중
- [ ] Frontend 앱 실행 중
- [ ] LoginScreen "Continue with Google" 버튼 클릭
- [ ] 브라우저에서 Google 로그인 페이지 표시
- [ ] Google 계정 선택 및 승인
- [ ] 앱으로 자동 리디렉트
- [ ] 메인 화면 표시 (로그인 완료)
- [ ] Backend 로그에서 사용자 생성 확인

#### Apple Login (iOS만)
- [ ] iOS 시뮬레이터 또는 실제 기기에서 테스트
- [ ] "Continue with Apple" 버튼 클릭
- [ ] Apple Sign-In 모달 표시
- [ ] Face ID/Touch ID 또는 Apple ID 비밀번호 입력
- [ ] 앱으로 자동 리디렉트
- [ ] 메인 화면 표시

#### Kakao Login
- [ ] "Continue with Kakao" 버튼 클릭
- [ ] 브라우저에서 Kakao 로그인 페이지 표시
- [ ] Kakao 계정 로그인
- [ ] 동의 항목 확인
- [ ] 앱으로 자동 리디렉트
- [ ] 메인 화면 표시

---

## 🚨 일반적인 문제 해결

### 문제 1: "redirect_uri_mismatch" 오류
**원인**: Redirect URI가 Provider 설정과 일치하지 않음

**해결**:
1. Provider 콘솔에서 등록된 Redirect URI 확인
2. `.env` 파일의 `*_CALLBACK_URL` 확인
3. 완전히 일치하는지 확인 (http vs https, trailing slash 등)

### 문제 2: "invalid_client" 오류
**원인**: Client ID 또는 Secret이 잘못됨

**해결**:
1. `.env` 파일의 Client ID/Secret 재확인
2. 복사할 때 공백이 포함되지 않았는지 확인
3. Provider 콘솔에서 재발급

### 문제 3: 앱으로 리디렉트 안 됨
**원인**: Deep Link 설정 문제

**해결**:
1. `FRONTEND_URL` 환경 변수 확인
2. Expo 앱이 실행 중인지 확인
3. 개발 모드: `exp://localhost:8081` 사용
4. 프로덕션: app scheme 설정 필요

### 문제 4: Apple Sign-In이 Android에서 오류
**원인**: Apple Sign-In은 iOS 전용

**해결**:
- Android에서는 Apple 버튼 숨김 처리
- 또는 버튼 비활성화 + 안내 메시지 표시

---

## 📱 6. 프로덕션 배포 준비

### Frontend Deep Link 설정

**파일**: `frontend/app.json`
```json
{
  "expo": {
    "scheme": "travelplanner",
    "ios": {
      "bundleIdentifier": "com.yourcompany.travelplanner",
      "associatedDomains": [
        "applinks:yourdomain.com"
      ]
    },
    "android": {
      "package": "com.yourcompany.travelplanner",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "yourdomain.com",
              "pathPrefix": "/auth/callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### Backend Callback URL 업데이트
```env
# 프로덕션
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
APPLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/apple/callback
KAKAO_CALLBACK_URL=https://api.yourdomain.com/api/auth/kakao/callback

FRONTEND_URL=travelplanner://
```

### Provider 콘솔 업데이트
각 Provider에서:
1. 프로덕션 Redirect URI 추가
2. 프로덕션 도메인 등록
3. 앱 스토어 URL 등록 (검수 후)

---

## 💡 팁

### 개발 효율성
- **테스트 계정 사용**: 각 Provider에서 테스트 계정 등록
- **로그 확인**: Backend 콘솔에서 OAuth 플로우 로그 확인
- **Postman 테스트**: Backend 엔드포인트 직접 테스트

### 보안
- **Client Secret 보호**: 환경 변수로만 관리, 커밋하지 말 것
- **Apple Private Key**: `secrets/` 디렉토리에 보관, `.gitignore` 확인
- **프로덕션 분리**: 개발/프로덕션 환경 분리

### 사용자 경험
- **에러 메시지 개선**: 사용자 친화적 메시지로 변경
- **로딩 인디케이터**: OAuth 플로우 중 로딩 표시
- **재시도 옵션**: 실패 시 다시 시도할 수 있도록

---

**작성자**: Claude Code
**날짜**: 2026-02-05
**버전**: 1.0.0
