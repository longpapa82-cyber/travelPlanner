# Kakao OAuth 설정 확인 가이드

> **작업 일시**: 2026-03-20
> **예상 소요 시간**: 10분
> **목적**: Kakao 로그인 프로덕션 Redirect URI 확인

---

## 📋 확인 항목 체크리스트

### 필수 확인 사항
- [ ] Redirect URI: `https://mytravel-planner.com/api/auth/kakao/callback` 등록
- [ ] Android 플랫폼: 패키지명 `com.longpapa82.travelplanner` 등록
- [ ] 카카오 로그인: 활성화 상태 ON
- [ ] 동의 항목: 이메일 필수 동의 설정

---

## 🚀 Kakao Developers Console 접속

### Step 1: Kakao Developers 로그인

1. 다음 URL을 브라우저에서 열기:
   ```
   https://developers.kakao.com/console/app
   ```

2. Kakao 계정 로그인

3. **TravelPlanner 앱** 선택 (또는 해당 앱 이름)
   - REST API 키: `91c9b16550779b270207bfe44648c2dc` 확인

---

## 📱 플랫폼 설정 확인

### Step 2: 앱 설정 → 플랫폼

좌측 메뉴에서 **앱 설정 → 플랫폼** 클릭

#### 확인 1: Web 플랫폼

```
Web 플랫폼
상태: [등록됨]
사이트 도메인: https://mytravel-planner.com
```

**확인 사항**:
- [ ] Web 플랫폼 등록됨
- [ ] 사이트 도메인: `https://mytravel-planner.com`
- [ ] 프로토콜 `https://` 포함 확인

**만약 미등록 시**:
1. [플랫폼 추가] 버튼 클릭
2. "Web" 선택
3. 사이트 도메인: `https://mytravel-planner.com` 입력
4. 저장

---

#### 확인 2: Android 플랫폼

```
Android 플랫폼
상태: [등록됨]
패키지명: com.longpapa82.travelplanner
마켓 URL: market://details?id=com.longpapa82.travelplanner
키 해시: [등록된 해시 값]
```

**확인 사항**:
- [ ] Android 플랫폼 등록됨
- [ ] 패키지명: `com.longpapa82.travelplanner` (정확히 일치)
- [ ] 키 해시 등록됨 (Play Console 업로드 키 또는 서명 키)

**만약 미등록 시**:
1. [플랫폼 추가] 버튼 클릭
2. "Android" 선택
3. 패키지명: `com.longpapa82.travelplanner` 입력
4. 마켓 URL: `market://details?id=com.longpapa82.travelplanner` 입력 (선택)
5. 키 해시 입력 (아래 키 해시 계산 방법 참조)
6. 저장

---

#### 키 해시 계산 방법 (필요 시)

Kakao Android 로그인은 키 해시가 필요합니다.

**방법 1: Play Console에서 SHA-1 확인 후 변환**

Google Play Console에서 SHA-1을 Base64로 변환:
```bash
# SHA-1: 68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40 (Upload Key)
# SHA-1: 13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25 (Play Signing Key)

# Base64 변환 (온라인 도구 사용 또는 아래 명령)
echo "68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40" | \
  tr -d ':' | xxd -r -p | openssl base64
```

**방법 2: EAS Build 로그에서 확인**

EAS Build 로그에서 키 해시가 출력될 수 있습니다.

**방법 3: 앱 실행 후 로그 확인**

Kakao SDK 초기화 시 로그에 키 해시 출력:
```
I/KakaoSDK: KeyHash: xxxxxxxxxxxxxxxxxxxxx=
```

**참고**: 키 해시는 SHA-1이 아닌 Base64 인코딩된 값입니다.

---

## 🔐 카카오 로그인 설정 확인

### Step 3: 제품 설정 → 카카오 로그인

좌측 메뉴에서 **제품 설정 → 카카오 로그인** 클릭

#### 확인 1: 카카오 로그인 활성화

```
카카오 로그인
상태: [ON] ✅
```

**확인 사항**:
- [ ] 카카오 로그인 상태: ON

**만약 OFF 시**:
1. [활성화 설정] 버튼 클릭
2. ON으로 전환

---

#### 확인 2: Redirect URI 등록 **🔴 CRITICAL**

```
Redirect URI
https://mytravel-planner.com/api/auth/kakao/callback ✅
http://localhost:3001/api/auth/kakao/callback ✅ (개발용)
```

