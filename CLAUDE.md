# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태 (2026-04-26 KST) — V184 Phase 0 완료 (V183 RCA 근본 해결)

### 핵심 상태
- **버전**: V184 (다음 EAS Build versionCode 184, V183 회귀 8건 + 자동 검증 2건 신설)
- **서버**: https://mytravel-planner.com (Hetzner VPS) — V182 백엔드 배포 완료, V184는 frontend/static만 변경
- **브랜치**: `main` (V184 변경 unstaged, commit 대기)
- **Frontend**: TypeScript 0 errors, Jest **223/223** PASS (16/18 suites — 동일 baseline)
- **Backend**: TypeScript 0 errors, Backend src 0 변경 (V184는 frontend/HTML/i18n/scripts만)
- **자동 검증**: `npm run validate:static` (validate-legal + validate-content) PASS
- **Play Console**: V180 versionCode 181 Alpha 출시 완료, V182 Alpha 제출 후 V183 보고 → V184로 재제출 예정
- **Sentry**: DSN 설정 완료 (aisoft-p7.sentry.io)
- **V184 핵심**: V183 admin 결제 무반응 (V182 회귀) + 51 HTML/17 locale 저작권 허위 표기 + Paddle 잔존 + i18n art12 OpenWeather 누락 + 제휴 파트너 약관 잔존 + 사업자 정보 미게재 + iCal 미구현 표기 — **자동 검증 2건으로 차기 회귀 차단 (lead time 0)**

### V139~V176 Alpha 테스트 수정 이력

| 버전 | 날짜 | 주요 수정 |
|------|------|----------|
| V124 | 04-17 | admin quota, keyboard ANR, badge color, permission settings (5건) |
| V122 | 04-17 | ANR, consent, payment, photo permission (10건) |
| V120 | 04-17 | CreateTripScreen 크래시, 카카오 로그인, 동의 상세 모달 (12건) |
| V132 | 04-18 | onboarding bg, 회원 탈퇴, consent JIT, card clipping (4건) |
| V134 | 04-18 | 웹 허위정보 제거, 키보드 가림, JIT 권한, 법적 문서 갱신 (4건) |
| V136 | 04-18 | 탈퇴 모달 jitter 근본 해결, JIT 권한 완전 전환 (2건) |
| V148 | 04-20 | 알림 모달 정렬, "나중에" 상태 불일치, Provider 순서 변경 (3건) |
| V150 | 04-20 | isPrePermissionResolved 플래그, WelcomeModal 플래시 수정 (1건) |
| V152 | 04-21 | pendingPrePermission 경쟁 조건 수정, 인원수 미반영, 이메일 검증 (4건) |
| V155 | 04-22 | 구독 만료 미반영 (PremiumContext reconciliation) (1건) |
| V157 | 04-22 | Sentry 크래시 수집, 메모리 누수 5건, i18n 14건, 백엔드 성능 로깅 (4분야) |
| V159 | 04-23 | **Android KAV 크래시 근본 해결** (9개 파일), Animated cleanup 전수 (19개), 이메일 한글 감지 (3건) |
| V169 | 04-24 | 인원수 입력 근본 수정, NaN 서버 전달 차단, Sentry 에러 보고, source-tagged RC snapshot (4건) |
| V172 | 04-24 | RC SDK device cache, Play Billing plan switch, isOperationalAdmin 통일, webhook 폴링 (4건) |
| V174 | 04-25 | RC logOut 누락 + admin quota 분기 추가 + CreateTrip useFocusEffect 전환 + ErrorLog 컬럼 5개 확장 (5건) |
| V176 | 04-25 | **PremiumContext 하드코딩 ADMIN_EMAILS 제거**, 라이선스 인앱 표시, **ErrorLog DTO 완화 (4/25 0건 데이터 손실 해결)**, 5.5 소수 가드 (4건) |
| V178 | 04-25 | **double-logout race**(handleLogout await + isLoggingOutRef + RC 5s timeout), **데이터 내보내기 V178**(expo-file-system 정식 dep + @Res 제거), **네이티브 LicensesScreen**(외부 의존성 0), **silentRefresh 60s throttle**(429 → setUser(null) 차단) (4건) |
| V180 | 04-25 | **RC isInitialized 리셋 + PremiumContext userId 추적**(탈퇴-재가입 phantom 구독 차단), **expo-file-system/legacy 전환**(modular API breaking change 우회), **법적 P0 5건**(11개 언어 art3/국외이전 + 90일 purge cron + 사업자정보 + CCPA), **ErrorLog 자동 컨텍스트 + 5.5 가드 강화** (10건) |
| V182 | 04-25 | **PaywallModal server-tier 가드**(V173/V179/V181 phantom 구독 3회 회귀 근본 해결), **ConfirmDialog 큐 기반 + handleLogout 가드 선행**(V177/V181 double-logout race 근본 해결), **admin 페이월 차단**(showPaywall에서 isAdmin 즉시 return), **법적 일관성**(11개 locale OpenWeather + fr/ru art5 + 17개 사업자 placeholder 명확화 + effectiveDate 통일), **`scripts/validate-legal.py` 자동 검증** (10건) |
| V184 | 04-26 | **admin 페이월 가드 제거**(V183 결제 무반응 회귀 — V182 isAdmin return의 부작용으로 결제 회귀 검증 자체 불능 → server-tier gate에 위임), **저작권 51 HTML+17 locale 일괄 수정**(© 2024-2026 → © 2026, AI Soft 2026 설립 사실 반영), **Paddle 잔존 6곳 완전 제거**(2026-04-21 제공 중단 결정 후 미반영), **17 locale art12 OpenWeather 추가**(art3에는 있으나 국외이전 표 누락 — GDPR Art. 44/PIPA §28), **제휴 파트너 약관·i18n 5 locale 일괄 제거**(미운영 기능 약속 — 정통망법 §22의2), **iCal 미구현 표기 제거**(about/landing → JSON 데이터 내보내기), **사업자 정보 4개 HTML 추가**(PIPA §39의6), **effectiveDate 2024-01-01 → 2026-04-26 통일**, **`scripts/validate-content.py` 신설**(56 HTML 정적 콘텐츠 자동 검증 — 도입 즉시 25건 잠복 회귀 발견·수정), **validate-legal.py 보강**(P0-E art12 OpenWeather + P0-F no-affiliate + P0-G no-Paddle + P1-B 저작권 연도 sanity), **`npm run validate:static`** 통합 (11건 + 자동 검증 2건) |

