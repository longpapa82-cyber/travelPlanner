# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태

| 플랫폼 | 버전 | 상태 |
|--------|------|------|
| **Android** | 1.4.3 (versionCode 302) | **v302 알파 draft 제출 완료** 🔄 (2026-06-16) — 스크롤 클리핑 근본해결(tabBarStyle position:absolute). Play Console 출시노트+rollout 확정 대기. v300 프로덕션 전체출시 신청(2026-06-10) Google 검토 대기 🔄 |
| **iOS** | 1.4.3 (B86) | **App Store 출시 완료** ✅ — 2026-06-03. 자동광고 근본수정+UI개선은 OTA 반영·검증 완료 |
| **서버** | 41차 | https://mytravel-planner.com 운영 중. **재인증 게이트+서버권위+2FA 일반화 배포 완료** ✅ (2026-06-16, OTA production 발행 2회): `POST /auth/reauth`, `isServiceAdmin` env 전환, `getReauthMethod` 2FA/비번/setup_2fa 분기 |
| **브랜치** | `main` / `fix/ui-android-letterspacing-tabbar` | ✅ PR #11 병합. fix/ui-android-letterspacing-tabbar(스크롤 클리핑 수정·v302·**504 severity 강등 2026-06-17**) **main 미병합** — Play Console rollout 확정 후 병합. 다음 할 일 #0 참조 |

---

## ⚠️ 다음 할 일

0. **✅ 오류 내역 점검 + 504 severity 강등 (조치 1건)** (2026-06-17)
   - **점검(DB 직접 조회 4·14일)**: PR #8·#9·#10 수정 전부 유지 — `User with ID not found` 404 **0건**(PR#9 배포 이후), `truncated_max_tokens`/`Unterminated JSON` **0건**(14일), 504 제외 실제 error/fatal **0건**(7일). **긴급 코드 버그 없음.**
   - **유일 신호 504(인프라성, 버그 아님)**: 06-16 14:54·14:55(61초 내 `/analytics/popular-destinations`·`/notifications/unread-count`), 06-09 15:45~51(`/trips`·`/announcements`·`/notifications`). 무관 GET들이 좁은 시간창 동시 504 = 게이트웨이 순간 정체(엔드포인트 버그라면 한 엔드포인트·여러 시간대로 몰림).
   - **조치**: `frontend/src/services/api.ts` 5xx auto-reporting 인터셉터에서 **504만 `error`→`warning` 강등**(`severity = status === 504 ? 'warning' : 'error'`). 자가복구되는 504가 대시보드 노이즈 유발하던 것 정정·실제 error 신호 가독성 개선. 나머지 5xx(500/502/503)는 error 유지. tsc clean.
   - **커밋**(브랜치 fix/ui-android-letterspacing-tabbar): `7dc52bb4`(504 강등) + `67e4a5ae`(versionCode 302) + `bae79d21`(CLAUDE.md). 작업트리 clean.
   - **⏭️ 반영 시점**: 504 강등은 **코드 변경뿐 → 다음 앱 빌드 때 반영**(서버 배포 불필요). 상세 → 메모리 [error_log_triage.md].

