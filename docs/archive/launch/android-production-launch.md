# Android 프로덕션 출시 가이드

> **작업 일시**: 2026-03-20
> **목적**: TravelPlanner Android 앱 프로덕션 출시

---

## ✅ 사전 준비 완료 상태

### SNS 로그인
- ✅ Google OAuth: 프로덕션 게시 완료
- ✅ Kakao OAuth: 이메일 필수 동의 설정 완료
- ✅ Redirect URI: 모두 등록 완료

### 결제 시스템
- ✅ RevenueCat: Google Play IAP 설정 완료
- ✅ 테스트 구매: 성공
- ⏸️ Paddle: 인증 진행 중 (Android 출시에 불필요)

### QA
- ✅ Frontend TypeScript: 0 errors
- ✅ Backend TypeScript: 0 errors
- ✅ Frontend Jest: 200/200 PASS
- ✅ Backend Jest: 397/397 PASS
- ✅ Security QA: Layer 1-6 완료
- ✅ Play 정책: 10/10 PASS

---

## 🚀 Step 1: 프로덕션 빌드 실행

### 빌드 설정 검증 완료

**eas.json 설정**:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
        "REVENUECAT_ANDROID_KEY": "goog_BeyiIKXfhmqtbtzaEGMRICChtQd"
      },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "track": "production",
        "releaseStatus": "completed"
      }
    }
  }
}
```

**예상 versionCode**: 20 (자동 증가)

---

### 빌드 명령 실행

```bash
# frontend 디렉토리로 이동
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# EAS 로그인 확인
eas whoami

# 프로덕션 빌드 실행 (빌드만, submit은 별도)
eas build --platform android --profile production --no-wait

# 또는 빌드 + submit 동시 실행 (자동화)
# eas build --platform android --profile production --auto-submit
```

**권장**: `--no-wait` 없이 실행하여 빌드 진행 상황을 실시간으로 확인

---

### 빌드 진행 모니터링

빌드 실행 후 터미널에서:
```
✔ Build started, it may take a few minutes to complete.
Build details: https://expo.dev/accounts/.../builds/...

Waiting for build to complete...
```

**확인 사항**:
1. Build ID 기록
2. 진행 상황 모니터링
3. 에러 발생 시 로그 확인

**예상 소요 시간**: 15-25분

---

## 🔍 Step 2: 빌드 완료 확인

### 빌드 성공 메시지

```
✔ Build finished

📦 Artifacts
› Build artifact: https://expo.dev/artifacts/eas/xxxx.aab
```

### 다운로드 및 검증

```bash
# AAB 파일 다운로드 (브라우저 또는 CLI)
eas build:view [BUILD_ID]

# 또는 expo.dev에서 직접 다운로드
```

**검증 사항**:
- [ ] AAB 파일 크기 확인 (예상: 30-50MB)
- [ ] versionCode 20 확인
- [ ] 서명 상태 확인

---

## 📤 Step 3: Play Store 프로덕션 제출

### Option A: EAS Submit (자동)

```bash
# 이전에 빌드한 AAB를 자동 제출
eas submit --platform android --latest