### V184 핵심 수정 (2026-04-26) — V183 RCA + 정적 콘텐츠 자동 검증

**V183 회귀가 의미하는 것**: V182의 phantom 구독 fix(`if(isAdmin) return`)가 admin 결제 진입을 silent block → 결제 회귀 검증 lead time 무한대. 또한 5회의 fix-and-regress(V174→V178→V180→V182→V184)가 모두 코드 가드만 추가했지 **정적 콘텐츠(HTML, i18n footer)는 검증 영역 밖**. V184는 두 패턴을 동시에 끊는다 — 단일 플래그 과부하 해체 + 정적 콘텐츠 자동 검증 도입.

| ID | 근본 원인 | 수정 |
|---|---|---|
| **Admin 결제 버튼 무반응 (V182 직접 회귀)** | V182에서 `PremiumContext.showPaywall`에 `if(isAdmin) return;` 추가 → admin인 longpapa82/hoonjae723이 ProfileScreen 결제 버튼 클릭 시 silent return. 사용자 핵심 우려: "결제 테스트 자체를 할 수가 없음". 단일 `isAdmin` 플래그가 quota 면제 + 광고 차단 + 페이월 차단 3가지 권한을 동시 게이팅 (단일 플래그 과부하) | `PremiumContext.tsx:357` `if(isAdmin) return;` 삭제 + useCallback deps에서 `isAdmin` 제거 (admin 판정 race condition도 동시 해결). phantom 구독 차단은 **`PaywallModal.tsx:147` server-tier authoritative gate가 단독 책임** — server `subscriptionTier === 'free'`면 RC SDK 무엇이든 buy 진행. 실결제 차단은 **Play Console 라이선스 테스터 등록**이 최종 가드 |
| **저작권 "© 2024-2026 AI Soft" 허위 표기** | AI Soft는 2026년 설립인데 51 HTML + 17 locale legal.json `licenses.footer`에 2024년부터 운영한 것처럼 표기. 자동 검증 외 수작업 의존 → 1회성 fix(V134 웹 허위정보 제거) 후 재발 | `© 2024-2026 MyTravel/AI Soft` → `© 2026 AI Soft` (52 HTML + 17 locale 일괄 sed). 동시에 `scripts/validate-content.py`에 `single-year < 2026` 패턴 가드 추가로 차기 회귀 차단 |
| **Paddle 잔존 6곳 (privacy/terms HTML + licenses 패키지)** | 2026-04-21 Paddle 제공 중단 결정 후 i18n legal.json은 갱신됐으나 웹 HTML 4개 + licenses.html `@paddle/paddle-js` 행 미동기화. 약관에 미존재 결제수단 표기 = 전자상거래법 §13 위반 | terms/terms-en은 "Google Play IAP 단일화 + iOS 출시 시 추가" 문구로 통일. privacy 표 4개 행 제거 + OpenWeather 행으로 대체. licenses.html `@paddle/paddle-js` 패키지 행 제거. validate-legal.py P0-G로 차기 추가 차단 |
| **17 locale art12/art15 국외이전 표 OpenWeather 누락** | art3(제3자 제공 목록)에는 17 locale 모두 OpenWeather 있으나 art12/art15(국외 이전 표)에는 0건. GDPR Art. 44 / PIPA §28 위반. validate-legal.py 검증 범위 갭 | Python 일괄 스크립트로 17 locale 자국어 OpenWeather 행을 art12 또는 art15(국외이전 테이블이 위치한 곳, Sentry 행 다음)에 정확히 삽입. validate-legal.py P0-E 신설로 차기 회귀 차단 |
| **제휴 파트너 약관·i18n 잔존** | 수익 대시보드에서 affiliate 영역 제거(2026-03-12 `cbb5e59`)됐으나 약관 13조 + 8조 + i18n 5 locale art3에 "Booking.com, Klook, GetYourGuide, Agoda, Trip.com, Amazon 제휴 마케팅 참여" 표기 잔존. 미운영 기능 약속 = 정통망법 §22의2 위반 | terms.html 13조 박스 + 8조 광고 조항 + 5 locale art3 행 일괄 제거. validate-legal.py P0-F + validate-content.py affiliate 패턴 가드로 차기 회귀 차단 |
| **사업자 정보 웹 HTML 4개 누락** | i18n legal.json은 V180에서 추가됐으나 privacy/privacy-en/terms/terms-en HTML에 사업자 정보 부재. PIPA §39의6, 전기통신사업법 §39 위반 | 4개 HTML 모두에 "AI Soft + 박훈재 + longpapa82@gmail.com + 사업자번호 placeholder" 블록 추가 |
| **iCal/Apple 캘린더 미구현 표기** | about.html, landing.html, landing-en.html에 "iCal로 내보내기 / Apple 캘린더에 추가" 표기. 코드에 ical 구현 0건 (JSON 내보내기만 존재) | "JSON 데이터 내보내기"로 변경. validate-content.py 패턴 가드로 차기 회귀 차단 |
| **JSON-LD datePublished 25개 잠복 회귀** | 사용자 미보고 — guides/ 26개 가이드 HTML 중 25개가 `"datePublished": "2025-..."` (AI Soft 설립 전 연도). validate-content.py 도입 즉시 발견 | 일괄 sed `2025-` → `2026-`. **validate-content.py가 도입 1회로 25건 잠복 회귀 발견** — 진짜 가치는 여기 |
| **effectiveDate 2024-01-01 (4 HTML)** | i18n은 2026-04-26으로 V182에서 통일됐으나 웹 4개 HTML 부칙은 미동기화 | 일괄 sed로 통일 |

### V184 핵심 불변식 (V137 12 + V159 3 + V174 3 + V176 4 + V180 5 + V182 4 + V184 2 = 33건)

