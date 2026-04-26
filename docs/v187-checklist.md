# V187 검증 체크리스트 (Alpha 빌드 후 30분 이내)

**versionCode**: 187 (V186 → V187)
**범위**: P0 6건 (회귀 종결) + P1-A 자동 테스트 25개 + P1-C 보안 3건 + P1-B 콘텐츠 30건

이 체크리스트는 P0/P1 fix가 production에서 의도대로 동작하는지를 사용자가 30분 안에 확인하기 위한 것입니다. 자동화 가능한 항목은 이미 PR 단계에서 차단되며 (P1-A), 여기 남은 것은 실기기/실계정으로만 검증 가능한 항목입니다.

## 사전 준비 (5분)

- [ ] **신규 비admin 이메일 계정 생성** (`qa-fresh-{timestamp}@gmail.com`) — admin 가드 우회용 결제 검증
- [ ] **admin 계정** 준비 (`longpapa82@gmail.com`)
- [ ] **DB 직접 접근 SSH** + `psql` 환경 — ErrorLog/user_consents 즉시 조회용
- [ ] **Backend stdout 모니터링** (`docker compose logs -f backend`)
- [ ] V187 backfill migration 실행 확인:
  ```bash
  ssh root@46.62.201.127
  cd /root/travelPlanner/backend && npm run typeorm migration:run
  ```

---

## A. 결제(IAP) 검증 — 8항목

V186 #1 (admin block) + V184 invariant 32 server-side 회귀 종결 검증.

