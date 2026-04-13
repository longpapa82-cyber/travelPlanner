# V112 Alpha 비공개 테스트 릴리즈 가이드

**작성일**: 2026-04-13
**대상**: versionCode 112 (Alpha 트랙 비공개 테스트)
**상태**: Backend 배포 완료 ✅ | Frontend EAS 빌드 대기 중

---

## ✅ 이미 완료된 것

### Backend (Hetzner VPS 배포 완료)
1. `i18n.ts` — `t()` 보간 지원 + 이메일 인증 에러 메시지 17개 언어 사용자 친화 표현
2. `users.service.ts` — `MAX_EMAIL_VERIFICATION_ATTEMPTS` 상수 + remaining 계산 수정
3. `subscription.service.ts` — `getSubscriptionStatus()` 필드 확장 + INITIAL_PURCHASE 시 `aiTripsUsedThisMonth: 0` 리셋
4. `subscription.controller.ts` — `crypto.timingSafeEqual` 기반 webhook 인증

### RevenueCat 인프라 (복구 완료)
- Service Account JSON 새 키 업로드 → `Valid credentials`
- Webhook 파이프라인 정상 동작 검증 완료 (INITIAL_PURCHASE/EXPIRATION/CANCELLATION 200 응답)
- Alpha 테스터들이 앱에서 Restore Purchases 실행하면 기존 구독 자동 반영됨

### Frontend 코드 (커밋 대기 중, 로컬 수정 완료)
1. `ConsentScreen.tsx` — 동의 버튼 여백 24px 상단/16px 하단 추가
2. `HomeScreen.tsx` — 코치마크 `animationDone` state + 1500ms fallback + rAF
3. `CreateTripScreen.tsx` — 토스트 지연 표시 + `postAdToastTimerRef` unmount cleanup
4. `premium.json (ko, en)` — `startedOn`, `renewsOn`, `planMonthly`, `planYearly` 4개 키 추가

### 설정
- `eas.json`:
  - `track: "alpha"` ✅
  - `releaseStatus: "draft"` ✅
  - `EXPO_PUBLIC_USE_TEST_ADS` 제거 ✅
- `nginx.conf`: uploads 확장자 차단 강화 (`.json|.txt|.xml|.yaml|.yml|...` 추가)
- `.gitignore`: `uploads/`, `**/tripplanner-*.json` 패턴 추가

---

## 📋 V112 Alpha 빌드 — 사용자 실행 단계