32. **단일 플래그 과부하 금지**: `isAdmin` 같은 권한 플래그가 (a) quota 면제 (b) 광고 차단 (c) 결제 진입 차단 등 3가지 이상 axis를 동시 게이팅하지 않는다. 결제 진입 차단은 `subscriptionTier === 'premium'` server-tier gate에 단독 위임. 보호와 검증을 동시에 만족시키려면 **각 axis마다 별도 가드**를 두고, "결제 회귀 검증" 같은 운영 요구는 별도 경로(라이선스 테스터, dev 메뉴)로 보장한다.
33. **정적 콘텐츠 사실 검증 자동화**: 저작권 연도, 회사 정보, 외부 처리자, 미구현 기능 약속, JSON-LD datePublished 등 정적 HTML/i18n 콘텐츠는 `npm run validate:static` (validate-legal.py + validate-content.py)로 매 PR마다 검증. 1회성 수작업 fix는 회귀 카테고리(V134→V183)이므로 금지. 신규 외부 처리자 추가, 운영 변경(처리자 중단/affiliate 토글), 사업자 정보 갱신은 동반 자동 검증 패턴 추가가 필수.

### V159 핵심 수정

| ID | 근본 원인 | 수정 |
|---|---|---|
| **Android 키보드 OOM 크래시** | `edgeToEdgeEnabled: true` + `KAV behavior="height"` 조합이 매 키보드 이벤트마다 WindowInsets 재계산 폭풍 → 네이티브 메모리 누적 | Android에서 KAV behavior를 `undefined`로 변경 + `enabled={Platform.OS === 'ios'}` (9개 파일) |
| **Animated 메모리 누적** | 19개 컴포넌트에서 unmount 시 `stopAnimation()` 미호출 → 네이티브 애니메이션 노드 누적 | 전수 cleanup 적용 |
| **WelcomeModal 0.1초 플래시** | NotificationContext의 `pendingPrePermission`/`isPrePermissionResolved` 비동기 경쟁 조건 | async 완료 후에만 state 변경 + WelcomeModal 200ms debounce |
| **구독 만료 미반영** | RevenueCat SDK stale cache가 `localPremiumOverride`를 유지 → 서버의 `free` 상태 무시 | PremiumContext에 서버 상태 reconciliation effect 추가 |
| **하드코딩 영어 메시지** | `error.message`가 i18n `t()` 보다 우선 (14건) | 에러 코드 패턴으로 전환 + AUTH_ERROR_I18N 매핑 |
| **이메일 한글 자모** | 한글 IME 활성 상태에서 영문 타이핑 | `inputMode="email"` + 한글 자모 실시간 감지 경고 + 서버 email 반환 |

### V174 핵심 수정 (2026-04-25)

| ID | 근본 원인 | 수정 |
|---|---|---|
| **RC logOut 누락 → 환불/탈퇴 후 phantom 구독** | AuthContext.logout()이 RevenueCat `Purchases.logOut()`을 호출하지 않아 device-level anonymous appUserID가 다음 로그인까지 유지 | AuthContext.logout()에 dynamic require로 `rcLogOut()` 추가 (web 안전) |
| **admin이 3/3 표시 + 무제한 생성** | 백엔드는 admin quota skip이지만 프론트는 free 3/3 표시 → UI/server 불일치 | PremiumContext에 `AI_TRIPS_ADMIN_LIMIT=9999` sentinel 추가, isAdmin 분기로 limit/remaining/isAiLimitReached 모두 9999 |
| **ADMIN_EMAILS 분산** | 프론트(env)와 백엔드(env+role) 판정 로직 다름 | `/auth/me`에 `isAdmin` 플래그 반환 (`isOperationalAdmin(email, role)`), 프론트는 server flag 우선 |
| **CreateTrip 진입 초기화 누락** | `navigation.addListener('focus')`가 tab-nested Native Stack에서 firstFocus 이후 fire 안 함 | `useFocusEffect` + `resetForm()` 콜백으로 전환, `setTravelersCount`가 numberOfTravelers + travelerInputText 동시 업데이트 (single source of truth) |
| **ErrorLog 정보 부족** | userId/platform/route/httpStatus 누락으로 RCA 불가 | error_logs 컬럼 5개 추가 (errorName, routeName, breadcrumbs jsonb, httpStatus, deviceModel), filter에서 req.user/ua-detect/status 추출 |

### V182 핵심 수정 (2026-04-25 23:15) — V181 RCA: 회귀 우회 경로 근본 차단

**V181 회귀가 의미하는 것**: V174→V178→V180 3회의 fix 모두 PremiumContext + AuthContext의 한 경로만 보호. PaywallModal과 ConfirmDialogContext의 **우회 경로**를 발견 못해 같은 증상이 재발. V182는 우회 경로 자체를 제거.

| ID | 근본 원인 | 수정 |
|---|---|---|
| **Phantom 구독 (V173/V179/V181 3회 회귀)** | `PaywallModal.resolvePurchaseAction`이 PremiumContext 가드(prevUserIdRef, mount-restore server-premium gate, RC isInitialized) 모두 우회하고 `getCustomerInfo()` 직접 호출 → server가 free라고 정확히 보고해도 RC SDK device cache 또는 RC backend alias chain이 stale entitlement 반환 → "이미 연간 구독 중" alert | PaywallModal에 server-tier authoritative gate: `if (user?.subscriptionTier !== 'premium') return { kind: 'buy' };` — RC SDK를 신뢰하지 않고 server를 신뢰. Google Play 자체가 double-billing 최종 가드 |
| **Double-logout race (V177/V181 2회 회귀)** | (a) handleLogout이 `isLoggingOutRef`를 `await confirm()` 후에 set → dialog 윈도우 무방비. (b) ConfirmDialogContext의 단일 `resolveRef` 슬롯이 두 번째 호출 시 첫 호출 resolver를 덮어씀 → 첫 promise 영원히 pending → "버튼이 안 먹는다"고 인식 | (a) handleLogout에서 `isLoggingOutRef.current = true`를 `await confirm()` 전으로 이동, (b) ConfirmDialogContext를 큐 기반으로 리팩토링 (동시 호출 순서대로 처리, 애니메이션 충돌 방지 setTimeout(0) drain) |
| **admin 페이월 노출 (V179/V181 phantom 혼란 원인)** | admin은 무제한 + 광고 비노출인데 페이월 진입 가능 → RC SDK stale entitlement 반환 시 "이미 구독 중" alert로 사용자 혼란 | PremiumContext.showPaywall: `if (isAdmin) return;` — admin은 페이월 자체 차단 |
| **법적 P0/P1 일관성** | 11개 locale art3에 OpenWeather 누락, fr/ru art5에 90일 조항 누락, 사업자번호 17개 locale 모호 placeholder, effectiveDate locale별 상이 | OpenWeather 11개 추가, fr/ru 90일 추가, 사업자번호 placeholder를 "발급 진행 중" 명확화, 17개 effectiveDate `2026-04-26` 통일 |
| **자동 검증 누락** | 17개 locale 일관성 사후 발견에 의존 → V180에서 OpenWeather 등 누락 미감지 | `scripts/validate-legal.py` 신규: P0 4건(사업자정보/art3 5처리자/ccpa 5조항/art12 국외이전) + P1 2건(art5 90일/effectiveDate 연도 일치) 자동 검증, 종료 코드로 CI 통합 가능. V182 시점 결과 PASS |

