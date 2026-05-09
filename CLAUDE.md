# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태

| 플랫폼 | 버전 | 상태 |
|--------|------|------|
| **Android** | versionCode 222 (1.0.0) | 알파 트랙 등록 완료 |
| **iOS** | 1.0.0 (31) | **App Store 제출 대기** — B31 TestFlight 업로드 완료, ASC에서 수동 제출 필요 |
| **iOS (코드준비)** | 1.0.0 (33) | B33 코드 수정 완료 — B31 심사 통과 후 빌드 및 TestFlight 업로드 필요 |
| **서버** | — | https://mytravel-planner.com 26차 배포 완료 |
| **브랜치** | `main` | — |

---

## 🍎 iOS 작업 현황

### 현재 빌드: B31 — App Store 제출 대기 (수동 제출 필요)

**B29 심사 거절** (2026-05-09):
- 반려 사유 4가지:
  - A. Guideline 2.1(b): IAP 미제출
  - B. Guideline 3.1.2(c): EULA 링크 누락
  - C. Guideline 5.1.1(v): 로그인 강제 (게스트 모드 없음) → Apple Reply로 이의제기 완료
  - D. Guideline 2.1: ATT 팝업 미노출

**B31 대응 완료 내역** (2026-05-09):
- [x] Apple Reply 전송 — 5.1.1(v) 이의제기 (계정 기반 앱 예외 조항)
- [x] ATT 코드 전체 제거: `expo-tracking-transparency` 플러그인, `NSUserTrackingUsageDescription`, `PrePermissionATTModal.tsx`, `useTrackingTransparency.ts` 삭제
- [x] 앱 설명(한국어/영어) 하단에 Terms/Privacy URL 추가
- [x] B31 빌드 완료 (Delivery UUID: `68b9610b-48f8-4fd9-9d6b-558982524628`)
- [ ] **⚠️ ASC에서 B31로 빌드 변경 후 "심사에 추가" 클릭 필요** (수동)
- [ ] **⚠️ IAP 심사 제출** — 버전 1.0 페이지 "앱 내 구입 및 구독" 섹션에서 제출 (B31 제출 시 함께)
- [ ] **⚠️ ASC 개인정보 → 추적 → "추적하지 않음" 변경** — B31 처리 후 가능

**B32 버그 수정 완료** (2026-05-09):
- 수정: 로그인 후 홈이 아닌 내 여행으로 이동하는 버그 (`RootNavigator.tsx` 네비게이션 상태 초기화 로직)
- B32 TestFlight 업로드 완료 (Delivery UUID: `0f482e00-a038-4360-8d24-b6fc01371c7f`)

**B33 코드 수정 완료** (2026-05-09):
- 수정: 이메일 로그인 시 암호 저장 팝업 (`LoginScreen.tsx` `textContentType="oneTimeCode"` → `"none"`)
- 수정: 앱 첫 실행 시 오프라인 모드 순간 표시 (`useOfflineSync.ts` 초기값 `null` 처리 + `OfflineBanner.tsx` null guard)
- 수정: `app.json` `NSUserTrackingUsageDescription` 잔존물 제거
- 수정: `package.json`·`jest.setup.js`·`transformIgnorePatterns`에서 `expo-tracking-transparency` 완전 제거
- buildNumber: 32 → 33

### ⚠️ 다음 세션 최우선 할 일

1. **App Store Connect** → 배포 탭 → "1.0 심사를 통과하지 못함" 클릭
2. "빌드" 섹션 → 현재 빌드 클릭 → **빌드 31** 선택 → 저장
3. "앱 내 구입 및 구독" 섹션에서 Premium Monthly, Premium Yearly "심사를 위해 제출"
4. "심사에 추가" 버튼 클릭 → 확인
5. B31 처리 완료 후 → 앱 개인정보 → 추적 → "추적하지 않음" 변경
6. **B33 빌드**: `eas build --platform ios --profile production-ios --local --output ../build-ios-33.ipa`
7. **B33 TestFlight 업로드**: `xcrun altool --upload-app --type ios --file ../build-ios-33.ipa --username longpapa82@gmail.com --password zicp-yjik-qmwm-xqpy`
8. B33 TestFlight 수동 테스트: 이메일 로그인 → 암호 저장 팝업 없음 확인, 로그인 → 홈 이동 확인

### iOS IAP 현황
- RevenueCat iOS API 키 임베드됨
- App Store Connect IAP 제품 (Monthly/Yearly) 등록 완료, 가격/현지화 설정 완료
- IAP 심사 제출: B31 제출 시 함께 처리 예정
- **iOS Sandbox IAP 테스트**: 첫 App Store 승인 후 가능

### iOS 빌드 이력 요약

| 빌드 | 주요 수정 | 결과 |
|------|----------|------|
| B27 | RevenueCat iOS 키 설정 | **App Store 거절** (Guideline 2.1a) |
| B28 | Apple 로그인 jwt.verify 버그 수정 | **App Store 거절** (Guideline 2.1b/c/v/ATT) |
| B29 | B28과 동일 | **App Store 거절** (동일 사유) |
| B30 | (중간 빌드, 미제출) | — |
| B31 | ATT 제거, EULA 링크 추가 | **TestFlight 완료, ASC 제출 대기** |
| B32 | 로그인 후 홈 이동 버그 수정 | **TestFlight 완료, B31 통과 후 제출** |

