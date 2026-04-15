# V114 재현 시나리오

작성일: 2026-04-15
목적: 14개 이슈를 일관되게 재현하고 수정 후 검증하기 위한 step-by-step 재현 경로

---

## 재현 환경

- **기기**: Android 실기기 (Pixel 6 Pro 또는 Galaxy S22, SDK 34)
- **빌드**: Alpha 트랙, versionCode 114
- **네트워크**: 프로덕션 `https://mytravel-planner.com` 백엔드
- **계정 종류**:
  - Free: 신규 가입용 임시 계정 (테스트마다 새로 생성)
  - Premium (Monthly): hoonjae723@gmail.com
  - Premium (Yearly): hoonjae723@gmail.com (현재 yearly 구독)
  - Admin: longpapa82@gmail.com, a090723@naver.com

## 공통 사전 조건

- 앱 uninstall → reinstall (신규 설치 시나리오)
- 웹 브라우저(Chrome Incognito): `https://mytravel-planner.com` 미로그인 상태

---

## V114-1: 비밀번호 재설정 웹 우회

**재현 경로**:
1. 앱에서 `ForgotPasswordScreen` → 이메일 입력 → 재설정 요청
2. 수신 메일에서 `[비밀번호 재설정]` 버튼 탭
3. **Expected**: 앱으로 deep link 전환 → `ResetPasswordScreen` 표시
4. **Actual (V114)**:
   - 브라우저가 열림 → `https://mytravel-planner.com/reset-password?token=...`
   - Expo web 앱이 뜸 → 로그인 페이지로 이동 (reset-password 화면 자체 미표시)
   - 로그인 가능 → 웹에서 앱 서비스 전체 이용 가능

**근본 원인**: `FRONTEND_URL=https://mytravel-planner.com` 이 Expo web 앱으로 서빙됨. SPA fallback이 모든 경로를 `/index.html`로 전달.

**수정 검증**:
- Gmail 메일 수신 상태에서 링크 탭 → **앱이 열림** (App Links 정상)
- 앱 미설치 시 → Play Store deep link
- 브라우저에서 URL 직접 입력 → "앱에서만 재설정 가능" 안내 페이지

---

## V114-1b: 비번 재설정 화면 "뜨지도 않음" (V112 regression)

**재현 경로**:
1. 위 V114-1 경로에서 웹 앱 로딩 완료
2. **Expected (V112)**: `/reset-password?token=...`로 접근 시 reset form 표시됐음
3. **Actual (V114)**: reset form이 아예 렌더링 안 됨, 로그인으로 리디렉트

**근본 원인 가설**: Expo Router 또는 React Navigation linking config에서 `/reset-password` 라우트가 빠짐. V112 → V114 사이 삭제됐거나 비활성화.

---

## V114-2a: 코치마크 박스 좌표 어긋남

**재현 경로**:
1. 앱 uninstall → reinstall
2. 최초 실행 → ConsentScreen → 약관 동의 → 회원가입 or 게스트 진입 (시나리오에 따라)
3. HomeScreen 첫 진입 → 웰컴 모달 → 닫기
4. 코치마크 "여기를 눌러 첫 여행을 시작하세요!" 표시
5. **Expected**: 박스(spotlight)가 [AI 여행 계획 만들기] 버튼을 정확히 감쌈
6. **Actual**: 박스가 버튼보다 약간 **위**에 위치, 버튼은 박스 밖에 있음

**검증 변수**:
- 기기 해상도 (Pixel 6 Pro vs Galaxy S22)
- 시스템 폰트 크기 (100% / 125% / 150%)
- status bar 높이 (notch 유무)
- **꼭 실기기로 재현**: 에뮬레이터에서는 안 재현될 수 있음

---

## V114-2b: [건너뛰기] 버튼 존재

**재현 경로**:
1. 코치마크 표시 상태 (위 V114-2a 재현)
2. 툴팁 하단에 "건너뛰기" 버튼 확인
3. **Expected**: 없어야 함
4. **Actual**: 존재함

---

## V114-3: 계정 삭제 팝업 공백 과다

**재현 경로**:
1. 로그인 → ProfileScreen → [계정 삭제] 탭
2. 하단 bottom sheet 팝업 표시
3. **Actual**: 팝업 중간에 흰 공백이 매우 큼
4. **Expected**: 컨텐츠에 맞게 자동 높이, 공백 최소

---

## V114-4a: 이용동의 [동의하고 시작하기] 버튼 하단 밀착

**재현 경로**:
1. 앱 uninstall → reinstall
2. 최초 ConsentScreen 진입
3. 약관 체크 후 스크롤 하단
4. **Actual**: [동의하고 시작하기] 버튼이 화면 최하단에 붙어 있음 (SafeArea 무시)
5. **Expected**: `insets.bottom + 24` 정도 여백 확보

---

## V114-4b: "개인정보 처리방침 (필수)" 텍스트 중복

**재현 경로**:
1. ConsentScreen 표시
2. 필수 동의 목록에서 "개인정보 처리방침" 항목 확인
3. **Actual**: "개인정보 처리방침 (필수)" + 옆에 "필수" 아이콘/배지
4. **Expected**: "개인정보 처리방침" + 아이콘 하나만

