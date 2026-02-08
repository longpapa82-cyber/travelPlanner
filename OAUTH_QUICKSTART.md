# OAuth 빠른 시작 가이드

이 문서는 TravelPlanner 앱에서 **SNS 간편 로그인**을 활성화하는 최소 단계를 안내합니다.

---

## ⏱️ 예상 소요 시간

- **Google**: 10-15분
- **Apple**: 20-30분 (Apple Developer 계정 필요)
- **Kakao**: 10-15분

---

## 📋 빠른 체크리스트

### 준비 사항
- [ ] Google 계정
- [ ] Apple Developer 계정 ($99/year, Apple 로그인용)
- [ ] Kakao 계정

### 등록 단계
- [ ] **Google OAuth Client 등록** → Client ID/Secret 발급
- [ ] **Apple Services ID 등록** → Key 생성 및 다운로드
- [ ] **Kakao 애플리케이션 등록** → REST API Key 발급
- [ ] **Backend `.env` 파일 업데이트**
- [ ] **Backend 재시작**
- [ ] **테스트 실행**

---

## 🚀 1단계: Provider별 등록 (선택)

원하는 Provider만 등록하세요. 모두 등록할 필요는 없습니다.

### Option A: Google만 등록 (가장 빠름)
1. [Google Cloud Console](https://console.cloud.google.com/)
2. OAuth 클라이언트 ID 생성
3. Client ID/Secret 복사

### Option B: Google + Kakao 등록
1. Google 등록 (위와 동일)
2. [Kakao Developers](https://developers.kakao.com/)
3. 앱 생성 → REST API Key 복사

### Option C: 3개 모두 등록
1. Google 등록
2. Kakao 등록
3. [Apple Developer](https://developer.apple.com/)
4. Services ID + Key 생성

**상세 가이드**: [`/claudedocs/oauth-client-registration-guide.md`](./claudedocs/oauth-client-registration-guide.md)

---

## ⚙️ 2단계: Backend 설정

### A. .env 파일 업데이트

**파일**: `backend/.env`

**Google만 사용하는 경우**:
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

**모두 사용하는 경우**:
```env
# Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Apple (iOS만)
APPLE_CLIENT_ID=com.yourcompany.travelplanner.signin
APPLE_TEAM_ID=ABC123XYZ
APPLE_KEY_ID=DEF456UVW
APPLE_PRIVATE_KEY_PATH=./secrets/AuthKey_DEF456UVW.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback

# Kakao
KAKAO_CLIENT_ID=your-rest-api-key
KAKAO_CLIENT_SECRET=your-client-secret
KAKAO_CALLBACK_URL=http://localhost:3000/api/auth/kakao/callback

# Frontend
FRONTEND_URL=exp://localhost:8081
```

**템플릿 파일**: `backend/.env.oauth.template` 참조

### B. Apple Private Key 저장 (Apple 사용 시)

```bash
cd backend
mkdir -p secrets
mv ~/Downloads/AuthKey_*.p8 ./secrets/
```

### C. Backend 재시작

```bash
cd backend
npm run start:dev
```

✅ 콘솔에서 에러 없이 시작되면 성공!

---

## 📱 3단계: Frontend 실행

```bash
cd frontend
npm start
```

---

## ✅ 4단계: 테스트

### 테스트 시나리오

1. **앱 실행** → LoginScreen 표시
2. **SNS 버튼 클릭** (예: "Continue with Google")
3. **브라우저 열림** → Provider 로그인 페이지
4. **계정 선택** → 승인
5. **앱으로 자동 리디렉트**
6. **메인 화면 표시** → ✅ 로그인 완료!

### 확인 사항

- [ ] Backend 콘솔에 `POST /auth/google/callback` 로그 표시
- [ ] Frontend에서 메인 앱 화면으로 전환
- [ ] Backend 콘솔에 사용자 생성 로그 표시

---

## 🐛 문제 해결

### 문제: "redirect_uri_mismatch" 오류
**원인**: Redirect URI 불일치

**해결**:
```bash
# Provider 콘솔에서 등록된 URI 확인
# .env의 *_CALLBACK_URL과 완전히 일치해야 함
# 예: http://localhost:3000/api/auth/google/callback
```

### 문제: "invalid_client" 오류
**원인**: Client ID/Secret 오류

**해결**:
```bash
# .env 파일 재확인
# 복사 시 공백이 포함되지 않았는지 확인
# Provider 콘솔에서 값 재확인
```

### 문제: 앱으로 리디렉트 안 됨
**원인**: Deep Link 설정 문제

**해결**:
```bash
# .env에 FRONTEND_URL 확인
FRONTEND_URL=exp://localhost:8081

# Expo Dev Server가 실행 중인지 확인
cd frontend && npm start
```

---

## 📚 추가 자료

### 상세 가이드
- **Provider 등록**: [`/claudedocs/oauth-client-registration-guide.md`](./claudedocs/oauth-client-registration-guide.md)
- **OAuth 통합 요약**: [`/claudedocs/oauth-integration-summary.md`](./claudedocs/oauth-integration-summary.md)

### Provider 공식 문서
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign-In](https://developer.apple.com/sign-in-with-apple/)
- [Kakao Login](https://developers.kakao.com/docs/latest/ko/kakaologin/common)

---

## 💡 Pro Tips

### 개발 팁
1. **Google만 먼저 테스트**: 가장 설정이 간단
2. **테스트 계정 사용**: 실제 계정 말고 테스트용 계정 사용
3. **로그 확인**: Backend 콘솔에서 OAuth 플로우 추적

### 프로덕션 준비
1. **환경 분리**: 개발/프로덕션 `.env` 파일 분리
2. **도메인 변경**: `localhost` → 실제 도메인
3. **HTTPS 사용**: 프로덕션에서는 필수

---

## 🎯 다음 단계

OAuth 로그인이 작동하면:

1. **사용자 프로필 완성 화면** 추가 (선택)
2. **로딩 애니메이션** 개선
3. **에러 처리** 강화
4. **여행 관리 기능** 개발 계속

---

**질문이 있으신가요?**
- Backend 에러: `backend/` 디렉토리에서 `npm run start:dev` 로그 확인
- Frontend 에러: Metro 번들러 콘솔 확인
- OAuth 플로우: Provider 콘솔에서 로그 확인

---

**작성자**: Claude Code
**버전**: 1.0.0
