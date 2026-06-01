# iOS B31 App Store 재심사 대응 계획

> **생성일**: 2026-05-09
> **대상 빌드**: B31 (buildNumber: 31)
> **반려 빌드**: B29 (1.0.0), 제출 ID: e8864c14-9ac8-4f57-bc19-ae208423dece
> **반려일**: 2026-05-09 오전 1:18

---

## 반려 사유 요약

| # | 가이드라인 | 내용 | 처리 방법 |
|---|-----------|------|---------|
| A | 2.1(b) | IAP 미제출 | ASC UI 작업 |
| B | 3.1.2(c) | EULA 링크 누락 | ASC UI 작업 |
| C | 5.1.1(v) | 로그인 강제 (게스트 모드 없음) | Apple에 Reply로 이의 제기 |
| D | 2.1 | ATT 팝업 미노출 | 코드에서 ATT 제거 |

---

## 작업 체크리스트

### STEP 1 — App Store Connect UI 작업 (코드 변경 없음)

#### A. IAP 심사 제출
- [ ] App Store Connect → MyTravel → 수익화 → 구독
- [ ] **월간 구독** (`premium_monthly`) 클릭 → 페이월 스크린샷 첨부 → "심사를 위해 제출"
- [ ] **연간 구독** (`premium_yearly`) 클릭 → 페이월 스크린샷 첨부 → "심사를 위해 제출"
- 스크린샷: 페이월 화면 (Upgrade to Premium 모달, $3.99/$29.99 표시 화면)

#### B. EULA 링크 추가
- [ ] App Store Connect → MyTravel → 앱 정보 → 앱 설명(한국어/영어) 하단에 아래 텍스트 추가:
  ```
  Terms of Service: https://mytravel-planner.com/terms
  Privacy Policy: https://mytravel-planner.com/privacy
  ```
- [ ] 또는 App Store Connect → 앱 정보 → EULA 필드에 URL 등록

#### C. Apple Reply — 5.1.1(v) 이의 제기 (지금 바로)
- [ ] App Store Connect → 해당 제출 → 메시지 → Reply 버튼 클릭
- [ ] 아래 메시지 전송:

```
Hello,

Thank you for your detailed feedback.

Regarding Guideline 5.1.1(v): MyTravel is an account-based travel planning app. All core features — AI trip generation, personal trip management, expense tracking, and social sharing — require a user account because they are tied to personal user data stored on our servers. Users cannot meaningfully use the app without an account, as there is no content to display without personalized trip data.

This falls under the exception in guideline 5.1.1(v): "except when directly relevant to the core functionality of the app." We respectfully request reconsideration of this item.

We are actively working on the other issues (IAP submission, EULA link, and ATT) and will submit a new binary shortly.

Thank you for your understanding.
```

---

### STEP 2 — 코드 수정 (B31 빌드 준비)

#### D. ATT (앱 추적 투명성) 제거

**배경**: myTravel은 IDFA를 제3자에게 공유하지 않으므로 ATT 팝업이 불필요.
AdMob은 `delayAppMeasurementInit: true`로 설정되어 있고 별도 추적 코드 없음.

**수정 파일 목록:**

**D-1. `frontend/app.config.js`**
- `'expo-tracking-transparency'` 플러그인 제거

**D-2. `frontend/src/navigation/RootNavigator.tsx`**
- `import { useTrackingTransparency } from '../hooks/useTrackingTransparency'` 제거
- `const { shouldShowPrePermission, sessionCount, requestTracking } = useTrackingTransparency()` 제거
- `showATTModal` state 및 관련 useEffect 제거
- `PrePermissionATTModal` import 및 렌더링 제거

**D-3. `frontend/src/components/PrePermissionATTModal.tsx`** (파일 삭제 또는 유지)
- 삭제해도 무방 (다른 곳에서 import 없음)

**D-4. `frontend/src/hooks/useTrackingTransparency.ts`** (파일 삭제 또는 유지)
- 삭제해도 무방 (RootNavigator에서만 사용)

**D-5. App Store Connect — 개인정보 설정**
- [ ] App Store Connect → MyTravel → 앱 개인정보 → 추적
- [ ] "앱이 사용자를 추적하지 않습니다" 선택으로 변경

---

### STEP 3 — 빌드 및 제출

