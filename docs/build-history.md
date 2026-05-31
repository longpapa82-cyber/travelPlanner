# Build History

> 현재 버전 및 다음 할 일은 CLAUDE.md 참조

---

## iOS 빌드 이력

| 빌드 | 주요 수정 | 결과 |
|------|----------|------|
| B84 | expo-tracking-transparency userTrackingPermission:false + withRemoveATTDescription 이중 방어로 NSUserTrackingUsageDescription 완전 제거 | **심사 대기 중** ⏳ (2026-05-25) |
| B83 | withRemoveATTDescription 플러그인 추가(CocoaPods 재주입 차단 시도, B84에서 완성) | B84로 대체 |
| B82 | B81 SIGSEGV 크래시 수정 — expo-tracking-transparency 플러그인 재추가(NSUserTrackingUsageDescription 없음 유지) | TestFlight 완료 |
| B81 | NSUserTrackingUsageDescription 제거 + expo-tracking-transparency 플러그인/import 제거 | **크래시** (UIManager::setAnimationDelegate SIGSEGV) |
| B80 | eas.json production-ios channel:production 추가 + PaywallModal planCard padding | OTA channel 수정 |
| B79 | OTA 정상화 — checkAutomatically→ON_LOAD + 포그라운드 체크+reloadAsync. PremiumPromoBanner X버튼 제거 | TestFlight 완료 (1.4.1→1.4.2 버전업) |
| B76 | ATT import 제거 + NSUserTrackingUsageDescription 유지(react-native-google-mobile-ads가 ATTrackingManager 링크) | **App Store 출시** ✅ (2026-05-25, 1.4.1) |
| B74 | 구독 무한로딩 수정 — syncFromRc sandbox 필터 제거 + hidePaywall finally 이동 + subscriptionStartedAt 저장 | TestFlight 완료 |
| B73 | sync-from-rc 컨트롤러 @Req()→@CurrentUser('userId') 수정 + 인사이트 영상 isLegitimateError 제거 | TestFlight 완료 |
| B65 | iOS 구독 직후 free 표시 버그(finalizePurchase premature refreshStatus 제거) + common.close 번역 누락 수정 | **App Store 출시** ✅ (2026-05-22) |
| B63 | AdMobBanner 빈 공간 숨김(height:0) + useCallback 안정화 | 심사 취소 → B65로 대체 |
| B62 | SharedTrip 재진입 버그(_initialURLConsumed) + 탭 헤더 통일 5개 화면 | **App Store 출시** ✅ (2026-05-21) |
| B60 | 여행 공유 딥링크(/share) + SharedTripViewScreen 디자인 + 마케팅 URL 등록 | 심사 통과 후 B62로 대체 |
| B58 | timezoneOffset int→real + 폴링 15s + Apple Sign-In 이름 버그 수정 | **App Store 출시** ✅ (2026-05-19) |
| B57 | AI 배치8, 지연제거, 실시간 진행률 | TestFlight 완료 |
| B56 | iOS AdMob 광고 단위 ID 실제값으로 교체 | TestFlight 완료 |
| B55 | iOS AdMob 활성화 (non-personalized) | TestFlight 완료 |
| B54 | 구매 완료 후 에러 메시지 표시 근본 해결 (hidePaywall 즉시 호출) | **App Store 정식 출시** ✅ (2026-05-16) |
| B53 | offerings.all 폴백 + i18n 17개 언어 | **거절** (Guideline 2.1b) |
| B52 | prefetchOfferings 사전 로딩 + cachedOfferings 캐시 우선 참조 | TestFlight 완료 (심사 취소) |
| B51 | iosAppId 복원 + IAP 자동 재시도 | **거절** (Guideline 2.1b — IAP cold-start null) |
| B50 | iosAppId 제거 시도 | **크래시** (GADApplicationIdentifier 소멸) |
| B37 | 스플래시 아이콘 박스 제거 | **거절** (5.1.2i UMP팝업 + 2.1b IAP에러) |
| B35 | ATT 완전 제거 (npm uninstall + Podfile 패치) | TestFlight 완료 |
| B34 | 게스트 모드 + IAP 함께 제출 | **거절** (ATT 프레임워크 감지) |
| B33 | 암호 저장 팝업·오프라인 플래시·ATT 잔존물 수정 | **거절** (Guideline 2.1b — IAP 미제출) |
| B27~B29 | RevenueCat iOS 키, Apple 로그인 버그 수정 | **거절** (Guideline 2.1a/b) |