0-1. **🔄 admin 화면 스크롤 클리핑 근본해결 + v302 알파 draft 제출 — Play Console rollout 확정 대기** (2026-06-16)
   - **증상**: Android admin 화면(AdminDashboard 등) 하단 회색 띠 + 스크롤 중 콘텐츠 클리핑.
   - **오진 교훈**: paddingBottom/contentStyle 등 화면 단위 수정 OTA 6~7회 반복했으나 효과 없음. OTA 미반영 오판까지 했으나 OTA는 정상(EAS 대시보드+adb 마커로 확인). 진단 자체가 틀렸던 것. 사용자 "스크롤 중 잘린다" 발언이 결정적 단서.
   - **진짜 원인**: bottom-tab scene이 ScrollView에 하단 inset을 주어 scene이 화면 전체를 차지 못함 → 스크롤 클리핑. 회색 띠는 NavigationContainer `theme.colors.background`(neutral[50]) 노출 부수증상. adb uiautomator dump + screencap 픽셀 측정으로 확정.
   - **근본 수정**: ①`tabBarStyle: position:'absolute'`로 scene 전체 확장(클리핑 해소) ②메인 탭 5개+admin 6개 화면 `contentContainerStyle paddingBottom 96`(뜬 탭바 회피) ③NavigationContainer theme 라이트 배경 흰색(회색 잔흔 제거). APK 직접설치+adb 측정 검증, 사용자 확인.
   - **v302 빌드**: EAS 클라우드(60e5f0a9) → `eas submit --profile alpha` → Play 알파 draft(submission 8b928924). app.json versionCode 300→301 수정(app.config.js 폴백보다 우선).
   - **카카오 로그인 웹 이동**: debug 서명이 assetlinks.json SHA256 3개에 없어 App Links verify 실패 → 웹 폴백. release 서명(v302)에서 정상. 코드 버그 아님·조치 불필요.
   - **⚠️ 브랜치 미병합**: fix/ui-android-letterspacing-tabbar → main 병합 아직 안 함. Play Console rollout 확정 후 병합.
   - **⏭️ 남은 일**: Play Console에서 v302 출시노트+rollout 확정. 상세·교훈 → 메모리 [admin_scroll_clipping_tabbar_fix.md].

-1. **✅ 재인증 게이트("sudo mode") + 서비스관리자 서버권위 전환 + 2FA 일반화 — PR #11 병합·서버배포·OTA 완료** (2026-06-16)
   - **재인증 게이트**: AdminDashboard·AdDebug 진입 시 매번 본인 재인증. `POST /auth/reauth`(JwtAuthGuard+Throttle, userId 토큰 추출·body 아님). 전용 Redis 카운터(`reauth_attempts:`) brute-force 방어(10회 15분 잠금·로그인 카운터와 분리). 모달은 탈퇴 모달 키보드 UX(animationType none+onShow focus+Android flex-end) 재사용. 세션 1회 인증.
   - **서비스관리자 서버권위 전환**: 기존 프론트 하드코딩 `SERVICE_ADMIN_EMAILS` → `admin-check.ts`에 `isServiceAdmin(email, role)` 신설(env OR DB role=admin). `getProfile`이 `isServiceAdmin` 포함 내려줌. **이후 서비스관리자 추가는 서버 env 한 줄(앱 재빌드 불필요)**. 서버 `.env`에 `SERVICE_ADMIN_EMAILS=longpapa82,hoonjae723` 추가.
   - **2FA 일반화(근본 해결)**: 비번 전용 재인증은 소셜 계정(비번 없음)에 구멍. 주 관리자 longpapa82가 **google 계정**(DB 확인)이라 재인증 불가. `getReauthMethod` 신설: 2FA 켜짐→TOTP/백업코드, 2FA없음+email→비번, 2FA없음+소셜→REAUTH_SETUP_2FA(2FA 설정 유도, AdminGuard는 서버에서 계속 보호). `getProfile`에 `reauthMethod` 힌트 포함. 프론트 `openAdminArea` 분기.
   - **검증·배포**: 백엔드 테스트 92개 통과(신규 16개), tsc·lint clean, i18n 17개. **서버 프로덕션 배포**(rsync+docker, `/auth/reauth` 401·옛 `/auth/verify-password` 404 검증·health 200·SERVICE_ADMIN_EMAILS 컨테이너 로드 확인). **OTA production 2회 발행**(iOS+Android). **PR #11 squash 병합**(main `551cfef1`).
   - **⚠️ 한계(정직)**: 소셜+2FA없음 계정은 재인증 면제(2FA 설정 유도만). 실제 보안 경계는 서버 AdminGuard. 상세·교훈 → 메모리 [admin_reauth_2fa_gate.md].
   - **⏭️ 실기기 검증 필요**: ①hoonjae723(email) 관리자 메뉴→비번 모달 정답/오답 ②longpapa82(google) 관리자 메뉴→2FA 설정 유도→설정 후 TOTP 재인증. OTA 반영(앱 재시작 1~2회) 후.