# 또는 특정 빌드 ID 지정
eas submit --platform android --id [BUILD_ID]
```

**주의**: 서비스 계정 권한 이슈로 실패할 수 있음 (이전 경험)

---

### Option B: Play Console 수동 업로드 (권장) ✅

**이유**:
- 더 안전하고 확실함
- 단계적 출시 설정 가능
- 릴리스 노트 추가 가능

**절차**:

1. **Play Console 접속**
   ```
   https://play.google.com/console
   ```

2. **TravelPlanner 앱 선택**

3. **프로덕션 → 새 릴리스 만들기**

4. **AAB 파일 업로드**
   - expo.dev에서 다운로드한 AAB 파일 선택
   - 업로드 대기 (1-2분)

5. **릴리스 이름 입력**
   ```
   1.0.0 (20)
   ```

6. **릴리스 노트 작성** (ko, en, ja)

   **한국어**:
   ```
   🎉 MyTravel 첫 정식 출시!

   주요 기능:
   - ✈️ AI 기반 맞춤형 여행 일정 생성
   - 🗺️ 실시간 위치 기반 추천
   - 📅 여행 일정 관리 및 공유
   - 🌐 17개 언어 지원
   - 🔐 Google/Kakao 간편 로그인

   여러분의 완벽한 여행 파트너, MyTravel과 함께하세요!
   ```

   **English**:
   ```
   🎉 MyTravel Official Launch!

   Features:
   - ✈️ AI-powered personalized travel itineraries
   - 🗺️ Real-time location-based recommendations
   - 📅 Trip planning and sharing
   - 🌐 17 language support
   - 🔐 Easy login with Google/Kakao

   Your perfect travel companion is here!
   ```

   **日本語**:
   ```
   🎉 MyTravel 正式リリース！

   主な機能:
   - ✈️ AIベースのパーソナライズされた旅行日程
   - 🗺️ リアルタイム位置ベースの推奨
   - 📅 旅行スケジュール管理と共有
   - 🌐 17言語対応
   - 🔐 Google/Kakaoで簡単ログイン

   完璧な旅行パートナー、MyTravelと一緒に！
   ```

7. **단계적 출시 설정**
   ```
   ☑ 단계적 출시 (권장)
   초기 비율: 1% (또는 5%)
   ```

   **이유**:
   - 소규모 사용자로 먼저 테스트
   - 문제 발견 시 빠른 대응
   - 안정성 확인 후 확대

8. **검토 및 출시**
   - [ ] 모든 정보 확인
   - [ ] "검토 시작" 클릭
   - [ ] Google 검토 대기 (몇 시간 ~ 며칠)

---

## ⏰ 예상 타임라인

### 빌드 단계
- **빌드 실행**: 즉시
- **빌드 완료**: 15-25분
- **다운로드 및 검증**: 5분

### 제출 단계
- **AAB 업로드**: 2-5분
- **릴리스 노트 작성**: 10분
- **Google 검토**: 몇 시간 ~ 2일
- **출시 완료**: 검토 승인 후 즉시

### 단계적 출시
- **1% 출시**: 승인 후 즉시
- **10% 확대**: 1-2일 후 (문제 없으면)
- **50% 확대**: 3-5일 후
- **100% 완전 출시**: 1-2주 후

---

## 🚨 트러블슈팅

### 빌드 실패 시

**증상**: "Build failed"

**확인 사항**:
1. 빌드 로그 확인:
   ```bash
   eas build:view [BUILD_ID]
   ```
2. 에러 메시지 분석
3. 일반적인 원인:
   - TypeScript 에러
   - Native 모듈 호환성
   - 환경 변수 누락

**해결**:
- 로컬에서 TypeScript 컴파일 확인
- `npm install` 재실행
- 캐시 클리어 후 재시도

---

### Play Console 업로드 실패

**증상**: "Upload failed" 또는 "Invalid APK/AAB"

**원인**:
- 서명 키 불일치
- versionCode 중복
- 패키지명 불일치

**해결**:
1. AAB 파일 재다운로드
2. versionCode 확인 (20인지)
3. EAS 서명 설정 확인

---

### Google 검토 거부

**증상**: "Your app has been rejected"

**일반적인 이유**:
- 스토어 등록정보 불완전
- 앱 콘텐츠 정책 위반
- 데이터 안전 섹션 미완성

**해결**:
1. 거부 이유 상세 읽기
2. 해당 섹션 수정
3. 재제출

---

## ✅ 체크리스트

### 빌드 전
- [x] eas.json 설정 확인
- [x] versionCode autoIncrement 설정
- [x] 환경 변수 (API_URL, REVENUECAT_KEY) 확인
- [x] SNS 로그인 설정 완료
- [x] QA 테스트 완료

### 빌드 중
- [ ] 빌드 명령 실행
- [ ] 빌드 진행 모니터링
- [ ] 에러 없이 완료 확인

### 빌드 후
- [ ] AAB 파일 다운로드
- [ ] versionCode 20 확인
- [ ] 파일 크기 정상 확인

### Play Store 제출
- [ ] Play Console 접속
- [ ] AAB 업로드
- [ ] 릴리스 노트 작성 (ko, en, ja)
- [ ] 단계적 출시 설정 (1% or 5%)
- [ ] 검토 제출

### 출시 후
- [ ] Google 검토 승인 대기
- [ ] 출시 완료 확인
- [ ] 사용자 피드백 모니터링
- [ ] 단계적 확대 (1% → 10% → 100%)

---

## 📊 모니터링 항목

### 출시 후 첫 24시간
- [ ] 크래시 보고서: Sentry 또는 Play Console
- [ ] SNS 로그인 성공률
- [ ] IAP 결제 성공률
- [ ] 사용자 리뷰 및 평점

### 첫 주
- [ ] 일일 활성 사용자 (DAU)
- [ ] 신규 가입자 수
- [ ] 주요 기능 사용률
- [ ] 성능 메트릭 (앱 시작 시간, API 응답 시간)

---

## 🎉 성공 기준

### 출시 승인
- ✅ Google 검토 통과
- ✅ Play Store에서 앱 검색 가능
- ✅ 설치 및 실행 정상

### 안정성
- ✅ 크래시 비율 < 1%
- ✅ SNS 로그인 성공률 > 95%
- ✅ IAP 결제 성공률 > 90%

### 사용자 만족도
- ✅ 평점 > 4.0
- ✅ 긍정 리뷰 비율 > 70%

---

**문서 작성**: 2026-03-20
**상태**: 빌드 실행 대기
**다음 단계**: EAS 프로덕션 빌드 명령 실행
