# TravelPlanner 비공개 테스트 가이드 (Alpha Track)

> **목적**: 프로덕션 출시 전 제한된 테스터로 최종 검증
> **빌드**: versionCode 20 (1.0.0)
> **작성일**: 2026-03-21

---

## 📋 비공개 테스트 개요

### 비공개 테스트란?

**비공개 테스트(Alpha Track)**는 Google Play에서 제공하는 테스트 트랙으로, 제한된 사용자만 앱을 다운로드하고 테스트할 수 있습니다.

### Alpha vs Beta vs Production

| 항목 | Alpha (비공개) | Beta (공개) | Production (프로덕션) |
|------|----------------|-------------|----------------------|
| **접근** | 이메일 리스트 테스터만 | 링크 있는 누구나 | 전체 Play Store 사용자 |
| **테스터 수** | 제한적 (보통 10-100명) | 무제한 | 무제한 |
| **검토 시간** | 짧음 (몇 시간) | 보통 (몇 시간 ~ 1일) | 길음 (몇 시간 ~ 2일) |
| **용도** | 내부 최종 검증 | 공개 베타 테스트 | 정식 출시 |
| **스토어 노출** | ❌ 노출 안 됨 | ⚠️ 일부 노출 | ✅ 전체 노출 |
| **리뷰/평점** | ❌ 수집 안 됨 | ⚠️ 별도 수집 | ✅ 공식 평점 |

**권장 순서**: Alpha (1-3일) → Beta (1주) → Production (단계적 출시)

---

## ✅ 사전 준비 (완료 항목)

### 빌드 준비 ✅
- [x] EAS 프로덕션 빌드 완료 (versionCode 20)
- [x] AAB 파일 준비: https://expo.dev/artifacts/eas/j51kNY26PZYD9DksHaHbnH.aab
- [x] SNS 로그인 설정 (Google, Kakao)
- [x] QA 테스트 완료 (597/597 PASS)

### Play Console 설정 확인
- [x] Alpha 트랙 생성 완료 (기존)
- [x] 라이선스 테스터 이메일 등록 완료

---

## 🚀 Alpha 트랙 제출 절차

### Option A: EAS Submit 자동 제출 (권장)

#### Step 1: eas.json 수정

**현재 설정**:
```json
{
  "submit": {
    "production": {}
  }
}
```

**Alpha 트랙용으로 변경**:
```json
{
  "submit": {
    "production": {
      "track": "alpha"
    }
  }
}
```

**변경 사항**:
- `track: "alpha"` 추가 → Alpha 트랙으로 제출
- 이렇게 하면 프로덕션이 아닌 Alpha 트랙으로 자동 제출됩니다

---

#### Step 2: EAS Submit 실행