### iOS 미해결/보류 항목

| 항목 | 내용 | 사유 |
|------|------|------|
| 카카오 앱 복귀 불가 | 카카오 인증 후 myTravel 앱으로 자동 복귀 안 됨 | `@react-native-kakao/user` SDK 미도입으로 해결 불가 — 현재 웹 OAuth 방식 사용 |

### iOS 사업자 정보
- **사업자등록번호**: `411-18-92743` (AI Soft / 대표: 박훈재)
- **적용 현황**: 17개 언어 `legal.json` art18 전체 적용 완료 (B23)

### iOS 빌드 명령어
```bash
# 로컬 빌드
eas build --platform ios --profile production-ios --local --output ../build-ios-XX.ipa

# TestFlight 업로드
xcrun altool --upload-app --type ios \
  --file ../build-ios-XX.ipa \
  --username longpapa82@gmail.com \
  --password zicp-yjik-qmwm-xqpy
```

---

## 🤖 Android 작업 현황

### 현재 버전: versionCode 220 (1.0.0)

**상태**: Google Play 프로덕션 검토 중 (177개 국가 단계적 출시)

### Android 빌드 이력 요약

| versionCode | 주요 내용 | 상태 |
|-------------|----------|------|
| 220 | 프로덕션 제출 버전 | Play 검토 중 |
| 19 (versionCode 19) | IAP 테스트, 비공개 테스트 | 완료 |
| 15~17 | 비공개 테스트 | 완료 |

### Android 완료 인프라

| 항목 | 상태 |
|------|------|
| Google Play 결제 프로필 | ✅ 완료 (은행 계좌 인증) |
| RevenueCat ↔ Google Play IAP 연동 | ✅ 완료 |
| RTDN Pub/Sub 설정 | ✅ 완료 |
| 라이선스 테스터 등록 | ✅ 완료 |
| 스토어 등록정보 (ko/en/ja) | ✅ 완료 |
| 기능 그래픽 + 스크린샷 | ✅ 완료 |
| 데이터 안전 / IARC 등급 | ✅ 완료 |
| AdMob 광고 단위 8개 | ✅ 완료 |
| Play Signing SHA-1 (Google 로그인) | ✅ 완료 |

### Android 빌드 명령어
```bash
# AAB 빌드
eas build --platform android --profile production --local --output ../build-vXXX.aab
```

---

## 🖥️ 서버/백엔드 작업 현황

**서버**: OCI Hetzner CAX21 — https://mytravel-planner.com

### 최근 배포 이력

| 차수 | 커밋 | 주요 내용 |
|------|------|----------|
| 25차 | `3cef55f` | AdSense 영문 가이드 5개 + sitemap 추가 |
| 24차 | `ebf7ba3` | 비용 최적화 59% 절감 (날씨TTL 6h, 템플릿 90일) |
| 23차 | `f9b5ad1` | API Usage 로깅 4개 추가 (embedding/maps/email) |
| 22차 | `7c88619` | 회귀 테스트 597/597 PASS |
| 21차 | `c3bf247` | XSS 방지, WCAG AA, RTL Arabic |

### 서버 배포 명령어
```bash
rsync -avz --exclude node_modules backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/ && \
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"
```

---

## 🔗 빠른 참조

| 목적 | 파일 |
|------|------|
| 전체 버전 이력 + 다음 할 일 | `docs/status.md` |
| iOS B27 App Store 제출 현황 | `iOStest.md` |
| 불변식 45개 (결제/인증/UI/에러/백엔드/법적) | `docs/invariants/README.md` |
| 배포 절차 (backend/Android/iOS) | `docs/operations/deploy.md` |
| 인프라/자격증명/비용 | `docs/operations/infra.md` |
| 보안 아키텍처 7개 레이어 | `docs/security-arch.md` |
| V174~V210 버그 RCA | `docs/archive/version-rcas/v174-v210-rca.md` |

---

## 🗂️ 기술 부채 (당장 급하지 않음)

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| **Sentry 제거** | DSN 미설정으로 완전 비활성. 번들 크기 낭비. 제거 대상: `frontend/src/common/sentry.ts`, `backend/src/common/sentry.ts`, `@sentry/react-native`, `@sentry/nestjs` 패키지 및 import/호출부 | 낮음 |
| **Paddle 연동** | 프로덕션 인증 완료 후 env 교체 필요 (API Key, Webhook Secret, Price IDs, Client Token) | 외부 대기 중 |

---

## 🔐 핵심 불변식 요약

> 전체 45개: `docs/invariants/` — 위반 시 phantom 구독, 보안 취약점, 결제 버그 재발

- **결제**: RC logOut on logout 필수 | server tier authoritative | preflight dual-source | fail-close
- **인증**: isLoggingOut lock | OAuth CSRF nonce (V220) | refresh token AsyncStorage 금지 (V220)
- **UI**: KAV behavior="height" 금지 | Animated cleanup 필수
- **에러**: PII strip before reportError | production fail-fast for required env