### V180 핵심 수정 (2026-04-25) — V179 RCA + 법적 P0 5건

| ID | 근본 원인 | 수정 |
|---|---|---|
| **Phantom 구독 (탈퇴-재가입)** | `revenueCat.ts:18` 모듈 레벨 `isInitialized` 플래그가 logout 시 리셋 안 됨 → register 후 `initRevenueCat`이 early-return → SDK가 옛 user 컨텍스트로 잠긴 상태에서 `Purchases.logIn(newUserId)` 호출 → device-level entitlement가 새 userId에 alias | revenueCat.ts에 `configuredUserId` 추적, logOut 시 reset, init이 새 userId 받으면 자동 `Purchases.logIn`. PremiumContext에 `prevUserIdRef`로 user.id 변경 시 RC snapshot 무효화 + mount-restore source는 server premium 시에만 신뢰 |
| **데이터 내보내기 FILE_SYSTEM_UNAVAILABLE** | `expo-file-system v19` modular rewrite로 `documentDirectory`가 main entry에서 제거됨 → V178 가드 즉시 throw | `import('expo-file-system/legacy')`로 1줄 전환 |
| **ErrorLog V174 컬럼 채움률 7%** | reportError 호출자들이 deviceModel/breadcrumbs 누락 | api.ts reportError에 자동 컨텍스트 첨부 (Device.modelName 동적 require, deviceOS, appVersion) |
| **인원수 5.5 NaN 가드 우회** | DB error_logs 7건 `invalid input syntax for type integer: "5.5"` 발생 — V169 NaN 가드가 소수 차단 못함 | CreateTripScreen `setTravelersCount`에 `Math.floor + clamp(1, 20)` |
| **법적 P0-A**: 11개 언어 art3 Sentry/RC 누락 | GDPR Art. 13(1)(e), PIPA 제17조 위반 | ar/de/es/fr/hi/id/ja/pt/th/vi/zh art3에 Sentry/RevenueCat 행 추가 |
| **법적 P0-B**: 11개 언어 국외 이전 누락 | GDPR Art. 44, PIPA 제28조 위반 | 11개 locale에 art15 (or 다음 인덱스) "국외 데이터 이전" 신규 추가 (OpenAI/Google/RC/Sentry 미국 명시) |
| **법적 P0-C**: error_logs 무기한 잔류 | V174로 userEmail/deviceModel/breadcrumbs 추가됐으나 purge 스케줄러 없음 → PIPA 제21조, GDPR Art. 5(1)(e) 위반 | admin.service.ts cleanupOldErrorLogs Cron (매일 04:30, 90일 보관) + 17개 언어 art5에 정책 명시 |
| **법적 P0-D**: 사업자 정보 미게재 | PIPA 제39조의6, 전기통신사업법 제39조 위반 | 17개 언어 terms에 "서비스 제공자" article 추가 (AI Soft, longpapa82@gmail.com, 사업자번호 placeholder) |
| **법적 P0-E**: 앱 내 CCPA 섹션 없음 | California 사용자 권리 행사 경로 부재 | 17개 언어 privacy.ccpa 섹션 신규 추가 (§ 1798.100~.125) |

### V178 핵심 수정 (2026-04-25) — V177 RCA

| ID | 근본 원인 | 수정 |
|---|---|---|
| **간헐적 double-logout (V174 회귀)** | ProfileScreen.handleLogout이 logout()을 await 하지 않아 V174의 `Purchases.logOut()` (200~800ms) 진행 중에 confirm 닫히고 사용자 두 번째 클릭 | handleLogout에 await + isLoggingOutRef in-flight guard, AuthContext.logout RC sign-out에 Promise.race(rcLogOut, 5s timeout) |
| **데이터 내보내기 실패** | (a) expo-file-system이 package.json 직접 dep 미등록 (b) 백엔드 @Res() + res.send 직렬화 → axios가 raw string 받아 이중 직렬화 | `npx expo install expo-file-system` 정식 dep + 백엔드 @Res() 제거 plain return + null 가드 + Sentry 보고 |
| **라이선스 외부 브라우저 (V176 회귀)** | 테스터 기기 V176/V177 빌드 미수령 + WebBrowser Custom Tabs를 외부 브라우저로 인식 | 새 LicensesScreen 네이티브 화면 (Privacy/Terms 패턴 재사용) + 17개 언어 i18n + versionCode 표시 |
| **홈 → foreground 시 메뉴 잃음** | foreground마다 silentRefresh 폭발 → 4/25 ThrottlerException 429 발생 → 매 setUser(profile) 새 reference로 cascade | silentRefresh 60s throttle + setUser prev 비교로 reference 안정화 + 429 explicit handling |

### V176 핵심 수정 (2026-04-25) — V175 RCA

