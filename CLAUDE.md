# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태

| 플랫폼 | 버전 | 상태 |
|--------|------|------|
| **Android** | 1.4.2 (versionCode 289) | **알파 출시 완료** ✅ — 2026-05-28 (하단 네비게이션 바 색상 수정) |
| **iOS** | 1.4.2 (B84) | **App Store 심사 대기 중** ⏳ — 2026-05-25 |
| **서버** | 39차 | https://mytravel-planner.com 운영 중 |
| **브랜치** | `main` | — |

---

## ⚠️ 다음 할 일

1. **랜딩 리디자인 PR #2 병합** — 브랜치 `feat/landing-motion-enhance`, 39 commits, `mytravel-planner.com` 배포 완료. main 병합 대기
2. **iOS 1.4.2 (B84) App Store 심사 결과 대기** — 통과 후 출시
3. **Android v289 알파 테스트 후 프로덕션 승격** — 하단 네비게이션 바 색상 수정 확인 후 진행
4. **실제 프로덕션 결제 모니터링**: 수익 대시보드에 실제 결제 정상 집계 확인
5. **Sentry 코드 제거**: DSN 미설정으로 완전 비활성 — 불필요 코드/패키지 정리
6. **⚠️ Android 16+ edge-to-edge**: edgeToEdgeEnabled:false는 임시 방편 — targetSdkVersion 36 대응 필요

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

## 🤖 Android 최신 빌드: versionCode 289 (1.4.2) — 알파 출시 완료 ✅

**v289 수정 내역**: 하단 OS 네비게이션 바 ↔ 앱 탭 바 색상 동기화. `expo-navigation-bar` 패키지 + `App.tsx` useEffect 런타임 색상(라이트 `#FFFFFF`/다크 `#1E293B`). versionCode 288→289, 알파 출시 (2026-05-28).

> 이전 빌드 상세(v282~v287) → `docs/build-history.md`

**⚠️ Android 16+ edge-to-edge**: `edgeToEdgeEnabled:false`는 targetSdkVersion 36에서 무시됨 — 향후 대응 필요.

**Android 빌드 명령어**:
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