-1. **✅ 오류 점검 + auth 수정 2건 — PR #9·#10 병합·서버배포 완료** (2026-06-16)
   - **점검**: 운영 `error_logs`/`api_usage` 점검 → 정상noise·504(6-09 2건 인프라성)·AI(PR #8로 근절, `truncated_max_tokens`/JSON잘림 신규 0건) 조치불요. 실제 수정 2건 발견.
   - **수정①(PR #9 `c82eca64`) 탈퇴유저 404→401**: `jwt.strategy.ts`가 throw하는 `findById` 호출 → 자기 `if(!user) throw Unauthorized`가 **죽은 가드**(PR #8 AI버그와 동일 안티패턴 3번째). 탈퇴계정 토큰이 404로 새어 클라 401 refresh/logout 복구경로를 못 탐(28건/6 distinct 유저). `usersService.findByIdOrNull`(non-throwing) 신설로 401 정정. security-reviewer가 옛 404를 MEDIUM info-leak 확인. **2기기 실기기 검증**(한쪽 탈퇴→나머지 자동 로그아웃).
   - **수정②(PR #10 `7bf054d6`) 이메일 도메인 검증**: 미존재 이메일 가입→SMTP bounce→관리자 메일함 반송알림 누적. **bounce 제목은 Gmail 자동생성이라 변경불가** → 예방책: 가입 진입부 도메인 MX(없으면 A/AAAA implicit-MX) 검증, **NXDOMAIN/ENODATA만 거부·나머지(SERVFAIL/timeout) fail-open**. `common/email-domain.ts`(Node 내장 dns·무패키지)+i18n 17개. 프로덕션 E2E(NXDOMAIN→400, 정상→201, SERVFAIL→fail-open) 검증.
   - **⚠️ 한계(정직)**: 최초 신고 `hoonkae723@gmail.com`은 **로컬파트(메일박스) 오타라 못 막음**(SMTP 한계). SERVFAIL 도메인(`@gmial.com`)도 fail-open 통과. 완전 미존재 도메인만 거름.
   - **배포**: 둘 다 서버사이드 → **앱빌드 불필요·rsync+docker 즉시적용**·healthy·핵심 CI 6잡 초록(E2E만 기존 timeout). 상세·교훈 → 메모리 [email_domain_deliverability_check.md], [error_log_triage.md].
   - **⏭️ 모니터링**: error_logs `NotFoundException 404 "User with ID"` 신규 0건 + 관리자 bounce 알림 빈도 추적.

1. **✅ AI 여행 빈 일정("AI 실패" 칩) 근본해결 — PR #8 병합·서버배포 완료** (2026-06-10)
   - **증상**: iOS 일부 여행 상세에 "AI 실패" 칩 + "일정 없음"(빈 일정). 예: 뉴욕 31일.
   - **진단(DB확정)**: `aiStatus='failed'`는 DB 전체 **단 1건**(뉴욕31일, itin 0행). 칩 자체는 정상동작 — UI버그 아님.
   - **근본원인 2겹**: ①`generateDailyItinerary`가 에러를 `[]`로 swallow → 상위 `failedDays>50% throw`가 **죽은코드**가 되고 **빈 일정을 success로 위장 저장**(silent failure) ②full-trip `maxTokens` 고정(4096) → 긴 JSON 잘림(`Unterminated string in JSON`).
   - **수정**: 활동있는 날만 `completedDays` 집계→throw는 `completedDays===0`만(**부분보존**) / `maxTokens` 일수비례화 / `finish_reason==='length'` 잘림 가시화(`truncated_max_tokens` 로깅). 부수: ≤7일 fallback `progress$` 누락 수정.
   - **배포**: **서버사이드라 앱빌드 불필요 — rsync+docker로 전 앱버전 즉시적용**·healthy·HTTPS200. **PR #8 squash 병합**(main `87f456ce`, 핵심 CI 6 job 초록·E2E만 기존 timeout). 기존 실패 뉴욕 1건은 사용자 결정으로 그대로 둠. 상세·교훈 → 메모리 [ai_empty_itinerary_partial_preservation.md].
   - **⏭️ 모니터링**: `truncated_max_tokens` 로그 발생 추적(토큰부족 조기발견).

2. **✅ 자동 전면광고 근본해결 + UI개선 — PR #6 병합완료, Android v300 프로덕션 신청** (2026-06-09~10)
   - **🎯 진짜 근본원인**(직전 "cadence 때문" 결론은 부분적 오진): `useGDPRConsent`가 5개 광고훅(AdBanner×3·useAutoInterstitial·useInterstitialAd·useAppOpenAd·useRewardedAd)에서 **per-instance로 동작→isReady 파편화**→`useAutoInterstitial`이 TripList focus 시점 자기 인스턴스 `isReady=false`로 매번 `BLOCKED !isReady`. (admin·no-fill·cadence·쿨다운 다 진범 아니었음.) on-device 진단(AsyncStorage→AdDebug Trace)으로 확정.
   - **수정**: ①`useGDPRConsent` **싱글톤화**(resolveConsentOnce promise가드+sharedState+subscribers) ②`useAutoInterstitial` **isReady 재무장**(useFocusEffect deps=[isReady]). jjangpapa82 일반계정서 정상노출 검증. 부수: 글로벌쿨다운 60→15s, cadence 3→2+매진입시도.
   - **UI 4건**: 완료여행 히어로칩(배너제거·back밀림 해소), hero safe-area `safeAreaTop+12` 통일(생성/상세), 여행수정 중복back 제거+카피 flex-end. i18n `detail.status.aiFailed` 17개 추가.
   - **🔑 교훈**: ①전역상태(consent/SDK-init)를 per-instance hook으로 두지 말 것(모듈 싱글톤+구독). ②**production Hermes는 console.log를 syslog로 안 보냄** → 진단은 on-device(AsyncStorage→화면)로. ③광고 진단은 role=user+ADMIN_EMAILS밖 일반계정(prime0919·jjangpapa82). 상세 → 메모리 [auto_interstitial_consent_singleton_fix.md].
   - **병합·배포**: **PR #6 squash 병합**(main `0b165fb2`, CI 6 job 초록·E2E만 timeout). iOS OTA 검증완료. 진단 임시코드 전부 원복.
   - **⏭️ 남은 일**: ①**Android v300 프로덕션 전체출시 신청 완료**(2026-06-10) — Google 검토 결과 대기 → 승인 시 자동 게시. ②(점검) ExpensesScreen safe-area(일반헤더·insets 없음, 겹침 가능성) — 미처리.

3. **1.4.3 출시 후 모니터링** — iOS/Android 양 플랫폼 프로덕션 출시 완료(2026-06-03). 크래시율·에러로그·실제 결제 집계·리뷰 모니터링
4. **실제 프로덕션 결제 모니터링**: 수익 대시보드에 실제 결제 정상 집계 확인
5. **⚠️ Android 16+ edge-to-edge (별도 세션 권장)**: `edgeToEdgeEnabled:false`는 임시 방편 — targetSdkVersion 36이 강제 적용하는 미래 시점 대비 필요. **고난도·고리스크**: edge-to-edge를 켜면 상태바/네비바 뒤로 콘텐츠가 깔려 18개 화면 safe-area 전수 재검증 + StatusBar/네비바 색상 로직(2곳) 재작업 + "파란 배경 깜빡임" 버그(과거 withAndroidDeferEdgeToEdge 시도→실패 이력) 재대응 필요. 실기기 육안 QA 필수 + 새 빌드/알파 재출시 수반. **현재 운영/출시 영향 없음** — 충분한 QA 시간 확보 후 전용 세션에서 진행.
6. **(별도 세션) E2E Playwright 테스트 안정화**: E2E **인프라 부채는 전부 해결**됨 — Docker 빌드(plugins), backend 부팅(consent_audit_logs 인덱스 중복), frontend webServer(expo export→dist, serve dist:8081) 3겹 모두 통과 확인. 남은 건 **실제 Playwright 테스트가 20분 timeout 초과(cancelled)** — 테스트 시나리오별 hang/느림 조사 필요(셀렉터 대기, 네트워크 등). 운영 무관·테스트 코드 영역. CI Docker job은 ECONNRESET flaky(재시도 시 통과).
7. **(낮음) GitHub 자동배포 워크플로 정비**: `.github/workflows/deploy.yml`이 VPS secret 미설정으로 시작부터 실패 — **현재 미사용**(실 배포는 수동 rsync, [deploy.md](docs/operations/deploy.md)). 자동 CI/CD 도입 시에만 의미. 운영 무관.

> ✅ **2026-06-02 해결 완료**: 백엔드 CI 부채(ERESOLVE/테스트31/lint25/coverage) + Sentry 전면 제거 + Static Content Validation(권한 검증 오탐 + 마케팅 문구) + Docker frontend 빌드(plugins 누락) + E2E 인프라 3겹(Docker/backend 인덱스/frontend webServer). CI 핵심 6 job 초록(E2E 실제 테스트 timeout만 별도 과제로 잔존).

**⚠️ Android 로컬 빌드 reanimated/worklets 레이스** — EAS local 실패 시 prebuild + `org.gradle.parallel=false` + gradlew 경로 사용 (메모리 `build_reanimated_worklets_race.md`)

---

## 🍎 iOS 최신 빌드: B84 (1.4.2) — App Store 심사 대기 중 ⏳

**B84 수정 내역**: `expo-tracking-transparency` 플러그인 `userTrackingPermission: false` + `withRemoveATTDescription` 커스텀 플러그인 이중 방어로 NSUserTrackingUsageDescription 완전 제거. buildNumber 83→84, 심사 제출 (2026-05-25).

> 이전 빌드 상세(B65~B83) → `docs/build-history.md`

**⚠️ OTA 불변식**: `checkAutomatically: ON_ERROR_RECOVERY`로 빌드된 앱은 OTA가 동작하지 않음 → 반드시 `ON_LOAD`로 빌드.

**⚠️ ATT 비도입 결정**: iOS 사용자 75~80% 추적 거부 → 수익 개선 효과 미미, UX 저하 리스크로 도입 보류.

**iOS 빌드 명령어**:
```bash
cd frontend && eas build --platform ios --profile production-ios --local --output ../../build-ios-BXX.ipa
xcrun altool --upload-app --type ios --file ../build-ios-BXX.ipa \
  --username longpapa82@gmail.com --password llqh-fxen-albm-ojpo
```

**⚠️ iOS 불변식**:
- `iosAppId` 절대 제거 불가 → `GADApplicationIdentifier` 소멸 → 앱 즉시 크래시
- iOS 광고/UMP 비활성화는 JS 레이어에서만 (`Platform.OS === 'ios'` 분기)
- ATT 재도입 시 프레임워크 설치 + 실제 권한 요청 코드 모두 필요
- `expo-tracking-transparency` **플러그인 절대 제거 불가** → 패키지가 package.json에 있는 한 플러그인도 app.config.js에 있어야 함 → 제거 시 UIManager::setAnimationDelegate SIGSEGV 크래시 발생 (B81 교훈)

---

## 🤖 Android 최신 빌드: versionCode 302 (1.4.3) — Play 알파 draft 제출 완료 🔄

**v302 수정 내역**: admin 화면 스크롤 클리핑 근본해결(tabBarStyle position:absolute + contentContainerStyle paddingBottom 96 전체 탭 화면). EAS 클라우드 빌드(60e5f0a9), submission 8b928924. Play Console 출시노트+rollout 확정 대기. 브랜치 fix/ui-android-letterspacing-tabbar(main 미병합).

**v294 수정 내역**: 회원탈퇴 모달 키보드 등장 시 팝업 튐(jank) 제거. versionCode 293→294. eas submit alpha 트랙 draft 업로드 (2026-06-02).

**⚠️ AAB 출시 빌드 절차**: EAS local이 reanimated/worklets 레이스로 실패하므로 `prebuild --clean` → keystore 주입(EAS 메타데이터 base64에서 추출, SHA-1 `68:5E...`) → `org.gradle.parallel=false` → `gradlew :app:bundleRelease` → `eas submit --platform android --profile alpha`(service account 자동 업로드, track=alpha/draft).

> 이전 빌드 상세(v282~v291) → `docs/build-history.md`

**⚠️ Android 16+ edge-to-edge**: `edgeToEdgeEnabled:false`는 targetSdkVersion 36에서 무시됨 — 향후 대응 필요.

**⚠️ 로컬 빌드 reanimated/worklets 레이스**: `eas build --local`이 `libworklets.so missing`으로 실패하면 빌드 옵션(ninja/ABI/재시도)으로 안 풀림. **해결**: prebuild + `org.gradle.parallel=false` + `./gradlew bundleRelease/assembleRelease`. 출시 AAB는 EAS keystore 주입 필요. 상세 → 메모리 `build_reanimated_worklets_race.md`.

**Android 빌드 명령어** (EAS 클라우드 정상 시):
```bash
cd frontend && eas build --platform android --profile production --local --output ../build-vXXX.aab
```

---

## 🖥️ 서버 배포 명령어

```bash
# 백엔드
rsync -avz --exclude node_modules -e "ssh -i ~/.ssh/travelplanner-oci" \
  backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/ && \
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"

# 웹 (static public)
rsync -avz -e "ssh -i ~/.ssh/travelplanner-oci" \
  frontend/public/ root@46.62.201.127:/root/travelPlanner/frontend/public/

# nginx.conf 변경 후
rsync -avz -e "ssh -i ~/.ssh/travelplanner-oci" frontend/nginx.conf root@46.62.201.127:/root/travelPlanner/frontend/nginx.conf
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner && docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d frontend"
```

---

## 🔗 빠른 참조

| 목적 | 파일 |
|------|------|
| 전체 빌드 이력 (iOS/Android/서버) | `docs/build-history.md` |
| 불변식 45개 (결제/인증/UI/에러/백엔드/법적) | `docs/invariants/README.md` |
| 배포 절차 (backend/Android/iOS) | `docs/operations/deploy.md` |
| 인프라/자격증명/비용 | `docs/operations/infra.md` |
| 보안 아키텍처 7개 레이어 | `docs/security-arch.md` |

---

## 🔐 핵심 불변식 요약

> 전체 45개: `docs/invariants/` — 위반 시 phantom 구독, 보안 취약점, 결제 버그 재발

- **결제**: RC logOut on logout 필수 | server tier authoritative | preflight dual-source | fail-close
- **인증**: isLoggingOut lock | OAuth CSRF nonce | refresh token AsyncStorage 금지
- **UI**: KAV behavior="height" 금지 | Animated cleanup 필수
- **에러**: PII strip before reportError | production fail-fast for required env

---

## 🗂️ 기술 부채

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| **Sentry 제거** | DSN 미설정으로 완전 비활성. 제거 대상: `frontend/src/common/sentry.ts`, `backend/src/common/sentry.ts`, 패키지 `@sentry/react-native`, `@sentry/nestjs` | 낮음 |
| **Paddle 연동** | 프로덕션 인증 완료 후 env 교체 필요 (API Key, Webhook Secret, Price IDs, Client Token) | 외부 대기 중 |
| **iOS AdMob ATT** | 도입 보류 결정 — iOS 사용자 75~80% 거부, 수익 개선 효과 미미 | — |
| **AdMob iOS 앱인증** | ✅ 완료 (2026-05-24) | — |