---

## V114-4c: 개인정보 처리방침 필수/선택 양쪽 존재

**재현 경로**:
1. ConsentScreen 전체 스크롤
2. 필수 동의 블록에서 "개인정보 처리방침" 확인
3. 선택 동의 블록까지 스크롤
4. **Actual**: 선택 동의 블록에도 "개인정보 처리방침" 항목 존재
5. **Expected**: 필수 블록에만 존재, 선택 블록에는 마케팅 정보 수신만

---

## V114-5: 수동 생성 진입 시 AI 남은 횟수 1/3 오표기

**재현 경로**:
1. 로그인 (free 계정, AI 1회 사용 → 2회 남음 상태)
2. HomeScreen → [AI 자동 생성] 선택 → `2/3 남음` 표기 확인
3. 뒤로가기 → HomeScreen → [수동 생성] 선택
4. **Actual**: 수동 생성 화면 상단에 `이번 달 AI 자동 생성 1/3회 남음` 표기
5. **Expected**: 실제 값 2/3 또는 수동 생성에는 카운터 표기 안 함

**파생 이슈**:
- 재현 안 되는 경우: 계정을 0/3 남음 상태로 만들고 반복
- 사용자 추측: "1/3"이 리터럴로 박혀 있음

---

## V114-6a: 관리자 구독 "다음 결제일 시간까지" 미표기

**재현 경로**:
1. `longpapa82@gmail.com` 로그인
2. ProfileScreen → [구독 관리] → SubscriptionScreen
3. **Actual**: 다음 결제일이 날짜만 표시 (예: "2026.05.14")
4. **Expected**: "2026.05.14 15:30" 같이 시간 포함

---

## V114-6b: 구독 회원 남은 횟수 "월 30회" 표기

**재현 경로**:
1. `hoonjae723@gmail.com` (premium monthly or yearly) 로그인
2. HomeScreen 상단 or CreateTripScreen 상단 배지 확인
3. **Actual**: "월 30회" 또는 "30회/월"
4. **Expected**: free와 동일한 포맷으로 "X/30회 남음"

---

## V114-7: 4/15 error_logs 전수 분석

**재현 경로**:
1. `longpapa82@gmail.com` 로그인
2. Admin → ErrorLogScreen → 날짜 필터 = 2026-04-15
3. 전체 로그 조회 후 빈도 상위 5건 확인

**분석 대상**:
- ThrottlerException (Rate limit) 반복
- "유효하지 않은 인증 토큰" 계열
- Auth/Trip 관련 5xx

---

## V114-8: 미인증 재가입 UX 혼란

**재현 경로**:
1. 앱에서 신규 가입 시도 → `test-new-user@gmail.com` + 비번
2. 가입 완료 팝업 → 이메일 인증 코드 화면 이동
3. **인증 코드 입력하지 않고 앱 종료**
4. 앱 재실행 → RegisterScreen → 동일 이메일로 가입 시도
5. **Expected**: "인증을 완료하지 못한 계정입니다. 인증을 이어가시겠어요? / 처음부터 다시 가입하시겠어요?" 선택지
6. **Actual V114**:
   - EMAIL_EXISTS 에러 또는
   - "이미 가입된 계정" 경고 후 로그인 화면으로 유도
   - 로그인 시도 시 EMAIL_NOT_VERIFIED 401 → 인증 화면으로 다시 돌아감
   - 사용자는 "회원가입이 완료된 건가?" 혼란

**관련**: V112에서 backend `refreshUnverifiedRegistration` 추가했지만 프론트가 이 응답을 "재가입 성공"이 아닌 "이미 존재" 에러로 처리 중일 가능성.

---

## V114-9: 무중단 배포 구조 부재

**재현 경로 (시나리오 시뮬레이션)**:
1. 현재 V114 앱 사용 중인 알파 테스터 10명
2. 백엔드에 breaking change (예: trip.create 응답 필드 추가) 배포
3. `docker compose up -d` → 기존 컨테이너 stop → 새 컨테이너 start (5~10초 다운)
4. **Expected**: 사용자 API 요청이 5~10초 사이에만 실패 (자동 재시도로 복구)
5. **Actual 위험**:
   - DB 마이그레이션이 오래 걸리면 5분+ 다운
   - 구버전 앱이 신규 필드 missing으로 500 에러 (호환성 깨짐)
   - Rollback 절차 문서화 안 됨

**검증 대상**:
- `docker compose up -d` 소요 시간 측정
- healthcheck 기반 depends_on 작동 확인
- 구버전 앱 (V113) 클라이언트를 V115 백엔드에 붙였을 때 smoke test

---

## 재현 결과 수집 형식

각 이슈마다 다음을 기록:

```yaml
issue_id: V114-XX
reproduced: yes|no|flaky
device: Pixel 6 Pro / Android 14
screenshot: image-XXX.png
notes: "추가 관찰사항"
```

이 데이터는 Phase 3 수정 전 baseline으로, Phase 5 auto-qa 후 regression 확인용으로 비교한다.