- [ ] **A1.** 신규 무료 계정으로 PaywallModal 진입 → 월간/연간 가격 정상 표기 (₩5,500 / ₩44,000)
- [ ] **A2.** 신규 무료 계정으로 월간 결제 시도 → Google Play sheet 표시 → 라이선스 테스터 dialog
- [ ] **A3.** 결제 완료 → 60초 이내 paywall dismissal + premium 표기 전환
- [ ] **A4.** **admin 계정** (longpapa82) → 프로필 → "구독" → **PaywallModal 정상 표기** (V184 단일 플래그 과부하 회귀 차단). "이미 구독 중" alert 표기 시 **회귀**
- [ ] **A5.** admin 계정으로 결제 시도 → Google Play 라이선스 테스터 가드로 실결제 안 됨 (server preflight는 ALLOW)
- [ ] **A6.** 결제 직후 → 강제 종료 → 재실행 → premium 유지 (V169 polling 검증)
- [ ] **A7.** 결제 직후 → logout → 재로그인 → premium **유지** (V184 #1 회귀 차단)
- [ ] **A8.** **결제 실패 시도** (네트워크 차단) → admin → error_logs 테이블 1건 이상 표기:
  ```sql
  SELECT created_at, screen, "errorMessage", severity FROM error_logs
  WHERE screen LIKE '%subscription%' AND created_at > NOW() - INTERVAL '5 min';
  ```
  V186에서 0건이었던 패턴이 **회귀 시 P0-A 갭**

---

## B. 동의 화면 — 4항목

V186 #2 backfill migration 검증.

- [ ] **B1.** longpapa82 (admin, 기존 회원)로 로그인 → ConsentScreen **표기 안 됨** (P0-E backfill 핵심 검증)
- [ ] **B2.** DB 검증:
  ```sql
  SELECT consent_type, consent_version, "isConsented", consent_method
  FROM user_consents WHERE "userId" = '<longpapa82-uuid>';
  ```
  `age_verification` 행이 `consent_method='inferred_from_terms'`로 존재해야 합니다
- [ ] **B3.** 신규 가입 사용자 → ConsentScreen 정상 표기 → 모든 필수 항목 동의 → 메인 진입
- [ ] **B4.** ConsentScreen 한국어/영어/일본어/Arabic(RTL) 전환 시 i18n + 레이아웃 정상

---

## C. 수동 여행 생성 — 4항목

V186 #3 (오류 로그 0건) 진단 인프라 검증.

- [ ] **C1.** 수동 여행 생성 정상 완료 → TripDetail 진입
- [ ] **C2.** 인원수 5.5 입력 → 5로 자동 floor (V180 invariant 22)
- [ ] **C3.** **수동 여행 생성 강제 실패** (네트워크 차단 또는 destination 빈값) → admin error_logs 1건 이상 표기:
  ```sql
  SELECT created_at, screen, "errorMessage", "httpStatus" FROM error_logs
  WHERE screen LIKE '%/trips%' AND created_at > NOW() - INTERVAL '5 min';
  ```
  V186에서 0건이었던 패턴이 **회귀 시 P0-A 갭** (또는 IGNORED_PATTERNS 추가됨)
- [ ] **C4.** AI 모드 정상 → manual만 차단되는 isolation 검증

---

## D. Logout / 회원탈퇴 — 6항목

V177/V181/V184/V186 logout race 4차 회귀 종결 + invariant 41 (account termination umbrella) 검증.

- [ ] **D1.** logout 1회 클릭 → **즉시** LoginScreen 진입 (V184 4차 회귀 차단)
- [ ] **D2.** logout → 즉시 홈버튼 → 다른 앱 5초 → 복귀 → LoginScreen 유지 (cross-context AppState race + 불변식 36)
- [ ] **D3.** **OAuth 회원탈퇴 1회 클릭** → confirm → 즉시 LoginScreen + "탈퇴 완료" toast (V186 #4 회귀 차단)
- [ ] **D4.** Email 회원탈퇴 → 비밀번호 입력 → 1회 클릭 → 즉시 탈퇴
- [ ] **D5.** 회원탈퇴 직후 backend DB 검증:
  ```sql
  SELECT id FROM users WHERE id = '<deleted-user-uuid>';  -- 0 row
  SELECT "userEmail", "deviceModel", breadcrumbs FROM error_logs WHERE "userId" = '<deleted-user-uuid>';
  -- userEmail/deviceModel/breadcrumbs 모두 NULL이어야 (P1-C #1 PII anonymization)
  ```
- [ ] **D6.** 같은 이메일로 재가입 시도 → 정상 가입 → ConsentScreen 정상 표기 → 신규 사용자 동작

---

## E. 앱 이탈 → 복귀 — 5항목

V184 A4 / V186 #5 흰 화면 회귀 종결 검증.

- [ ] **E1.** 여행 상세 화면 → 홈버튼 → 1분 → 복귀 → **TripDetail 그대로 유지** (V186 #5 차단)
- [ ] **E2.** TripDetail → 홈버튼 → **5분** → 복귀 → 흰 화면 없음 + 화면 유지
- [ ] **E3.** TripDetail → 홈버튼 → **30분** → 복귀 → 토큰 만료 시 LoginScreen으로 graceful 전환
- [ ] **E4.** **수동 여행 입력 중**(데이터 입력 상태) → 홈버튼 → 5분 → 복귀 → 입력 데이터 유지 (P0-F useFocusEffect)
- [ ] **E5.** AI 자동 생성 폴링 중 → 홈버튼 → 복귀 → 진행률 유지 또는 명시적 에러

---

## F. 회원가입 / Onboarding — 3항목

- [ ] **F1.** 회원가입 → 비밀번호 입력 → **비밀번호 확인 필드까지 1회 스크롤** (V184 #3 / 불변식 39)
- [ ] **F2.** 이메일 한글 자모 입력 시 경고 (V159)
- [ ] **F3.** 회원가입 → 영어/한국어/일본어 전환 시 검증 메시지 i18n

---

## G. 결제 인접 — 4항목

- [ ] **G1.** premium 사용자 → ProfileScreen → **광고 0건** (불변식 19)
- [ ] **G2.** premium 사용자 → AI 자동 생성 quota "30 / 월" 표기
- [ ] **G3.** **admin** 계정 → "∞ 무제한" 표기 (V176 / 불변식 19)
- [ ] **G4.** free 신규 계정 → "3/3" 표기 (V176 회귀 차단)

---

## H. 진단 인프라 heartbeat — 4항목 (P0-A 검증)

- [ ] **H1.** admin 대시보드 → error_logs → V187 빌드 후 1시간 이내 1건 이상 (0건이면 P0-A 갭 또는 진짜로 에러 0건)
- [ ] **H2.** 의도적 401 발사 (만료된 token으로 API 호출) → admin error_logs에 표기 (filter 통과 시)
- [ ] **H3.** Frontend AsyncStorage 큐: backend 502 상황에서 reportError → 큐 적재 → backend 복구 후 자동 drain (시뮬레이션 어려우면 skip)
- [ ] **H4.** Sentry 대시보드 → 마지막 1시간 breadcrumb 발생량 > 0

---

## I. 다국어 / 접근성 — 4항목

- [ ] **I1.** 17개 언어 중 ko/en/ja/zh-CN/ar(RTL) PaywallModal 레이아웃 정상
- [ ] **I2.** 데이터 내보내기 → JSON 다운로드 (V180 expo-file-system/legacy)
- [ ] **I3.** 라이선스 화면 → 인앱 표기 (V178 LicensesScreen)
- [ ] **I4.** 비밀번호 재설정 → 이메일 발송 → 재설정 완료

---

## J. 보안 / PII / 사실성 — 4항목 (P1-C / P1-B 검증)

- [ ] **J1.** error_logs 테이블에 url 쿼리스트링 노출 없음 (불변식 35)
- [ ] **J2.** Backend production env에서 DB_PASSWORD 미설정 시 startup throw (불변식 34, env 임시 제거 후 docker restart로 검증)
- [ ] **J3.** 17 locale 모든 `art12`/`art15` 국외 이전 표에 Sentry **독일** 표기 (P1-B C3)
- [ ] **J4.** contact.html / faq.html에 "모든 기능 무료" 표기 없음 (P1-B C1)
- [ ] **J5.** `npm run validate:static` PASS (261 파일 0 violations)

---

## V187 회귀 발생 시 즉시 대응

만약 위 항목 중 1건이라도 회귀 시:

1. **P0-A 회귀 (error_logs 0건)** — 가장 먼저 점검. 다른 모든 fix 검증의 전제.
2. **P0-C 회귀 (회원탈퇴 1차 logout만)** — `markAccountTerminating()` 호출 시점이 `await deleteAccount()` *이전*인지 ProfileScreen 코드 grep
3. **P0-B 회귀 (결제 차단)** — `subscription.service.ts` line 205~ `isOperationalAdmin` early-return 재유입 여부 grep

회귀 신호 발견 즉시 V188 hotfix 사이클 진입 + Jest integration test에 케이스 추가 (PR 단계 자동 차단).

---

## 자동화로 차단되는 회귀 (수동 검증 불필요)

다음은 PR 단계에서 자동 차단되므로 수동 점검 항목에서 제외했습니다:

- Backend Jest 398/398 (V187 신규 18 테스트 포함)
- Frontend Jest 226/226 (V187 신규 3 테스트 포함)
- TypeScript 0 errors (backend + frontend)
- `npm run validate:static` (261 파일 0 violations + V187 신규 4 패턴)

수동 체크리스트 항목 수: 42 (P1-D 목표 충족)
예상 소요 시간: 30분 (사전 준비 5분 + 핵심 검증 25분)