### Step 1: Frontend EAS 빌드 (Alpha 트랙 draft로 자동 업로드)
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend
eas build --platform android --profile production --auto-submit --non-interactive
```

⚠️ **중요**:
- `--profile production`은 EAS 빌드 프로필 이름이며 Google Play Production 트랙과 **무관**함
- 실제 업로드 트랙은 `eas.json`의 `submit.production.android.track: "alpha"`가 결정
- `--auto-submit` + `releaseStatus: "draft"` 조합으로 **Alpha 트랙에 초안 상태로만 업로드**됨
- 테스터에게 자동 공개되지 않으며, Play Console에서 수동 출시 버튼을 눌러야 전달됨

### Step 2: EAS 빌드 상태 확인
```bash
eas build:list --platform android --limit 3
```
또는 https://expo.dev → 프로젝트 → Builds 탭

빌드 소요 시간: 일반적으로 15~25분

### Step 3: Play Console에서 Alpha draft 확인
1. https://play.google.com/console 접속
2. TravelPlanner → **비공개 테스트** → **Alpha**
3. "출시" 섹션에서 새 버전(versionCode 112)이 **초안** 상태로 있는지 확인
4. 출시 노트 추가 (V111 대비 변경사항 요약 권장)
5. **"출시 검토"** → **"Alpha에 출시"** 클릭 → 테스터에게 배포 시작

### Step 4: 테스터 기기 업데이트
- 테스터 기기에서 Google Play → TravelPlanner → 업데이트
- 또는 Alpha 테스터 참여 링크를 다시 열어 업데이트 확인
- 업데이트 완료 후 앱 실행

---

## 🧪 V112 테스트 체크리스트 (V111 이슈 7건 검증)

### ✅ V111-1: 이메일 인증 에러 메시지
**재현 절차**:
1. 신규 가입 또는 이메일 재인증
2. 잘못된 6자리 코드 입력
3. **기대 결과**: "인증 코드가 올바르지 않습니다. 4번 더 시도할 수 있어요."
4. 잘못된 코드 연속 입력 시 `4 → 3 → 2 → 1 → 0` 점차 감소
5. 5번째 시도 후 "시도 횟수를 초과했습니다" 메시지

**Pass 기준**:
- "유효하지 않은 인증 토큰" 같은 개발자 용어 없음
- `(4)` 괄호 숫자 대신 자연스러운 문장 ("4번 더 시도할 수 있어요")

### ✅ V111-2: 동의 화면 버튼 여백
**재현 절차**:
1. 신규 설치 후 첫 실행
2. 서비스 이용 동의 화면 진입
3. [동의하고 시작하기] 버튼 위치 확인

**Pass 기준**:
- 버튼이 화면 하단에 정확히 붙어있지 않고 적절한 여백(약 56px+)이 있음
- 버튼 상단에도 콘텐츠와 20px 이상 간격
- 터치하기 편한 위치

### ✅ V111-3: 홈 코치마크 위치
**재현 절차**:
1. 신규 설치 (또는 튜토리얼 리셋) 후 로그인
2. 홈 화면 진입 → 코치마크 애니메이션 자동 표시
3. "여기를 눌러 첫 여행을 시작하세요!" 박스가 가리키는 영역 확인

**Pass 기준**:
- 코치마크 박스가 **정확히 `[AI 여행 계획 만들기]` 버튼 영역을 감싸고** 있음
- 다양한 기기 해상도에서 동일하게 정확 (가능하면 여러 기기로 테스트)
- 앱 재시작/탭 전환 후 다시 홈으로 돌아와도 정확

### ✅ V111-4: AI 카운터 오표기 (RevenueCat 복구로 해결)
**재현 절차**:
1. hoonjae723@gmail.com 로그인 → 프리미엄 구독 테스트
2. 홈 화면 상단 AI 카운터 확인
3. 여행 수동 생성 → 상단 메시지 확인

**Pass 기준**:
- 구독자: `30/30` 또는 사용량에 맞는 숫자 표시 (3/3 아님)
- 구독자에게 "1/3회 남음" 같은 오표기 없음
- 무료 회원: 실제 남은 횟수 정확 표시

### ✅ V111-5: 광고 중 메시지
**재현 절차**:
1. 무료 회원으로 2회 여행 생성 (이제 1회 남은 상태)
2. 3번째 여행 생성 → 전면 광고 재생
3. 광고 재생 중 상단 메시지 확인
4. 광고 종료 후 여행 상세 화면 진입 → 토스트 확인

**Pass 기준**:
- 광고 재생 중 상단에 메시지 없음 (가려짐 문제 해결)
- 광고 종료 약 4초 후 "이번 달 AI 자동 생성 1/3회 남음" 등 메시지가 **여행 상세 화면 위에 표시**
- 메시지 내용이 실제 남은 횟수와 일치

### ✅ V111-6: 구독 화면 필드 (webhook 복구로 해결)
**재현 절차**:
1. 구독 중인 계정으로 로그인
2. 프로필 → 구독 관리 화면 진입

**Pass 기준**:
- **구독 시작일** 표시 (예: "시작일: 2026-04-13")
- **다음 결제일 또는 만료일** 표시
- **월간/연간 구분** 표시 ("월간 플랜" 또는 "연간 플랜")
- **결제 수단** 표시 (Google Play 등)

### ✅ V111-7: 구독자 3/3 → 30/30 형식
**재현 절차**:
1. 구독자 계정으로 로그인
2. 홈 화면 AI 카운터 영역 + 구독 화면 AI 남은 횟수 확인

**Pass 기준**:
- `30회` 또는 `30/30` 형식으로 표시 (무료 `3/3` 아님)
- V111 이전의 "1/3 남음" 오표기 없음

---

## 🔄 Restore Purchases (중요!)

기존 구독 이력이 있는 테스터(hoonjae723 등)는 V112 업데이트 후 **첫 실행 시 Restore Purchases가 자동 호출**되지만, 혹시 구독이 반영되지 않으면:

1. 앱 → 프리미엄/구독 화면 진입
2. **"복원하기"** 또는 **"Restore Purchases"** 버튼 탭
3. RevenueCat이 Google Play에서 구독 이력을 가져옴
4. Backend webhook으로 DB 자동 업데이트
5. 앱 재실행 또는 앱 새로고침 시 구독 상태 반영

**확인 방법** (제가 SSH로 직접 가능):
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner && docker compose logs --tail=100 backend 2>&1 | grep -iE 'revenuecat|subscription.*event'"
```

---

## 🚨 보안 작업 — Alpha 배포 이후 반드시 해결 (Task #20)

### 문제
GitHub public repo `github.com/longpapa82-cyber/travelPlanner` 커밋 `666130ca`에 이전 Service Account JSON 파일(`uploads/tripplanner-486511-05e640037694.json`)이 포함되어 있음. 로컬 삭제로는 무효.