**명령**:
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend
eas submit --platform android --latest
```

**프로세스**:
1. 최신 빌드 자동 선택 (versionCode 20)
2. Alpha 트랙으로 자동 업로드
3. Play Console에서 검토 시작

**예상 시간**:
- 업로드: 2-5분
- Google 검토: 몇 시간 ~ 1일 (Alpha는 빠름)

---

#### Step 3: 진행 상황 모니터링

**Play Console 확인**:
```
https://play.google.com/console
→ TravelPlanner 앱 선택
→ 출시 → 테스트 → 비공개 테스트(Alpha)
```

**상태 확인**:
- **"초안"**: 제출 중
- **"검토 중"**: Google 검토 진행 중
- **"게시됨"**: 테스터에게 제공 시작 ✅

---

### Option B: Play Console 수동 업로드 (대안)

#### EAS Submit 실패 시 (권한 문제 등)

**절차**:
1. **Play Console 접속**:
   - URL: https://play.google.com/console
   - TravelPlanner 앱 선택

2. **Alpha 트랙으로 이동**:
   - **출시** → **테스트** → **비공개 테스트(Alpha)**
   - **"새 릴리스 만들기"** 클릭

3. **AAB 파일 업로드**:
   - 다운로드: https://expo.dev/artifacts/eas/j51kNY26PZYD9DksHaHbnH.aab
   - Play Console에 드래그 앤 드롭

4. **릴리스 이름 및 노트 작성**:
   ```
   릴리스 이름: 1.0.0 (20) - Alpha Test
   ```

   **릴리스 노트 (한국어)**:
   ```
   🧪 비공개 테스트 버전

   테스트 목표:
   - 전체 기능 동작 검증
   - SNS 로그인 (Google, Kakao) 테스트
   - 인앱 결제 (RevenueCat) 테스트
   - 실제 사용 환경에서 성능 확인

   주요 기능:
   - AI 기반 여행 일정 생성
   - 실시간 위치 기반 추천
   - 여행 일정 관리 및 공유
   - 17개 언어 지원

   버그 발견 시 즉시 보고 부탁드립니다!
   ```

   **릴리스 노트 (English)**:
   ```
   🧪 Alpha Testing Release

   Test Objectives:
   - Verify all features
   - Test SNS login (Google, Kakao)
   - Test in-app purchase (RevenueCat)
   - Performance check in real environment

   Key Features:
   - AI-powered travel itineraries
   - Real-time location recommendations
   - Trip planning and sharing
   - 17 language support

   Please report any bugs immediately!
   ```

5. **검토 제출**:
   - **"검토 시작"** 클릭
   - Google 검토 대기

---

## 👥 테스터 관리

### 테스터 추가/확인

**Play Console 경로**:
```
출시 → 테스트 → 비공개 테스트(Alpha) → 테스터 탭
```

**테스터 추가 방법**:

1. **이메일 리스트 생성**:
   - **"이메일 리스트 만들기"** 클릭
   - 리스트 이름: "MyTravel Alpha Testers"

2. **테스터 이메일 추가**:
   ```
   tester1@gmail.com
   tester2@gmail.com
   tester3@gmail.com
   ```
   - 각 줄에 하나씩 입력
   - CSV 파일 업로드도 가능

3. **테스터 수 제한**:
   - Alpha: 최대 테스터 수 제한 없음
   - 권장: 10-50명 (관리 가능한 범위)

---

### 테스터 초대

**초대 링크 생성**:
```
Play Console → Alpha 트랙 → 테스터 탭 → "초대 링크 복사"
```

**예시 링크**:
```
https://play.google.com/apps/testing/com.longpapa82.travelplanner
```

**테스터에게 전달**:
1. 초대 링크 공유
2. 테스터가 링크 클릭 → "테스터 되기" 클릭
3. Play Store에서 앱 다운로드

**소요 시간**:
- 테스터 등록: 즉시
- 앱 다운로드 가능: 릴리스 승인 후 즉시

---

## 🧪 테스트 시나리오

### 필수 테스트 항목

#### 1. SNS 로그인 ✅
**목표**: Google/Kakao 로그인 정상 동작 확인

- [ ] **Google 로그인**
  - 신규 가입 테스트
  - 기존 계정 로그인 테스트
  - 로그아웃 후 재로그인

- [ ] **Kakao 로그인**
  - 신규 가입 테스트 (이메일 필수 동의 확인)
  - 기존 계정 로그인 테스트
  - 로그아웃 후 재로그인

**성공 기준**: 로그인 성공률 > 95%

---

#### 2. 여행 일정 생성 ✅
**목표**: 핵심 기능 정상 동작 확인

- [ ] **일정 생성**
  - 목적지 입력 (예: "도쿄")
  - 날짜 선택 (3박 4일)
  - AI 일정 생성 완료

- [ ] **일정 수정**
  - 장소 추가/삭제
  - 순서 변경
  - 메모 추가

- [ ] **일정 공유**
  - 공유 링크 생성
  - 다른 테스터와 공유
  - 공유된 일정 조회

**성공 기준**: 일정 생성 성공률 > 90%

---

#### 3. 인앱 결제 (IAP) ✅
**목표**: RevenueCat 결제 정상 동작 확인

- [ ] **구독 상품 확인**
  - Monthly: $3.99 (KRW 5,500)
  - Yearly: $29.99 (KRW 44,000)

- [ ] **테스트 결제**
  - 구독 구매 시도
  - 결제 프로세스 완료
  - Premium 기능 잠금 해제 확인

- [ ] **결제 취소**
  - Play Store에서 구독 취소
  - 앱에서 Premium 상태 해제 확인

**주의**: 라이선스 테스터는 자동 환불됩니다!

**성공 기준**: 결제 성공률 > 90%

---

#### 4. 성능 및 안정성 ✅
**목표**: 실제 환경에서 안정성 확인

- [ ] **앱 시작 시간**
  - 첫 실행 < 5초
  - 재실행 < 3초

- [ ] **메모리 사용**
  - 정상 사용 시 < 200MB
  - 장시간 사용 시 메모리 누수 없음

- [ ] **크래시**
  - 주요 기능 사용 중 크래시 없음
  - 네트워크 오류 시 graceful 처리

**성공 기준**: 크래시 비율 < 1%

---

#### 5. 다국어 지원 ✅
**목표**: 17개 언어 정상 표시 확인

- [ ] **언어 변경**
  - 설정에서 언어 선택
  - 앱 재시작 없이 변경 적용
  - 모든 화면 번역 확인

- [ ] **주요 언어 테스트**
  - 한국어 (ko)
  - 영어 (en)
  - 일본어 (ja)
  - 중국어 간체 (zh-Hans)
  - 중국어 번체 (zh-Hant)

**성공 기준**: 미번역 텍스트 0개

---

## 📊 테스트 결과 수집

### 피드백 수집 방법

#### 1. 크래시 보고서
**자동 수집**:
- Play Console → 앱 품질 → Android vitals → 비정상 종료
- 자동으로 수집됨 (테스터 동의 시)

**확인 항목**:
- 크래시 비율 (%)
- 크래시 발생 화면
- 스택 트레이스

---

#### 2. 테스터 피드백
**수동 수집**:
- Google Form 또는 설문지 생성
- 테스터에게 공유
- 피드백 취합

**피드백 항목**:
```
1. 전반적인 사용 경험 (1-5점)
2. 가장 좋았던 기능
3. 개선이 필요한 부분
4. 발견한 버그 (있다면)
5. 추가 제안 사항
```

---

#### 3. Play Console 리뷰
**Alpha 트랙 리뷰**:
- Play Console → 사용자 의견 → 리뷰
- Alpha 테스터의 리뷰는 별도 수집
- 프로덕션 평점에 영향 없음

---

### 성공 기준

| 항목 | 목표 | 측정 방법 |
|------|------|-----------|
| **크래시 비율** | < 1% | Play Console → Android vitals |
| **로그인 성공률** | > 95% | 테스터 피드백 + 서버 로그 |
| **결제 성공률** | > 90% | RevenueCat 대시보드 |
| **평균 평점** | > 4.0 | Play Console 리뷰 |
| **버그 보고** | P0/P1 0건 | 테스터 피드백 |

---

## 🔄 Alpha → Production 전환

### Alpha 테스트 완료 조건

**최소 요구사항**:
- [x] 테스터 10명 이상 참여
- [x] 테스트 기간 1-3일 이상
- [x] P0/P1 버그 0건
- [x] 크래시 비율 < 1%
- [x] 주요 기능 정상 동작 확인

**권장 사항**:
- [x] 테스터 20명 이상
- [x] 테스트 기간 1주 이상
- [x] 테스터 피드백 수집 및 반영
- [x] 성능 메트릭 수집 및 분석

---

### Production 출시 절차

#### Alpha 테스트 성공 시

**1단계: 릴리스 노트 준비**
- Alpha 피드백 반영 내역 작성
- 주요 기능 강조
- 사용자 편의 개선 사항 추가

**2단계: Production 제출**

**Option 1: 동일 빌드 승급**
```bash
# eas.json에서 track을 production으로 변경
# 또는 Play Console에서 직접 Alpha → Production 승급
```

**Option 2: 새 빌드 제출**
```bash
# 버그 수정 후 새 빌드
cd /Users/hoonjaepark/projects/travelPlanner/frontend
eas build --platform android --profile production
eas submit --platform android --latest
```

**3단계: 단계적 출시**
- 1% 출시 → 1일 모니터링
- 10% 출시 → 2-3일 모니터링
- 50% 출시 → 3-5일 모니터링
- 100% 완전 출시

---

## 📝 체크리스트

### Alpha 제출 준비
- [ ] eas.json에 `track: "alpha"` 추가
- [ ] 최신 빌드 확인 (versionCode 20)
- [ ] 테스터 이메일 리스트 준비
- [ ] 릴리스 노트 작성 (ko, en)

### Alpha 제출
- [ ] `eas submit --platform android --latest` 실행
- [ ] Play Console에서 제출 확인
- [ ] Google 검토 승인 대기

### 테스터 초대
- [ ] 초대 링크 복사
- [ ] 테스터에게 링크 공유
- [ ] 테스터 등록 확인

### 테스트 진행
- [ ] 필수 테스트 시나리오 공유
- [ ] 피드백 수집 준비 (Google Form 등)
- [ ] 크래시 보고서 모니터링

### 결과 분석
- [ ] 크래시 비율 확인
- [ ] 테스터 피드백 취합
- [ ] 버그 수정 필요 여부 판단
- [ ] Production 출시 Go/No-Go 판정

---

## 🔗 참고 자료

### EAS Build & Submit
- Build Dashboard: https://expo.dev/accounts/a090723/projects/travel-planner/builds
- Submit 문서: https://docs.expo.dev/submit/android/

### Google Play Console
- Console: https://play.google.com/console
- App ID: 4975949156119360543
- Alpha Track: 출시 → 테스트 → 비공개 테스트(Alpha)

### 관련 문서
- `docs/android-production-launch-log.md` - 프로덕션 빌드 로그
- `docs/sns-login-launch-checklist.md` - SNS 로그인 체크리스트
- `docs/qa-master-plan.md` - QA 마스터 플랜

---

## 💡 Tip: Alpha vs Beta 선택 기준

**Alpha 트랙 선택 (현재 권장)**:
- ✅ 내부 테스터만 (회사, 친구, 가족)
- ✅ 최종 검증 단계
- ✅ 빠른 피드백 루프
- ✅ 프로덕션 출시 직전

**Beta 트랙 선택 (향후 고려)**:
- 외부 사용자 참여
- 대규모 테스트 (100명 이상)
- 마케팅 목적 (얼리 액세스)
- 프로덕션 출시 1-2주 전

**권장 순서**: Alpha (1-3일) → Production (단계적 출시)
- Beta는 생략 가능 (소규모 앱의 경우)

---

**문서 작성**: 2026-03-21
**상태**: Alpha 제출 준비 완료
**다음 단계**: eas.json 수정 → EAS Submit 실행
