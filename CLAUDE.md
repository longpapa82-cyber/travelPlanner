# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태

| 플랫폼 | 버전 | 상태 |
|--------|------|------|
| **Android** | 1.4.3 (versionCode 300) | **v300 프로덕션 전체출시 신청 완료** 🔄 (2026-06-10) — 자동광고 근본수정+UI개선. Google 검토 전 자동검사(~14분) → 검토 → 출시. 이전 v294 프로덕션 출시 완료 ✅ |
| **iOS** | 1.4.3 (B86) | **App Store 출시 완료** ✅ — 2026-06-03. 자동광고 근본수정+UI개선은 OTA 반영·검증 완료 |
| **서버** | 39차 | https://mytravel-planner.com 운영 중. **AI 빈 일정 근본수정 배포 완료** ✅ (2026-06-10, 전 앱버전 즉시적용) |
| **브랜치** | `main` | ✅ 자동광고 PR #6(`0b165fb2`) + **AI 빈 일정 PR #8 병합 완료**(squash `87f456ce`). 다음 할 일 #0 참조 |

---

## ⚠️ 다음 할 일

0. **🔄 AI 여행 빈 일정("AI 실패" 칩) 근본해결 — PR #8 병합·서버배포 완료** (2026-06-10)
   - **증상**: iOS 일부 여행 상세에 "AI 실패" 칩 + "일정 없음"(빈 일정). 예: 뉴욕 31일.
   - **진단(DB확정)**: `aiStatus='failed'`는 DB 전체 **단 1건**(뉴욕31일, itin 0행). 칩 자체는 정상동작 — UI버그 아님.
   - **근본원인 2겹**: ①`generateDailyItinerary`가 에러를 `[]`로 swallow → 상위 `failedDays>50% throw`가 **죽은코드**가 되고 **빈 일정을 success로 위장 저장**(silent failure) ②full-trip `maxTokens` 고정(4096) → 긴 JSON 잘림(`Unterminated string in JSON`).
   - **수정**: 활동있는 날만 `completedDays` 집계→throw는 `completedDays===0`만(**부분보존**) / `maxTokens` 일수비례화 / `finish_reason==='length'` 잘림 가시화(`truncated_max_tokens` 로깅). 부수: ≤7일 fallback `progress$` 누락 수정.
   - **배포**: **서버사이드라 앱빌드 불필요 — rsync+docker로 전 앱버전 즉시적용**·healthy·HTTPS200. **PR #8 squash 병합**(main `87f456ce`, 핵심 CI 6 job 초록·E2E만 기존 timeout). 기존 실패 뉴욕 1건은 사용자 결정으로 그대로 둠. 상세·교훈 → 메모리 [ai_empty_itinerary_partial_preservation.md].
   - **⏭️ 모니터링**: `truncated_max_tokens` 로그 발생 추적(토큰부족 조기발견).

1. **🔄 자동 전면광고 근본해결 + UI개선 — PR #6 병합완료, Android v300 프로덕션 신청** (2026-06-09~10)
   - **🎯 진짜 근본원인**(직전 "cadence 때문" 결론은 부분적 오진): `useGDPRConsent`가 5개 광고훅(AdBanner×3·useAutoInterstitial·useInterstitialAd·useAppOpenAd·useRewardedAd)에서 **per-instance로 동작→isReady 파편화**→`useAutoInterstitial`이 TripList focus 시점 자기 인스턴스 `isReady=false`로 매번 `BLOCKED !isReady`. (admin·no-fill·cadence·쿨다운 다 진범 아니었음.) on-device 진단(AsyncStorage→AdDebug Trace)으로 확정.
   - **수정**: ①`useGDPRConsent` **싱글톤화**(resolveConsentOnce promise가드+sharedState+subscribers) ②`useAutoInterstitial` **isReady 재무장**(useFocusEffect deps=[isReady]). jjangpapa82 일반계정서 정상노출 검증. 부수: 글로벌쿨다운 60→15s, cadence 3→2+매진입시도.
   - **UI 4건**: 완료여행 히어로칩(배너제거·back밀림 해소), hero safe-area `safeAreaTop+12` 통일(생성/상세), 여행수정 중복back 제거+카피 flex-end. i18n `detail.status.aiFailed` 17개 추가.
   - **🔑 교훈**: ①전역상태(consent/SDK-init)를 per-instance hook으로 두지 말 것(모듈 싱글톤+구독). ②**production Hermes는 console.log를 syslog로 안 보냄** → 진단은 on-device(AsyncStorage→화면)로. ③광고 진단은 role=user+ADMIN_EMAILS밖 일반계정(prime0919·jjangpapa82). 상세 → 메모리 [auto_interstitial_consent_singleton_fix.md].
   - **병합·배포**: **PR #6 squash 병합**(main `0b165fb2`, CI 6 job 초록·E2E만 timeout). iOS OTA 검증완료. 진단 임시코드 전부 원복.
   - **⏭️ 남은 일**: ①**Android v300 프로덕션 전체출시 신청 완료**(2026-06-10) — Google 검토 결과 대기 → 승인 시 자동 게시. ②(점검) ExpensesScreen safe-area(일반헤더·insets 없음, 겹침 가능성) — 미처리.