**확인 사항**:
- [ ] `https://mytravel-planner.com/api/auth/kakao/callback` 등록됨
- [ ] 프로토콜 `https://` 정확히 일치
- [ ] 경로 `/api/auth/kakao/callback` 정확히 일치
- [ ] 개발용 localhost URI 등록됨 (선택)

**만약 미등록 시**:
1. [Redirect URI 등록] 버튼 클릭
2. URI 입력:
   ```
   https://mytravel-planner.com/api/auth/kakao/callback
   ```
3. [추가] 버튼 클릭
4. 저장

**주의사항**:
- 슬래시(`/`), 프로토콜(`https://`), 경로 정확히 입력
- 오타 시 OAuth 인증 실패 (`redirect_uri_mismatch` 에러)

---

#### 확인 3: 동의 항목 설정

```
카카오 로그인 → 동의 항목

┌────────────────────────────────────┐
│ 이메일                             │
│ [필수 동의] ✅                     │
│ 수집 목적: 사용자 식별              │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 닉네임                             │
│ [선택 동의] (권장)                 │
│ 수집 목적: 프로필 표시              │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ 프로필 사진                         │
│ [선택 동의] (권장)                 │
│ 수집 목적: 프로필 아바타 표시        │
└────────────────────────────────────┘
```

**확인 사항**:
- [ ] **이메일**: 필수 동의로 설정 ✅
- [ ] **닉네임**: 선택 동의 (권장)
- [ ] **프로필 사진**: 선택 동의 (권장)

**이메일 필수 동의 설정 방법**:
1. 동의 항목에서 "이메일" 클릭
2. "필수 동의" 선택
3. 수집 목적: "사용자 식별 및 로그인" 입력
4. 저장

---

## 🔑 보안 설정 확인

### Step 4: 보안 → Client Secret

좌측 메뉴에서 **보안** 클릭

```
Client Secret
상태: [사용함] ✅
코드: [●●●●●●●●●●●●●●●●] (마스킹됨)
```

**확인 사항**:
- [ ] Client Secret 사용 상태: ON
- [ ] `.env.production`의 `KAKAO_CLIENT_SECRET`과 일치 확인

**Client Secret 확인 방법**:
1. [코드 보기] 또는 [Show] 버튼 클릭
2. 표시된 Client Secret 복사
3. 로컬 환경 변수와 비교:
   ```bash
   # backend/.env.production
   KAKAO_CLIENT_SECRET=BaEEc0nvozmuK8P20AnQX51KrLxl4zGg

   # Kakao Console의 Client Secret과 일치해야 함
   ```

**불일치 시**:
- Kakao Console의 값을 `.env.production`에 업데이트
- 또는 Client Secret 재생성 후 `.env.production` 업데이트

---

## ✅ 최종 확인 체크리스트

### Kakao Developers Console 설정

**플랫폼 설정**:
- [ ] Web: `https://mytravel-planner.com` 등록
- [ ] Android: `com.longpapa82.travelplanner` 등록
- [ ] Android: 키 해시 등록 완료

**카카오 로그인**:
- [ ] 카카오 로그인: ON
- [ ] Redirect URI: `https://mytravel-planner.com/api/auth/kakao/callback` 등록
- [ ] 동의 항목: 이메일 필수 동의

**보안**:
- [ ] Client Secret 사용: ON
- [ ] `.env.production`과 일치 확인

---

## 🧪 테스트 방법

### 테스트 1: 개발 환경 (로컬)

```bash
# 백엔드 실행
cd backend
npm run start:dev

# 프론트엔드 실행
cd frontend
npm start

# 브라우저에서 http://localhost:8081 접속
# "Kakao로 로그인" 버튼 클릭
# Kakao 인증 화면 → 로그인 성공 확인
```

**성공 기준**:
- ✅ Kakao 로그인 화면 표시
- ✅ 동의 화면에서 "이메일" 필수 항목 확인
- ✅ 로그인 성공 → 홈 화면 리디렉션
- ✅ 프로필에서 Kakao 닉네임/이메일 표시

---

### 테스트 2: Android 실제 기기 (프로덕션 준비)

**준비 사항**:
- Android 실제 기기 (Play Store 서명 키 사용)
- EAS Production Build 설치

**테스트 절차**:
1. 앱 실행 → 로그인 화면
2. "Kakao로 로그인" 버튼 클릭
3. Kakao 앱 설치 시: Kakao 앱으로 전환 → 인증
4. Kakao 앱 미설치 시: WebView로 로그인
5. 동의 화면 확인 → "동의하고 계속하기"
6. 앱으로 리디렉션 (`travelplanner://auth/callback?code=...`)
7. 로그인 성공 → 홈 화면