| ID | 근본 원인 | 수정 |
|---|---|---|
| **모든 사용자 9999/9999 표시 (관측 편향)** | PremiumContext의 하드코딩 ADMIN_EMAILS fallback이 두 Alpha 테스트 계정(hoonjae723, longpapa82)을 모두 admin으로 분류 → 진짜 무료/프리미엄 quota 검증 불가 | 하드코딩 ADMIN_EMAILS 제거, **server isAdmin only**, "9999/9999" 대신 "∞ 무제한" i18n (17개 언어) |
| **오픈소스 라이선스 외부 브라우저 이탈** | `Linking.openURL()`이 외부 Chrome/Safari 호출 (Privacy/Terms는 인앱 navigation) | `expo-web-browser`의 `WebBrowser.openBrowserAsync()` (Custom Tabs/SFSafariViewController, dynamic require로 web 안전) |
| **4/25 ErrorLog 0건 + V174 신규 컬럼 3일간 100% NULL** | DTO `ValidateNested + Type(ErrorLogBreadcrumbDto) + global forbidNonWhitelisted: true`가 breadcrumb의 unknown 키(Sentry event_id 등)에 요청 전체 400 reject. 클라이언트 `.catch(() => {})`로 사일런트 누락 | DTO에서 ValidateNested 제거, `IsObject({each:true}) + ArrayMaxSize(50)`. 클라이언트 reportError 400 응답 시 minimal payload retry. 서버 persist 실패 warn → error 승격 (origin route 포함) |
| **5.5 소수 인원수 → DB INSERT 실패** | `@IsInt()`를 우회한 5.5가 `invalid input syntax for type integer` 발생 | trips.service.ts에서 `Math.floor + clamp(1, 20)` 가드 (Phase A insert + AI generation 모두) |

### V182 핵심 불변식 (V137 12 + V159 3 + V174 3 + V176 4 + V180 5 + V182 4 = 31건)

28. **Server tier authoritative for paywall**: PaywallModal 등 결제 진입점에서 RC SDK를 신뢰하지 말고 `user.subscriptionTier === 'premium'` 일 때만 RC duplicate guard 적용. RC device cache + backend alias chain은 user identity 변경 시 stale entitlement 반환 가능. server tier가 free면 RC가 무엇이든 `buy` 진행. Google Play가 double-billing 최종 가드.
29. **Confirm dialog는 큐 기반**: ConfirmDialogContext는 단일 resolveRef 슬롯 사용 금지. 다중 호출 시 두 번째 호출이 첫 호출 resolver 덮어쓰면 첫 promise 영원히 pending → race window 발생. queue + sequential drain 패턴 필수.
30. **In-flight guard는 await 전 set**: 비동기 dialog/network 호출이 있는 핸들러에서 `isXxxRef.current = true`는 반드시 `await` *전*에 set. await 후에 set하면 그 사이 진입한 두 번째 호출이 race window를 통과.
31. **법적 문서 자동 검증 CI**: 17개 locale legal.json은 `scripts/validate-legal.py`로 P0(사업자정보, 5개 처리자, ccpa, 국외이전) + P1(90일, effectiveDate) 자동 검증. 신규 외부 처리자 추가 또는 effectiveDate 갱신 후 반드시 실행. 향후 CI 통합 가능.

23. **RC SDK userId 추적 원칙**: revenueCat.ts에 `configuredUserId` 모듈 변수 유지. `logOut()`에서 reset + `initRevenueCat(userId)`이 새 userId 받으면 `Purchases.logIn` 자동 호출. 단순 `isInitialized` boolean으로는 user 변경을 감지하지 못해 phantom 구독 alias 발생.
24. **mount-restore는 server premium gate**: PremiumContext에서 `mount-restore` source는 `user.subscriptionTier === 'premium'`일 때만 신뢰. 서버 free 사용자에게 RC stale entitlement가 phantom premium을 부여하는 경로 차단.
25. **expo-file-system은 legacy 경로**: SDK 54+ modular rewrite가 main entry에서 `documentDirectory` 등 제거. `import('expo-file-system/legacy')` 사용. 새 `File`/`Paths` API로 마이그레이션은 별도 작업.
26. **PII 포함 진단 데이터는 보관 기한 명시 + 자동 purge**: error_logs/audit_logs 등 userEmail/deviceModel 포함 테이블은 반드시 Cron purge 스케줄러 필수 (현재 90/30일). 처리방침 art5에 보관 기간 명시 의무.
27. **17개 언어 법적 문서 일관성 검증**: 새 외부 처리자 추가 시 17개 locale legal.json art3(제3자 제공) + 국외이전 article 모두 동시 갱신. python3 grep으로 누락 검증 자동화.

13. **Android KAV 금지 원칙**: Android에서 `KeyboardAvoidingView behavior="height"`를 사용하지 않음. `edgeToEdgeEnabled: true` 환경에서 레이아웃 재계산 폭풍으로 OOM 크래시 발생. iOS에서만 `behavior="padding"` 사용, Android는 `enabled={Platform.OS === 'ios'}`로 비활성화.
14. **Animated cleanup 원칙**: `Animated.Value`를 사용하는 모든 컴포넌트는 unmount 시 `stopAnimation()`을 호출하는 cleanup useEffect 필수.
15. **에러 메시지 i18n 원칙**: 사용자에게 표시되는 에러 메시지는 `throw new Error('ERROR_CODE')` 패턴 + 핸들러에서 에러 코드→i18n 키 매핑. `error.message` 직접 노출 금지.
16. **로그아웃 시 RC logOut 동반**: AuthContext.logout()은 반드시 `Purchases.logOut()`을 dynamic require로 호출. 누락 시 device-level anonymous appUserID가 유지되어 다음 로그인 계정에 phantom 구독 표시.
17. **useFocusEffect for screen reset (tab-nested Native Stack)**: 화면 진입 시 폼 초기화는 `navigation.addListener('focus')`가 아니라 `useFocusEffect(useCallback(...))` 사용. tab-nested Native Stack에서 first focus 이후 fire 안 됨.
18. **Single source of truth for paired state**: 관련 상태 쌍(예: numberOfTravelers + travelerInputText)은 단일 setter를 통해서만 업데이트. setNumberOfTravelers(N) 호출 시 setTravelerInputText(N.toString())을 강제로 동반.
19. **server isAdmin only (V176)**: 프론트엔드에 ADMIN_EMAILS fallback 리스트 보유 금지. `/auth/me`의 server `isAdmin` 플래그만 신뢰. 하드코딩 fallback은 QA 테스터 풀 편향(테스트 계정이 admin 리스트에 있으면 비admin 동작 검증 불가)을 유발.
20. **Diagnostic data DTO는 permissive**: error_logs 등 진단 페이로드는 `forbidNonWhitelisted: true` 글로벌 ValidationPipe 환경에서 nested DTO 사용 금지. `IsObject({each:true}) + ArrayMaxSize(N)` 패턴으로 후퇴. 진단 데이터는 shape 검증보다 size cap이 적절.
21. **Fire-and-forget 호출은 visibility 보장**: `apiService.X().catch(() => {})` 패턴은 silent failure 위험. 4xx 응답 시 minimal payload retry 또는 metric 노출 필수.
22. **Server-side defensive coercion for numeric DB columns**: 클라이언트 검증을 신뢰하지 말고 INSERT 직전에 `Math.floor + clamp(min, max)` 적용. DTO `@IsInt()`를 우회하는 경로(직접 transform, AI 응답 등)가 존재할 수 있음.