2. **1.4.3 출시 후 모니터링** — iOS/Android 양 플랫폼 프로덕션 출시 완료(2026-06-03). 크래시율·에러로그·실제 결제 집계·리뷰 모니터링
2. **실제 프로덕션 결제 모니터링**: 수익 대시보드에 실제 결제 정상 집계 확인
4. **⚠️ Android 16+ edge-to-edge (별도 세션 권장)**: `edgeToEdgeEnabled:false`는 임시 방편 — targetSdkVersion 36이 강제 적용하는 미래 시점 대비 필요. **고난도·고리스크**: edge-to-edge를 켜면 상태바/네비바 뒤로 콘텐츠가 깔려 18개 화면 safe-area 전수 재검증 + StatusBar/네비바 색상 로직(2곳) 재작업 + "파란 배경 깜빡임" 버그(과거 withAndroidDeferEdgeToEdge 시도→실패 이력) 재대응 필요. 실기기 육안 QA 필수 + 새 빌드/알파 재출시 수반. **현재 운영/출시 영향 없음** — 충분한 QA 시간 확보 후 전용 세션에서 진행.
5. **(별도 세션) E2E Playwright 테스트 안정화**: E2E **인프라 부채는 전부 해결**됨 — Docker 빌드(plugins), backend 부팅(consent_audit_logs 인덱스 중복), frontend webServer(expo export→dist, serve dist:8081) 3겹 모두 통과 확인. 남은 건 **실제 Playwright 테스트가 20분 timeout 초과(cancelled)** — 테스트 시나리오별 hang/느림 조사 필요(셀렉터 대기, 네트워크 등). 운영 무관·테스트 코드 영역. CI Docker job은 ECONNRESET flaky(재시도 시 통과).
6. **(낮음) GitHub 자동배포 워크플로 정비**: `.github/workflows/deploy.yml`이 VPS secret 미설정으로 시작부터 실패 — **현재 미사용**(실 배포는 수동 rsync, [deploy.md](docs/operations/deploy.md)). 자동 CI/CD 도입 시에만 의미. 운영 무관.

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

## 🤖 Android 최신 빌드: versionCode 294 (1.4.3) — Play 비공개 테스트 업로드 완료(draft) ✅

**v294 수정 내역**: 회원탈퇴 모달 키보드 등장 시 팝업 튐(jank) 제거. 키보드 표시 시 justifyContent를 center→flex-end로 동적 전환하던 로직이 pan 모드와 비동기라 팝업이 한 번 튀던 현상 → 동적 전환 제거하고 Android는 flex-end 고정(iOS는 center 유지·정상). eas submit alpha 트랙 draft 업로드 (2026-06-02).

**v293 수정 내역**: 회원탈퇴 모달 키보드 UX(animationType none+onShow 즉시 focus, 키보드 위 정렬) + 신규기능(AI 일자별 진행률·딥링크 보안·게스트모드 revert 등). versionCode 291→293.

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