### 현재 상태 (덜 위험한 편)
- 해당 키(`private_key_id: 05e640037694...`)는 Google이 자동 감지해 **이미 disabled** 처리
- RevenueCat은 **새 키**(`bb41acd291a2`) 사용 중이라 현재 동작에 영향 없음
- 하지만 disabled 키도 **rotation 기록 용도로 완전 삭제하는 것이 원칙**

### 조치 순서

#### 1단계: Google Cloud Console에서 disabled 키 완전 삭제
1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=tripplanner-486511
2. `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com` 클릭
3. 키 탭
4. `05e640037694c1a06539ea9a236c039aabbb89ee` (Disabled 상태) 오른쪽 🗑 아이콘 클릭 → 영구 삭제
5. Active 상태인 새 키(`f9090d...` + 새로 만든 `bb41acd...`) 유지

#### 2단계: Service Account Audit Logs 확인 (비정상 사용 여부)
```
Google Cloud Console → Logging → Logs Explorer
필터:
  resource.type="iam_service_account"
  protoPayload.authenticationInfo.principalEmail="mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com"
  timestamp >= "2026-03-10T00:00:00Z"
```
비정상 IP/지역의 호출이 있는지 확인. 없으면 ✅

#### 3단계: Git 히스토리에서 파일 완전 제거
**주의**: 히스토리 rewrite는 force push가 필요하며, 협업자가 있으면 사전 공지 필수.

```bash
cd /Users/hoonjaepark/projects/travelPlanner

# git filter-repo 설치 (없는 경우)
brew install git-filter-repo   # Xcode 라이선스 해결 후

# 파일 히스토리 완전 제거
git filter-repo --path uploads/tripplanner-486511-05e640037694.json --invert-paths

# 원격 refs 재설정
git remote add origin https://github.com/longpapa82-cyber/travelPlanner.git

# 강제 push (주의: 협업자 모두 재-clone 필요)
git push --force --all origin
git push --force --tags origin
```

#### 4단계: GitHub Support에 캐시 삭제 요청
1. https://support.github.com/request 접속
2. "Sensitive data removal" 카테고리 선택
3. 리포지토리 URL + 커밋 SHA(`666130ca`) + 파일 경로 제공
4. GitHub이 CDN/캐시/fork에서 추가 삭제 진행

#### 5단계: Git working tree에서 `uploads/` 정리
```bash
git rm --cached -r uploads/ 2>/dev/null
git commit -m "chore(security): remove uploads/ from tracking and block sensitive extensions in nginx"
```

### ⚠️ 이 작업을 하기 전에 하지 말 것
- **현재 V112 Alpha 빌드 전에 git push 하지 마세요** — push 순간 다시 동일한 exposure가 발생합니다
- git commit은 **Task #20 1~5단계 완료 후**에 해주세요
- 그 전까지는 **로컬 파일만 수정한 상태로 유지**하면 안전합니다

---

## 🎯 권장 진행 순서

1. ✅ **Backend 배포 완료** (DONE)
2. ⏳ **Frontend EAS 빌드 실행** (사용자 로컬 명령)
3. ⏳ **Play Console Alpha 트랙에 draft 생성 확인**
4. ⏳ **Alpha 테스터에게 출시** (Play Console에서 수동 출시 버튼)
5. ⏳ **테스터 기기에서 V111 이슈 7건 검증** (이 문서의 체크리스트)
6. ⏳ **Task #20 보안 정리** (git 히스토리 purge + 키 삭제)
7. ⏳ **로컬 변경사항 git commit + push** (Task #20 이후 안전)
8. ⏳ (나중에) **Production 단계적 출시** (테스터 피드백 확인 후 별도 판단)

---

## 📞 문제 발생 시 롤백

### Backend 롤백
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127
cd /root/travelPlanner
TS=20260413-132101  # 백업 타임스탬프
cp backend/src/common/i18n.ts.bak-$TS backend/src/common/i18n.ts
cp backend/src/users/users.service.ts.bak-$TS backend/src/users/users.service.ts
cp backend/src/subscription/subscription.service.ts.bak-$TS backend/src/subscription/subscription.service.ts
cp backend/src/subscription/subscription.controller.ts.bak-$TS backend/src/subscription/subscription.controller.ts
docker compose build backend
docker compose up -d backend
```

### Frontend 롤백
- Play Console → Alpha → 이전 버전(V111)을 새 출시로 승격
- 또는 draft 상태의 V112를 삭제 (공개되지 않으므로 삭제가 가장 간단)
