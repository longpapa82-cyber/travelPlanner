# 불변식: 구독/결제 (#1~16)

1. **RC logOut on logout**: `AuthContext.logout()`은 반드시 `Purchases.logOut()` dynamic require 호출. 누락 시 phantom 구독.
2. **server isAdmin only**: 프론트엔드 ADMIN_EMAILS fallback 금지. `/auth/me` server `isAdmin` 플래그만 신뢰.
3. **RC SDK userId 추적**: `configuredUserId` 모듈 변수 유지. logOut 시 reset + 새 userId → `Purchases.logIn` 자동 호출.
4. **mount-restore는 server premium gate**: `mount-restore` source는 `subscriptionTier === 'premium'`일 때만 신뢰.
5. **Server tier authoritative for paywall**: RC SDK 신뢰 금지. server tier가 free면 RC가 무엇이든 buy 진행.
6. **결제 성공 → server tier 확인까지 paywall 유지**: `finalizePurchase`는 AWAITED polling. fire-and-forget 금지.
7. **단일 플래그 과부하 금지**: `isAdmin` 플래그가 quota 면제/광고 차단/결제 차단을 동시 게이팅 금지. 각 axis 별도 가드.
8. **TRANSFER 이벤트 처리 필수**: TRANSFER webhook은 null-guard 이전에 early dispatch. `transferred_to` 배열 기반 탐색.
9. **RC webhook 타입별 구조 검증**: TRANSFER에 `app_user_id` 없음. 타입별 페이로드 스키마 RC 공식 문서 확인 필수.
10. **preflight은 dual-source 검증**: (a) DB tier fast path → (b) RC active_entitlements. DB single source 의존 금지.
11. **RC entitlement는 product-agnostic 차단**: 어떤 SKU든 active entitlement → 모든 신규 SKU 차단 (cross-SKU).
12. **DB-RC 불일치는 차단만, reconcile 금지**: "DB free + RC active" → purchase 차단만. DB 강제 overwrite 금지.
13. **결제 차단 메시지는 원인별 분기**: reason enum 3가지 (`already_subscribed`/`rc_entitlement_active`/`verification_unavailable`).
14. **외부 API preflight은 fail-close**: RC API 장애 시 `canPurchase=false`. canPurchase=true 기본값 절대 금지.
15. **탈퇴 시 RC DELETE + $deleted_at 마킹**: `UsersService.remove()`에서 먼저 `$deleted_at` attribute 마킹 후 RC subscriber DELETE. preflightPurchase에서 deleted_at < user.createdAt이면 phantom으로 판정해 통과.
16. **purchasePackage 직전 RC logIn 필수**: `PaywallModal.handlePurchase`에서 `purchasePackage()` 직전 반드시 `Purchases.logIn(userId)`. [V214]