```bash
# 1. buildNumber 30 → 31 변경
# frontend/app.config.js: buildNumber: '31'

# 2. 로컬 빌드
cd frontend
eas build --platform ios --profile production-ios --local --output ../build-ios-31.ipa

# 3. TestFlight 업로드
xcrun altool --upload-app --type ios \
  --file ../build-ios-31.ipa \
  --username longpapa82@gmail.com \
  --password zicp-yjik-qmwm-xqpy

# 4. App Store Connect에서 제출
# → 배포 탭 → 버전 1.0 → 빌드 변경 (현재 → 31) → 저장 → 심사에 추가
# ⚠️ eas submit 사용 금지 — "already submitted" 오류 발생
# ⚠️ App Store Connect UI에서 반드시 직접 제출할 것
```

---

### STEP 4 — Apple Reply 추가 답변 (새 바이너리 제출 후)

새 빌드 제출 후 Apple 심사 메시지에 추가 Reply:

```
We have submitted a new binary (build 31) that addresses the following:

1. [2.1(b)] IAP products have been submitted for review in App Store Connect.
2. [3.1.2(c)] Terms of Service and Privacy Policy links have been added to the App Store description.
3. [2.1 ATT] The app does not track users. We have removed the AppTrackingTransparency framework and updated the app privacy information in App Store Connect to reflect that the app does not track users.
4. [5.1.1(v)] As explained in our previous reply, MyTravel is an account-based app and login is required for all core functionality.

Please let us know if you need any additional information.
```

---

## 현재 진행 상태

- [x] STEP 1-C: Apple Reply 전송 완료 (2026-05-09 오후 12:29)
- [ ] STEP 1-A: IAP 심사 제출 ⚠️ **다음 세션 — ASC 버전 1.0 페이지 "앱 내 구입 및 구독" 섹션에서 제출**
- [x] STEP 1-B: EULA 링크 추가 완료 (한국어/영어 앱 설명 하단에 Terms/Privacy URL 추가)
- [ ] STEP 1-D: ASC 개인정보 추적 설정 변경 ⚠️ **B31 TestFlight 처리 완료 후 가능**
- [x] STEP 2-D: 코드에서 ATT 제거 완료 (2026-05-09)
  - [x] app.config.js: `expo-tracking-transparency` 플러그인 제거
  - [x] app.config.js: `NSUserTrackingUsageDescription` 제거
  - [x] app.config.js: buildNumber '30' → '31'
  - [x] RootNavigator.tsx: ATT import/hook/state/modal 제거
  - [x] PrePermissionATTModal.tsx 삭제
  - [x] useTrackingTransparency.ts 삭제
  - [x] useTrackingTransparency.test.ts 삭제
- [x] STEP 3: B31 빌드 완료 + TestFlight 업로드 완료 (Delivery UUID: 68b9610b-48f8-4fd9-9d6b-558982524628)
- [ ] STEP 3 (수동): ⚠️ **ASC에서 빌드 31 선택 → IAP 제출 → "심사에 추가" 클릭**
- [ ] STEP 4: 제출 후 Apple Reply (B31 제출 완료 후 전송)

## B32 추가 작업 (2026-05-09)

- [x] 버그 수정: 로그인 후 홈이 아닌 내 여행으로 이동 (RootNavigator.tsx 네비게이션 상태 초기화)
  - 원인: 로그인(null→userId) 전환 시 `initialNavState`가 초기화되지 않아 이전 세션 상태 복원
  - 수정: `prevId === null && currentId !== null` 조건 시 `setInitialNavState(undefined)` 추가
- [x] B32 빌드 완료 + TestFlight 업로드 완료 (Delivery UUID: 0f482e00-a038-4360-8d24-b6fc01371c7f)
- [ ] B32 TestFlight 테스트: 로그인 후 홈 탭 이동 확인
- [ ] B31 심사 통과 후 B33으로 제출 (현재 app.config.js buildNumber: '32')

---

## 주의사항

- **buildNumber**: 현재 `30` (app.config.js) → B31에서 `31`로 변경
- **build-ios-30.ipa**: 빌드 완료되어 있으나 제출에 사용하지 않음 (B29와 동일한 "already submitted" 오류 발생 가능)
- **eas submit 금지**: TestFlight에 한 번이라도 업로드된 buildNumber는 재사용 불가
- **IAP 스크린샷**: 페이월 모달(Upgrade to Premium) 화면 캡처본 준비

---

## 참고 파일

- `iOStest.md` — 빌드 이력 및 제출 명령어
- `docs/status.md` — 전체 프로젝트 현황
- `frontend/app.config.js` — buildNumber 관리
- `frontend/src/navigation/RootNavigator.tsx` — ATT 관련 코드
- `frontend/src/components/PrePermissionATTModal.tsx` — ATT 모달 (삭제 대상)
- `frontend/src/hooks/useTrackingTransparency.ts` — ATT 훅 (삭제 대상)