### iOS 불변식 (위반 시 크래시/거절)
- `react-native-google-mobile-ads` 플러그인의 `iosAppId` **절대 제거 불가** → `GADApplicationIdentifier` 소멸 → 앱 시작 즉시 강제종료
- iOS 광고/UMP 비활성화는 JS 레이어에서만 (`Platform.OS === 'ios'` 분기)
- ATT 재도입 시 프레임워크 설치 + 실제 권한 요청 코드 모두 필요 (프레임워크만 있으면 거절)

### iOS 광고 수익 모델 (미적용)
- 현재: iOS 광고 비활성화 (`initAds.native.ts` `if (Platform.OS === 'ios') return`)
- 옵션 1 (권장): ATT 재도입 → 동의 시 개인화 광고, 거부 시 non-personalized
- 옵션 2: ATT 없이 `npa=1` non-personalized만 (수익 낮지만 정책 안전)

---

## Android 빌드 이력

| versionCode | 주요 내용 | 상태 |
|-------------|----------|------|
| 289 | 하단 OS 네비바 ↔ 앱 탭바 색상 동기화 (expo-navigation-bar + App.tsx useEffect, 라이트#FFFFFF/다크#1E293B) | **알파 출시** ✅ (2026-05-28) |
| 287 | 파란 배경 깜빡임 수정 (edgeToEdgeEnabled:false + windowBackground=#FFFFFF). ⚠️ Android 16+(targetSdk 36)서 무시됨 | 알파 제출 (2026-05-25) |
| 286 | 구독 무한로딩 수정 + 카카오 로그인 개선 (공통 코드) | **프로덕션 출시 신청** (2026-05-24) |
| 283 | 카카오 로그인 수정 — Chrome Custom Tab 파괴 → HTTPS App Links 전환 | 알파 완료 ✅ (2026-05-23) |
| 282 | iOS 구독 버그 수정 포함 (공통 코드) | **프로덕션 출시** ✅ (2026-05-22) |
| 281 | 스플래시 파란 배경 복원(#4A90D9) + AI 중복 장소 수정(usedLocations 주입) | 알파 완료 ✅ |
| 280 | 빈 파란색 화면 제거 (3레이어: windowBackground + App.tsx + RootNavigator) | 알파 완료 ✅ |
| 260 | 스플래시 점프/뒤로가기 2개/오프라인 오탐/콜드스타트 딥링크 + AdMobBanner 빈공간 | 알파 완료 ✅ |
| 253 | App Links 자동검증 수정 (intentFilters 커스텀스킴/AppLinks 분리) | 알파 완료 ✅ |
| 252 | 헤더 통일 + SharedTrip 재진입 버그 수정 | 알파 완료 ✅ |
| 248 | 카카오 로그인 버그 수정 (prompt:login 제거) | **프로덕션 출시** ✅ (2026-05-19) |
| 246 | AI 배치8, 지연제거, 실시간 진행률 | 알파 완료 ✅ |
| 240 | 첫 설치 스플래시 아이콘 미표시 근본 해결 (rAF 2회 + initializeAds 비블로킹) | 알파 완료 ✅ |
| 220 | 프로덕션 제출 버전 | 출시 완료 |

---

## 서버 배포 이력

| 차수 | 주요 내용 | 날짜 |
|------|----------|------|
| 34차 | 수익 대시보드 Sandbox 결제 제외 (subscriptionIsSandbox 컬럼 + webhook 저장 + 대시보드 필터) | 2026-05-22 |
| 33차 | AI 중복 장소 수정 (usedLocations[] 배치 간 누적 주입) | 2026-05-21 |
| 32차 | 카카오 로그인 prompt:login 제거 | 2026-05-19 |
| 31차 | Apple Sign-In privaterelay 이메일→이름 저장 버그 수정 | 2026-05-18 |
| 30차 | 모바일 설치 UX 버그 수정 (iOS 배너 중복·Android PWA 아이콘·nginx 캐시) | 2026-05-17 |
| 29차 | 전체 59개 HTML 이모지→SVG 마이그레이션 | 2026-05-17 |
| 28차 | 웹사이트 법적 정확성 수정 + 디자인 통일 | 2026-05-17 |
| 27차 | 수익 대시보드 테스트 계정(hoonjae723@gmail.com) 제외 | — |
| 25차 | AdSense 영문 가이드 5개 + sitemap | — |
| 24차 | 비용 최적화 59% 절감 (날씨TTL 6h, 템플릿 90일) | — |
| 21차 | XSS 방지, WCAG AA, RTL Arabic | — |