**성공 기준**:
- ✅ Kakao 로그인 플로우 정상 작동
- ✅ 앱으로 리디렉션 성공
- ✅ JWT 토큰 발급 성공
- ✅ 프로필 정보 표시

---

## 🚨 트러블슈팅

### 문제 1: "KOE006" 에러

**증상**:
```
KOE006
잘못된 요청입니다. 앱 키와 패키지명을 확인해주세요.
```

**원인**: 패키지명 불일치

**해결**:
1. Kakao Developers Console → 앱 설정 → 플랫폼 → Android
2. 패키지명 확인: `com.longpapa82.travelplanner`
3. `frontend/app.config.js` 확인:
   ```javascript
   android: {
     package: 'com.longpapa82.travelplanner',
   }
   ```
4. 정확히 일치하는지 확인 (대소문자, 점 포함)

---

### 문제 2: "redirect_uri_mismatch" 에러

**증상**:
```
redirect_uri_mismatch
등록되지 않은 redirect_uri입니다.
```

**원인**: Redirect URI 미등록 또는 오타

**해결**:
1. Kakao Developers Console → 제품 설정 → 카카오 로그인 → Redirect URI
2. 등록된 URI 확인:
   ```
   https://mytravel-planner.com/api/auth/kakao/callback
   ```
3. `.env.production` 확인:
   ```bash
   KAKAO_CALLBACK_URL=https://mytravel-planner.com/api/auth/kakao/callback
   ```
4. 정확히 일치하는지 확인 (프로토콜, 슬래시, 경로)

---

### 문제 3: "invalid_client" 에러

**증상**:
```
invalid_client
잘못된 클라이언트 인증입니다.
```

**원인**: Client Secret 불일치

**해결**:
1. Kakao Developers Console → 보안 → Client Secret 확인
2. `.env.production` 업데이트:
   ```bash
   KAKAO_CLIENT_SECRET=<Kakao Console에서 복사한 값>
   ```
3. 백엔드 재시작

---

### 문제 4: 키 해시 에러 (Android)

**증상**:
```
AUTHORIZATION_FAILED
유효하지 않은 앱입니다. 패키지명과 키 해시를 확인해주세요.
```

**원인**: 키 해시 미등록 또는 불일치

**해결**:
1. 앱 실행 시 로그에서 키 해시 확인:
   ```
   I/KakaoSDK: KeyHash: xxxxxxxxxxxxxxxxxxxxx=
   ```
2. Kakao Developers Console → 앱 설정 → 플랫폼 → Android → 키 해시에 추가
3. Play Store 서명 키와 로컬 개발 키가 다를 수 있으므로 둘 다 등록 권장

---

## 📊 설정 완료 확인표

### Kakao Developers Console

| 항목 | 설정값 | 상태 |
|------|--------|------|
| **REST API 키** | `91c9b16550779b270207bfe44648c2dc` | ✅ |
| **Web 플랫폼** | `https://mytravel-planner.com` | □ |
| **Android 패키지명** | `com.longpapa82.travelplanner` | □ |
| **Android 키 해시** | (등록 필요) | □ |
| **카카오 로그인** | ON | □ |
| **Redirect URI** | `https://mytravel-planner.com/api/auth/kakao/callback` | □ |
| **이메일 동의** | 필수 동의 | □ |
| **Client Secret** | 사용함 + `.env.production` 일치 | □ |

### 환경 변수

| 파일 | 변수 | 값 | 상태 |
|------|------|-----|------|
| `backend/.env.production` | `KAKAO_CLIENT_ID` | `91c9b16550779b270207bfe44648c2dc` | ✅ |
| `backend/.env.production` | `KAKAO_CLIENT_SECRET` | `BaEEc0...` | ✅ |
| `backend/.env.production` | `KAKAO_CALLBACK_URL` | `https://mytravel-planner.com/api/auth/kakao/callback` | ✅ |

---

## ✅ 완료 후 다음 단계

Kakao OAuth 설정 완료 후:
1. [ ] Android E2E 테스트 (Google + Kakao 통합 테스트)
2. [ ] 로그 모니터링
3. [ ] Paddle 인증 확인 및 env 교체 대기
4. [ ] 최종 EAS Build 준비

---

**문서 업데이트**: 2026-03-20
**상태**: 확인 대기