### ⏭️ 프로덕션 출시 계획

**Phase 0 — Alpha 최종 검증 (현재)**
- V176 Alpha 빌드 진행 중 (versionCode 177)
- Critical Path: 로그인 → 여행 생성 → 일정 확인 → 구독 → 광고 제거
- V176 검증 시나리오:
  1. **비admin 무료 계정 신규 발급** → AI 횟수 3/3 정상 표시 확인 (V176 단일 진실 검증)
  2. admin 계정 → "∞ 무제한" 표시 (9999/9999 아님)
  3. 라이선스 버튼 → 인앱 Custom Tabs 표시 (외부 브라우저 X)
  4. 4/25 이후 ErrorLog → V174 신규 컬럼(errorName, routeName, breadcrumbs, httpStatus, deviceModel) NOT NULL 채워지는지 확인
  5. 인원수 5.5 같은 비정상 값 입력 시도 → 5로 floor 처리

**Phase 1 — 프로덕션 트랙 제출**
- Alpha 테스트 통과 후 프로덕션 트랙에 AAB 제출
- 단계적 출시 1% 선택
- Google 심사 대기 (1-7일)

**Phase 2 — 단계적 확대 (D+3~D+14)**
- 1% → 5% → 20% → 50% → 100%
- 롤백 기준: ANR >2%, 크래시율 >1%, Sentry P0 발생

### ⏭️ 프로덕션 출시 후 후속 작업

1. **회원 탈퇴 모달 하단 여백**: UX 개선 (기능 정상)
2. **무중단 배포 체계**: nginx blue-green 또는 rolling update 구축
3. **스테이징 환경**: 프로덕션과 동일한 테스트 환경 구축
4. **npm audit HIGH 7건**: mjml 체인 (LiquidJS, lodash), path-to-regexp, picomatch
5. **CSP unsafe-inline**: nonce 기반 전환 (AdSense/GTM 연동 고려)
6. **register() 이메일 열거**: 응답 통일 또는 CAPTCHA 도입
7. **sitemap.xml 영문 가이드 추가**: SEO 개선
8. **console.log 정리**: 프로덕션 코드 ~210건 → `__DEV__` 가드 또는 제거

### 상세 로그
- V115 이전 이력: `docs/archive/claude-md-history-pre-v112.md`
- V114 14 이슈: `docs/archive/v114/00-inventory.md`
- V139~V177 테스트 결과: `testResult.md`

---

## 🔗 빠른 참조

- [OAuth/API 설정](#google-cloud-console-oauth-20-credentials)
- [Play Console 상태](#google-play-console-상태)
- [프로덕션 서버](#프로덕션-서버-인프라-hetzner-vps)
- [배포 절차](#배포-절차-수동)
- [버그 수정 이력 요약](#-버그-수정-이력-요약)

**아카이브**:
- `docs/archive/claude-md-history-pre-v112.md` — V111 및 이전 버전 이력
- `docs/archive/release-notes-history.md` — V33~V114 통합 릴리스 노트
- `docs/archive/bug-history-2026-04.md` — V49~V112 버그 RCA 인덱스
- `docs/archive/deployment-logs/` — Railway 시절 배포 로그 (2026-03)

---

## Google Cloud Console OAuth 2.0 Credentials

| 이름 | 유형 | 클라이언트 ID | 비고 |
|------|------|-------------|------|
| TravelPlanner | 웹 | `48805541090-n13jg...` | 백엔드/프론트 webClientId |
| TravelPlanner Android | Android | `48805541090-4gqgm...` | 업로드 키 SHA-1 |
| TravelPlanner Android (Play Signing) | Android | `48805541090-826gn...` | 앱 서명 키 SHA-1 |

- **webClientId**: `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`
- **Play Store 앱 서명 키 SHA-256**: `E7:06:3F:BE:01:C4:47:BF:7C:50:01:79:48:49:7F:72:AB:51:76:B0:27:85:DB:84:C9:01:CE:7A:91:E8:70:7A`
- **패키지명**: `com.longpapa82.travelplanner`
- **assetlinks.json**: 등록 완료 (App Links 검증 정상)

## Google Play Console 상태

- **트랙**: 비공개 테스트 (Alpha) 진행 중, versionCode 159
- **앱 ID**: 4975949156119360543
- **결제 프로필**: 카카오뱅크 계좌 확인 완료 (2026-03-11)
- **앱 콘텐츠 선언**: 10개 전부 완료
- **스토어 등록정보**: ko/en/ja 3개 언어
- **IAP 가격**: monthly $3.99 (KRW 5,500), yearly $29.99 (KRW 44,000)
- **IAP 테스트 구매**: 성공
- **15% 수수료 프로그램**: $1M 이하 자동 적용
- **카테고리**: 여행 및 지역정보
- **EAS 플랜**: Starter

## Google Cloud Service Account (RevenueCat)

- **서비스 계정**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
- **IAM 역할**: Pub/Sub Admin
- **Play Console 권한**: 앱 정보/재무/주문·구독 관리
- **Active 키**:
  - `f9090d10...` — EAS용
  - `bb41acd291a2...` — RevenueCat용 (V112 재발급, 노출 키 영구 삭제 완료)
- **RTDN**: Pub/Sub `projects/tripplanner-486511/topics/play-billing`
- **패키지명**: `com.longpapa82.travelplanner`
- **webhook 상태**: 정상 (V112 재발급 후 `INITIAL_PURCHASE/EXPIRATION/CANCELLATION` 200 응답 확인)

## Google Places API

- **API 키**: `backend/.env`의 `GOOGLE_PLACES_API_KEY`
- **활성화 API**: Places API (Legacy) + Place Details API
- **장소 검색 체인**: Mapbox (무료 100K/월) → Google Autocomplete + Place Details (세션 기반 fallback)
- **용도**: Mapbox 한국어 미지원 시 Google로 좌표 조회 (versionCode 88에서 근본 해결)
- **엔드포인트**: `/api/places/autocomplete` (인증 필요)
- **비용**: 세션당 $0.017, Mapbox 성공 시 $0

## 비용 분석 (여행 자동 생성 10,000건 기준, Phase 1 최적화 후)

| API | 캐시 적중률 | 호출 | 비용 |
|-----|-----------|------|------|
| OpenAI GPT-4o-mini (Prompt Caching 적용) | ~60% | 4,000 | ~$110 |
| Google Geocoding | ~70% (Redis) | 3,000 | $15 |
| OpenWeather (6h TTL) | ~80% | 2,000 | $0 |
| LocationIQ | ~50% | 25,000 | $0 (5K/일 무료) |
| Google Place Details | 세션 포함 | — | $0 |
| **합계** | | | **~$125** (건당 ~17원) |

Phase 1 최적화: OpenAI Prompt Caching, 템플릿 워밍업 확대(50목적지×5기간×3언어), vector threshold 0.70→0.65, 의존성 버전 고정 → **~45% 절감** ($224 → $125).

## AdMob 설정

- **Android App ID**: `ca-app-pub-7330738950092177~5475101490`
- **iOS App ID**: `ca-app-pub-7330738950092177~7468498577`
- **광고 단위**: Android+iOS × 배너/전면/앱오프닝/보상형 = 8개 (모두 프로덕션 ID)
- **현재 Alpha**: `EXPO_PUBLIC_USE_TEST_ADS=true` 환경변수로 테스트 광고 사용
- **프로덕션 출시 시 반드시**: `eas.json`에서 `EXPO_PUBLIC_USE_TEST_ADS` 제거 + 새 빌드

## Paddle 프로덕션 계정 (제공 중단)

- ~~**대시보드**: vendors.paddle.com (비즈니스명: AI Soft)~~
- **상태**: 제공하지 않기로 결정 (2026-04-21). 웹 결제는 미제공, 앱 결제(Google Play IAP)만 운영.

## 프로덕션 서버 인프라 (Hetzner VPS)

- **호스팅**: Hetzner Cloud (독일)
- **서버 IP**: `46.62.201.127`
- **도메인**: `mytravel-planner.com`
- **DNS**: Cloudflare (Proxied)
- **배포**: 수동 SSH + rsync + Docker Compose

### 배포 절차 (수동)

```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 백엔드 배포 (restart 대신 up -d 사용 — 502 방지)
cd /root/travelPlanner/backend
rsync -avz --exclude node_modules src/ /root/travelPlanner/backend/src/
docker compose build
docker compose up -d

# 배포 확인
curl https://mytravel-planner.com/api/health
```

**참고**: Railway 프로젝트는 다른 앱 (Webtoon, ai-edu-toon, mybaby)용. TravelPlanner는 Hetzner 단일.

---

## 🐛 버그 수정 이력 요약

| 버그 ID | 날짜 | 심각도 | 설명 | versionCode |
|---------|------|--------|------|-------------|
| #1-9 | 2026-03-21 | CRITICAL | 중복 여행 생성 (더블탭, SELECT, SSE Fallback) | 25-30 |
| 타임존 | 2026-03-22 | CRITICAL | 여행 상태 타임존 (서버→목적지 시간) | 32 |
| #10-13 | 2026-03-23~24 | CRITICAL | SSE → 폴링 전환 (Railway 호환성) | 33-36 |
| P0-1 | 2026-03-29 | CRITICAL | 비밀번호 리셋 토큰 재사용 방지 (트랜잭션 + SELECT FOR UPDATE) | 40 |
| P0-2 | 2026-03-29 | CRITICAL | Share Token 만료 검증 (SQL WHERE 이동) | 40 |
| VC88-좌표 | 2026-04-07 | HIGH | Mapbox 한국어 미지원 → Google Place Details fallback | 88 |
| V111-1~7 | 2026-04-13 | HIGH | Alpha 검수 7건 (i18n, 코치마크, AI 카운터, 광고 토스트 등) | 112 |
| V112 RCA #1~10 | 2026-04-14 | CRITICAL | Auth scope, cancel, quota, filter code drop 등 | 113 |
| V114 #1~9 (14건) | 2026-04-15 | CRITICAL | CoachMark 6회 회귀 (statusBarTranslucent), 웹 로그인 차단, consent 중복, register refreshed UX, 카운터 통합, error_log 필터 | 115 |
| V115 Gate5/10 P0 | 2026-04-15 | CRITICAL | C1 stale closure, RegisterForceDto whitelist, H1~H4, ADMIN_EMAILS 하드코딩 | 115 |
| V120 Alpha | 2026-04-17 | HIGH | CreateTripScreen 크래시, 카카오 로그인, 동의 상세 모달 (12건) | 120 |
| V122 Alpha | 2026-04-17 | HIGH | ANR, consent, payment, photo permission (10건) | 122 |
| V124 Alpha | 2026-04-17 | HIGH | admin quota, keyboard ANR, badge color, permission settings (5건) | 124 |
| V132 Alpha | 2026-04-18 | HIGH | onboarding bg, 회원 탈퇴, consent JIT, card clipping (4건) | 132 |
| V134 Alpha | 2026-04-18 | HIGH | 웹 허위정보 제거, 키보드 가림, JIT 권한, 법적 문서 갱신 (4건) | 136 |
| V136 Alpha | 2026-04-18 | HIGH | 탈퇴 모달 jitter 근본 해결, JIT 권한 완전 전환 (2건) | 137 |
| V137 7단계 QA | 2026-04-18 | CRITICAL | expenses settleUp IDOR, i18n 17개 언어, 법적 문서, 딥링크 | 138 |
| V138 Alpha | 2026-04-18 | LOW | 탈퇴 모달 SafeArea overlay 위임 (여백 미세 조정) | 139 |
| V146~V148 | 2026-04-20 | HIGH | 알림 모달 정렬, WelcomeModal 플래시, Provider 순서 변경, isPrePermissionResolved | 148 |
| V150~V152 | 2026-04-21 | HIGH | pendingPrePermission 경쟁 조건, 인원수 미반영, 이메일 검증, 구독 만료 미반영 | 152 |
| V155~V157 | 2026-04-22 | HIGH | Sentry 설정, 메모리 누수 5건, i18n 14건, 백엔드 성능 로깅 | 157 |
| V158~V159 | 2026-04-23 | **CRITICAL** | **Android KAV OOM 크래시 근본 해결** (9파일), Animated cleanup 전수 (19파일), 이메일 한글 감지 | 159 |
| V162~V169 | 2026-04-24 | HIGH | 한글 IME 폭발, 인원수 NaN 서버 전달 차단, source-tagged RC snapshot, Sentry 가시화 | 169 |
| V170~V172 | 2026-04-24 | HIGH | RC SDK device cache, Play Billing plan switch, isOperationalAdmin 통일, webhook 폴링 | 172 |
| V173~V174 | 2026-04-25 | HIGH | RC logOut 누락 phantom 구독 수정, admin 9999 quota 분기, useFocusEffect 전환, ErrorLog 컬럼 5개 확장 | 174 (175 빌드) |
| V175~V176 | 2026-04-25 | **CRITICAL** | **PremiumContext 하드코딩 ADMIN_EMAILS 제거 (관측 편향 해소)**, 라이선스 인앱, **ErrorLog DTO 완화 (4/25 0건 데이터 손실 해결)**, 5.5 소수 가드 | 176 (177 빌드) |
| V177~V178 | 2026-04-25 | HIGH | double-logout race(V174 회귀), 데이터 내보내기 실패, 네이티브 LicensesScreen, foreground reset (silentRefresh 60s throttle) | 178 (179 빌드) |
| V179~V180 | 2026-04-25 | **CRITICAL** | **RC isInitialized 리셋 + PremiumContext userId 추적 (탈퇴-재가입 phantom 구독)**, expo-file-system/legacy 전환, **법적 P0 5건 수정** (11개 언어 art3+국외이전, 90일 purge cron, 사업자정보, CCPA), ErrorLog 자동 컨텍스트 + 5.5 가드 강화 | 180 (181 빌드) |
| V181~V182 | 2026-04-25 | **CRITICAL** | **PaywallModal server-tier 가드 (V173/V179/V181 phantom 구독 3회 회귀 근본 해결)**, **ConfirmDialog 큐 기반 + handleLogout 가드 선행 (V177/V181 double-logout race 근본 해결)**, admin 페이월 차단, 법적 일관성 (11개 locale OpenWeather + fr/ru art5 + 17개 사업자 placeholder + effectiveDate 통일), `scripts/validate-legal.py` 자동 검증 | 182 (183 빌드) |
| V183~V184 | 2026-04-26 | **CRITICAL** | **admin 페이월 가드 제거 (V182 단일 플래그 과부하 회귀 — 결제 회귀 검증 lead time 무한대 → server-tier gate 위임)**, **저작권 51 HTML+17 locale 일괄 수정** (© 2024-2026 → © 2026, AI Soft 2026 설립 사실 반영), **Paddle 잔존 6곳 완전 제거** (전자상거래법 §13), **17 locale art12 OpenWeather 추가** (GDPR Art. 44/PIPA §28), **제휴 파트너 약관·5 locale 일괄 제거** (정통망법 §22의2), **iCal 미구현 표기 제거**, **사업자 정보 4 HTML 추가** (PIPA §39의6), **effectiveDate 통일**, **`validate-content.py` 신설** (도입 즉시 25건 잠복 회귀 발견·수정), **validate-legal.py 보강** (P0-E/F/G + P1-B), **`npm run validate:static`** 통합 (11건 + 자동 검증 2건) | 184 (185 빌드 예정) |

상세: `docs/archive/bug-history-2026-04.md`, `docs/archive/claude-md-history-pre-v112.md`, `testResult.md`

---

## 🔐 SNS 로그인

| Provider | 상태 | 비고 |
|----------|------|------|
| Google OAuth | 프로덕션 | 게시 완료, 무제한 사용자 |
| Kakao OAuth | 설정 완료 | 이메일(필수), 닉네임, 프로필 |
| Apple Sign-In | Phase 2 (보류) | iOS 출시 전까지 대기 |

상세: `docs/sns-login-launch-checklist.md`

---

## 💰 Google AdSense

- **현재 상태**: 거부 (2026-03-25, "가치가 별로 없는 콘텐츠" — 실제로는 Google 색인 부족)
- **재신청 예정**: 2026-04-29 (색인 30개+ 확보 후)
- **상세**: `docs/adsense-diagnosis.md`

---

## 🔐 보안 아키텍처 요약

1. **Auth**: JWT 15m access + one-time refresh (Redis jti, eviction=reject) + bcrypt 12 + CSPRNG 2FA (backup codes SHA-256) + account lockout + pending_verification scope isolation (V112)
2. **Access**: Rate limiting all auth endpoints + AdminGuard (email-based) + 2FA lockout + PendingVerificationGuard
3. **Transport**: HSTS preload + CSP (no unsafe-eval) + Referrer-Policy + CORS whitelist
4. **Data**: SELECT FOR UPDATE on password reset, SQL-level share token expiry filter, Stored XSS 방지 (stripHtml DTO), uploads/ .gitignore 패턴
5. **Monitoring**: Sentry (aisoft-p7.sentry.io) — 네이티브 크래시, JS 에러, 메모리 경고, 느린 API (>10s) breadcrumb, ANR 감지

---

**최종 업데이트**: 2026-04-26 KST (V184 Phase 0 완료 — V183 회귀 근본 해결. admin 페이월 가드 제거로 V182 단일 플래그 과부하 종결, 저작권/Paddle/제휴 파트너/iCal/사업자정보/effectiveDate 일괄 정합화로 정적 콘텐츠 사실 위배 8건 종결, 17 locale art12 OpenWeather 추가로 GDPR Art. 44 누락 종결, **validate-content.py 신설로 도입 즉시 잠복 회귀 25건 발견·수정** — 자동 검증이 회귀 발견 lead time을 0으로 단축. 핵심 불변식 31→33건 — 32(단일 플래그 과부하 금지) + 33(정적 콘텐츠 자동 검증). `npm run validate:static`이 차기 회귀의 1차 방어선)
