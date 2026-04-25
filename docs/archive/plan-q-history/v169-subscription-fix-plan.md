# V169 구독(결제) 상태 동기화 버그 — Plan-Q 전수 계획

**작성일**: 2026-04-24
**작성자**: plan-q (strategic planning agent)
**대상 버전**: V169 Alpha → V170+ 프로덕션
**우선순위**: P0 (CRITICAL — 중복 결제 가능성, 수익 직결, 고객 환불 리스크)

---

## 0. Executive Summary

V169 Alpha 테스트에서 발견된 5개 증상은 **단일 근본 원인의 복합 발현**이다.
근본 원인은 **"진실 소스(source of truth) 우선순위 미확립 + 구매 UI의 가드 부재"** 두 축으로 압축된다.

1. **PremiumContext의 병합 로직은 `isPremium` boolean만 게이팅**하고, `planType`/`expiresAt` 같은 **상세 필드는 서버 전용**으로 설계되어 있다. 따라서 RevenueCat은 "구독 있음"이라 해도 서버 webhook이 누락되면 `planType=undefined`가 되어 [프로필] 메뉴에서 "구독 안됨"으로 표기된다.
2. **PaywallModal / SubscriptionScreen 어디에도 `isPremium=true`일 때 구매 버튼을 비활성화하는 가드가 없다.** RevenueCat 자체는 동일 productId 중복 구매를 막지만, 월간→연간 같은 **다른 productId 교차 구매는 SDK 레벨에서 허용**되므로 UI가 반드시 막아야 한다.
3. "미구독 → 갑자기 월간 구독됨"은 `addCustomerInfoUpdateListener`가 **delayed로 발화**하면서 `localPremiumOverride=true`를 세팅하는 타이밍 이슈. Google Play License Tester의 5분 갱신 주기 + SDK 캐시 지연이 겹치면 앱에서 "구매 버튼을 누른 적 없는데 구독 활성화" 현상이 나타난다.

**P0 수정 (출시 전 필수)**: 구매 UI 가드 추가, 구독 상태 UI 단일 진실 소스 확정, RevenueCat entitlement → UI 필드 직접 매핑 (서버 webhook 지연 내성).

**검수 전략**: 단위 테스트 (PremiumContext 상태 전이 15개 시나리오) + 통합 테스트 (결제→webhook→UI) + 수동 QA 체크리스트 (3가지 구독 상태 × 3가지 결제 시도 = 9개 매트릭스).

---

## 1. Phase 1 — 근본 원인 분석 (RCA)

### 1.1 구독 상태의 3개 진실 소스 맵핑

| 소스 | 위치 | 갱신 시점 | 지연 특성 | 포함 필드 |
|------|------|----------|----------|----------|
| **A. RevenueCat SDK** | `customerInfo.entitlements.active` | 구매 즉시, listener, foreground 복귀 | 로컬 캐시 최대 ~5분 stale | entitlement ID, productIdentifier, expirationDate |
| **B. localPremiumOverride** | React state (PremiumContext) | markPremium() 호출 시 | 앱 종료 시 사라짐 (휘발성) | boolean only |
| **C. 서버 DB (user)** | `user.subscriptionTier/ExpiresAt/PlanType` | RevenueCat webhook 수신 후 | 웹훅 지연 수초~수분 | **tier, expiresAt, planType, platform, startedAt** |

### 1.2 5개 증상 → 근본 원인 매핑

| # | 증상 | 근본 원인 | 증거 |
|---|------|----------|------|
| **1** | 프로필 메뉴에서 "구독 안됨" 표기 | **웹훅 지연 시 `user.subscriptionTier='free'` 잔존** → ProfileScreen이 `isPremium=false`로 판정. 단, `localPremiumOverride=true`가 있으면 `isPremium=true`지만, PremiumContext L243의 `subscriptionTier: isPremium ? 'premium' : 'free'` 파생이 프로필 메뉴 렌더에 도달하기 전의 **초기 렌더 경쟁 조건** | `PremiumContext.tsx:186-197` isPremium 계산, `:239` value memo 의존성 |
| **2** | 구독 버튼 눌렀을 때 구독 안내가 또 표기 | SubscriptionScreen은 `isPremium`만 보고 UI 분기 (`SubscriptionScreen.tsx:72`). `planType/expiresAt`이 **서버에서만 오기** 때문에 `localPremiumOverride=true`여도 "업그레이드 카드"가 표시되는 경우 없지만, `planType=undefined`일 때 L90~99의 plan-type 메타 섹션이 렌더되지 않아 **"구독 활성 맞는데 정보가 없네?" UX 혼란** 유발 | `SubscriptionScreen.tsx:89-99, 110-137` |
| **3** | "갑자기 이미 월간 결제되어 있다고 표기됨" | **`addCustomerInfoUpdateListener` 발화 지연** → foreground 복귀 시점의 `getCustomerInfo()`가 이전 세션의 entitlement를 반환 → `setLocalPremiumOverride(true)`. 사용자가 결제를 시도한 적 없거나 이전 테스트 구매의 잔재가 남아있는 상태 | `PremiumContext.tsx:116-123, 140-160` |
| **4** | 년간 결제 시도 시 년간 상품이 결제됨 | **정상**. 단, `isPremium=true`(월간 활성) 상태에서도 년간 구매 버튼이 활성화되어 있어 **의도된 것인지 사용자 인지 가능한지 불명확** | `PaywallModal.tsx:315-330` (버튼 가드 없음) |
| **5** | 이미 년간 결제됨 표기 시 월간 결제 시도 → 월간 결제 가능 | **중복 결제 가능**. RevenueCat은 동일 productId 재구매는 막지만, 다른 productId (monthly vs yearly)는 허용. UI에서 `isPremium`일 때 PaywallModal 진입 자체를 차단해야 함 | `PaywallModal.tsx:137-152` handlePurchase, **가드 전무** |

### 1.3 RCA 결론

**하나의 근본 원인인가?** → **아니오. 2개 근본 원인의 5개 증상.**

- **근본 원인 A (상태 동기화)**: 서버 webhook 지연 + localPremiumOverride의 boolean-only 표현력 → 증상 1, 2, 3.
- **근본 원인 B (UI 가드 부재)**: `isPremium` 체크 없이 paywall 진입 가능 → 증상 4, 5 (특히 5는 **중복 결제 = 환불 리스크 = P0**).

### 1.4 상태 전이 타임라인 재구성 (증상 3 "갑자기 월간 결제됨")

```
T0:  사용자 로그인 (구독 없음, user.subscriptionTier='free')
     → localPremiumOverride=false, isPremium=false ✅
T1:  RevenueCat initRevenueCat() 호출
T2:  getCustomerInfo() 반환 → entitlements.active={} → no override ✅
T3:  (사용자가 SubscriptionScreen 진입, "구독 안됨" 표기) ✅
T4:  사용자가 앱 백그라운드 전환
T5:  앱 foreground 복귀 → AppState 리스너 발화 (PremiumContext.tsx:140)
T6:  getCustomerInfo() 호출 → **RevenueCat SDK가 이전 테스트 구매 캐시 반환**
     → entitlements.active={'premium': {productIdentifier: 'premium_monthly'}}
T7:  setLocalPremiumOverride(true) ← BUG: 서버 확인 없이 즉시 premium으로 전환
T8:  UI가 "월간 구독 중"으로 갑자기 바뀜 ❌

→ 근본 원인: T6의 SDK 캐시를 "신뢰할 수 있는 구매 증거"로 취급.
   서버 webhook 도달 전에는 **UI 전환을 유예**해야 함.
```

### 1.5 중복 결제 가능 시나리오 (증상 5, P0)

```
T0:  사용자가 월간 구독 활성 (서버+RC 모두 confirmed)
T1:  사용자가 [프로필] → [구독 관리] 진입, isPremium=true ✅
T2:  [구독 관리] 화면은 "플랜 관리" 버튼만 표시 (SubscriptionScreen.tsx:280-284) ✅
T3:  **그러나 다른 진입점에서 showPaywall() 호출 가능**:
     - CreateTripScreen에서 AI 한도 초과 시 showPaywall('ai_limit')
     - PremiumPromoBanner 클릭
     - 홈 화면의 프로모 유도 버튼
T4:  PaywallModal이 `isPremium=true`에도 구매 버튼 활성화 ❌
T5:  사용자가 "연간" 선택 → 결제 진행
T6:  RevenueCat purchasePackage() → Google Play가 기존 월간 구독과 다른 productId이므로 허용
T7:  연간 구독 추가 결제됨 → 월간 + 연간 동시 활성 → **환불 요청 필연**
```

### 1.6 V155/V159/V165에서 수정했던 이력과 회귀 가능성

| 버전 | 수정 내용 | V169 증상과의 관계 |
|------|---------|-------------------|
| V155 | 구독 만료 reconciliation effect 추가 (서버가 `free` 또는 `expiresAt` 과거면 localPremiumOverride 클리어) | 본 계획과 **직교**. 유지. |
| V159 | 14) Animated cleanup 원칙 / 13) Android KAV 금지 | 본 계획과 **무관**. |
| V165 | AppState foreground 복귀 시 RevenueCat 재조회 추가 | **증상 3의 직접 원인**. 본 계획에서 수정 대상. |

**회귀 위험**: V165의 foreground 재조회 로직을 그대로 두면 "SDK 캐시 기반 premium 전환" 문제가 재발한다. V155의 reconciliation effect는 `localPremiumOverride=true` 이후에만 동작하므로, T7 시점의 false-positive를 막지 못한다.

---

## 2. Phase 2 — 수정 계획

### 2.1 우선순위 매트릭스 (RICE)

| ID | 항목 | Reach | Impact | Confidence | Effort | RICE Score | 우선순위 |
|----|------|-------|--------|-----------|--------|-----------|---------|
| F1 | 구매 UI 가드 (isPremium이면 구매 차단) | 100% | 10 (중복 결제 차단) | 100% | 1 day | **1000** | **P0** |
| F2 | PremiumContext: RC entitlement → planType/expiresAt 직접 매핑 | 100% | 8 (UI 일관성) | 90% | 1.5 day | **480** | **P0** |
| F3 | foreground 재조회: 서버 확인 선행 | 60% | 7 (증상 3 차단) | 80% | 1 day | **336** | **P1** |
| F4 | /subscription/status 폴링 트리거 (구매 직후) | 100% | 6 (webhook 지연 내성) | 90% | 1 day | **540** | **P0** |
| F5 | 단위 테스트 / 통합 테스트 | 100% | 5 (회귀 방지) | 100% | 2 day | **250** | **P1** |
| F6 | Sentry breadcrumb: 구독 상태 전이 로그 | 100% | 4 (디버깅 가시성) | 100% | 0.5 day | **800** | **P1** |

### 2.2 P0 수정사항 — 파일/함수/라인 단위

#### F1: 구매 UI 가드 (중복 결제 차단) — **즉시 수정**

**파일**: `frontend/src/components/PaywallModal.tsx`

**변경점 1 — handlePurchase 진입 가드 (L107)**:
```tsx
const handlePurchase = async () => {
  // V169 불변식 #16: 이미 premium인 사용자는 재구매 차단.
  // RevenueCat은 동일 productId만 차단하므로 monthly→yearly 교차 구매가
  // SDK 레벨에서 허용됨. UI에서 반드시 가드.
  if (isPremium) {
    Alert.alert(
      t('paywall.alreadySubscribedTitle', { defaultValue: '이미 구독 중입니다' }),
      t('paywall.alreadySubscribedBody', {
        defaultValue: '플랜 변경은 스토어 구독 관리에서 진행해주세요.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('actions.manage'),
          onPress: () => {
            hidePaywall();
            // Linking.openURL(...) 구독 관리 URL
          },
        },
      ]
    );
    return;
  }
  // ... 기존 로직
};
```

**변경점 2 — Subscribe 버튼 비활성화 표시 (L315)**:
```tsx
<TouchableOpacity
  style={[styles.subscribeButton, (isPurchasing || isPremium) && styles.subscribeButtonDisabled]}
  onPress={handlePurchase}
  disabled={isPurchasing || isPremium}
  ...
>
  {isPremium ? (
    <Text style={styles.subscribeButtonText}>
      {t('paywall.alreadySubscribed', { defaultValue: '이미 구독 중' })}
    </Text>
  ) : isPurchasing ? (
    <ActivityIndicator color="#FFF" />
  ) : (
    <Text style={styles.subscribeButtonText}>{t('promo.cta')}</Text>
  )}
</TouchableOpacity>
```

**변경점 3 — showPaywall 진입 가드 (PremiumContext.tsx:217)**:
```tsx
const showPaywall = useCallback((context: PaywallContext = 'general') => {
  if (!PREMIUM_ENABLED) return;
  // V169 #16: premium 사용자는 paywall 대신 구독 관리 화면으로 라우팅.
  // AI limit context에서도 premium이라면 이미 30개/월 한도라 limit hit 무의미.
  if (isPremium) {
    // 구독 관리 화면으로 네비게이트 — 호출부에서 처리하도록 훅만 추가
    return;
  }
  setPaywallContext(context);
  setIsPaywallVisible(true);
}, [isPremium]);
```

#### F2: PremiumContext RC entitlement → planType/expiresAt 직접 매핑

**파일**: `frontend/src/contexts/PremiumContext.tsx`

**설계 변경**:
- `localPremiumOverride: boolean` → **`rcEntitlement: RCEntitlementSnapshot | null`**
- 스키마: `{ productId: string, planType: 'monthly'|'yearly', expiresAt: string, platform: 'ios'|'android' }`
- `planType`/`expiresAt`는 **서버 우선, RC fallback**으로 병합.

**새로운 병합 규칙 (단일 진실 소스 계층)**:
```
Priority 1: 서버 확정 상태 (user.subscriptionTier='premium' AND expiresAt > now)
  → 서버 값 그대로 사용 (planType, expiresAt, platform)
Priority 2: RC entitlement 활성 AND 최근 markPremium() 호출
  → RC 값으로 UI 즉시 반영 (purchase completion latency 내성)
Priority 3: 둘 다 없음
  → free
```

**구현 (L75, L106, L186 영역 전체 리팩터)**:
```tsx
interface RCEntitlementSnapshot {
  productId: string;
  planType: 'monthly' | 'yearly';
  expiresAt: string;
  platform: 'ios' | 'android';
  source: 'purchase' | 'restore' | 'foreground-sync';
}

const [rcEntitlement, setRcEntitlement] = useState<RCEntitlementSnapshot | null>(null);

function extractSnapshot(info: CustomerInfo, source: RCEntitlementSnapshot['source']): RCEntitlementSnapshot | null {
  const active = info?.entitlements?.active?.['premium'];
  if (!active) return null;
  const productId = String(active.productIdentifier || '').toLowerCase();
  const planType: 'monthly' | 'yearly' = productId.includes('year') ? 'yearly' : 'monthly';
  return {
    productId,
    planType,
    expiresAt: active.expirationDate || new Date(Date.now() + 30 * 86400000).toISOString(),
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    source,
  };
}

// isPremium 병합 — 서버 우선, RC는 서버 최신화되기 전의 bridge 역할만
const isPremium = useMemo(() => {
  if (isLoggingOut) return true;

  // 서버가 확정한 premium 상태가 있으면 그것이 진실
  const serverPremium =
    user?.subscriptionTier === 'premium' &&
    (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date());
  if (serverPremium) return true;

  // 서버가 free지만 방금 구매하여 서버 webhook 대기 중일 수 있음
  // rcEntitlement.source === 'purchase'만 신뢰 (foreground-sync는 아래 F3에서 별도 처리)
  if (rcEntitlement && rcEntitlement.source === 'purchase') {
    if (new Date(rcEntitlement.expiresAt) > new Date()) return true;
  }

  return false;
}, [user?.subscriptionTier, user?.subscriptionExpiresAt, rcEntitlement, isLoggingOut]);

// UI 메타 필드 — 서버 우선, RC fallback
const displayPlanType = user?.subscriptionPlanType ?? rcEntitlement?.planType;
const displayExpiresAt = user?.subscriptionExpiresAt ?? rcEntitlement?.expiresAt;
const displayPlatform = user?.subscriptionPlatform ?? rcEntitlement?.platform;
```

#### F4: 구매 직후 /subscription/status 폴링 (webhook 지연 내성)

**파일**: `frontend/src/components/PaywallModal.tsx` handlePurchase (L138)

```tsx
setIsPurchasing(true);
try {
  const customerInfo = await purchasePackage(pkg);
  if (customerInfo) {
    // RC 스냅샷 즉시 주입
    markPremiumWithSnapshot(extractSnapshot(customerInfo, 'purchase'));

    // Webhook 지연 대비: 최대 15초 동안 1초 간격으로 서버 상태 폴링
    // 서버가 premium으로 반영되는 즉시 루프 종료
    const polled = await pollServerSubscriptionUntilPremium({
      timeoutMs: 15000,
      intervalMs: 1000,
      refresh: refreshStatus,
    });

    if (!polled) {
      // 서버 반영 실패했지만 RC는 성공 — 로컬 스냅샷으로 UI 유지
      // Sentry에 webhook 지연 보고 (F6)
      reportWebhookDelay({ userId: user?.id, planType: selectedPlan });
    }
    hidePaywall();
  }
}
```

**새 헬퍼**: `frontend/src/utils/subscriptionPolling.ts`
```tsx
export async function pollServerSubscriptionUntilPremium({
  timeoutMs,
  intervalMs,
  refresh,
}: {
  timeoutMs: number;
  intervalMs: number;
  refresh: () => Promise<void>;
}): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await refresh();
    // AuthContext user가 업데이트되었는지는 외부 state에서 확인 불가
    // → refresh의 반환값 또는 checkPremiumStatus API 콜을 별도로 확인
    const status = await apiService.getSubscriptionStatus();
    if (status?.isPremium && status?.planType) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
```

### 2.3 P1 수정사항

#### F3: Foreground 재조회 — 서버 확인 선행

**파일**: `frontend/src/contexts/PremiumContext.tsx` L134-163

**변경 전**:
```tsx
if (hasActive && !localPremiumOverride) {
  setLocalPremiumOverride(true);  // ← SDK 캐시만 보고 즉시 premium
}
```

**변경 후**:
```tsx
const subscription = AppState.addEventListener('change', async (nextState) => {
  if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
    try {
      // 1. 서버 상태 먼저 refresh — 진실 소스 우선
      await refreshUser?.();

      // 2. RC도 체크하되 source='foreground-sync'로 표시
      //    서버와 교차 검증된 경우에만 rcEntitlement 세팅
      const info = await getCustomerInfo();
      const snapshot = extractSnapshot(info, 'foreground-sync');
      if (snapshot) {
        // 서버가 이미 premium이면 일관됨 → 단순히 캐시
        // 서버가 free인데 RC만 active면 webhook 대기 중 → 기록만, isPremium 반영은 X
        setRcEntitlement(snapshot);
      } else {
        setRcEntitlement(null);
      }
    } catch { /* silent */ }
  }
  appStateRef.current = nextState;
});
```

**핵심 차이**: `source='foreground-sync'`는 `isPremium` 계산에 **영향 없음**. 오직 `source='purchase'`만 서버 지연 bridge로 인정.

#### F6: Sentry breadcrumb — 구독 상태 전이 가시성

**파일**: `frontend/src/contexts/PremiumContext.tsx` (각 setter에 breadcrumb 추가)

```tsx
import { addBreadcrumb } from '../services/sentry';

// useEffect dependency에 isPremium 추가해서 전이 감지
useEffect(() => {
  addBreadcrumb({
    category: 'subscription',
    message: `isPremium=${isPremium}`,
    data: {
      serverTier: user?.subscriptionTier,
      serverExpiresAt: user?.subscriptionExpiresAt,
      rcSource: rcEntitlement?.source,
      rcPlanType: rcEntitlement?.planType,
      rcExpiresAt: rcEntitlement?.expiresAt,
    },
    level: 'info',
  });
}, [isPremium, user?.subscriptionTier, rcEntitlement?.source]);
```

### 2.4 새로 추가할 불변식 (V137 불변식 1~12, V159 불변식 13~15에 이어)

**#16 — 단일 진실 소스 계층 원칙**:
> 구독 상태(`isPremium`)의 진실 소스 우선순위는 **서버 > RevenueCat(구매 source) > 없음** 순이다.
> RC의 `source='foreground-sync'` 또는 `source='restore'`는 서버 확인 **전까지는** `isPremium`에 영향을 주지 않는다.
> **Why**: SDK 캐시가 과거 테스트 구매의 잔재를 반환할 수 있어, 서버 webhook 없이 RC만 믿고 premium 전환 시 false-positive 발생. (증상 3의 근본 원인)
> **How to apply**: PremiumContext의 `isPremium` useMemo에서 `rcEntitlement.source` 체크 필수.

**#17 — Paywall 진입/구매 이중 가드 원칙**:
> `isPremium=true` 상태에서는 (a) `showPaywall()` 자체가 no-op, (b) PaywallModal이 열려도 `handlePurchase`가 차단되며 "이미 구독 중" Alert 노출.
> **Why**: RevenueCat SDK는 동일 productId 재구매만 막고, monthly/yearly 교차 구매는 허용함. UI에서 이중 가드하지 않으면 중복 결제 발생 = 환불/분쟁 리스크. (증상 5의 근본 원인)
> **How to apply**: 신규 paywall 진입점 추가 시 `usePremium().isPremium` 체크 의무.

**#18 — 구매 직후 서버 폴링 원칙**:
> RevenueCat 구매 성공 시 `pollServerSubscriptionUntilPremium()` (최대 15초, 1초 간격)으로 서버 상태 동기화를 확인한다. 서버가 premium으로 전환되지 않으면 Sentry에 webhook 지연으로 보고.
> **Why**: 서버 webhook 전달 실패/지연 시 사용자는 돈만 내고 premium 혜택을 못 받는 최악의 UX 발생. RC 캐시만 믿으면 앱 종료 후 잔류 없음. (증상 1, 2의 webhook 지연 원인 보완)
> **How to apply**: 모든 `purchasePackage()` 성공 분기 뒤에 폴링 필수.

### 2.5 변경 파일 요약

| 파일 | 변경 유형 | 예상 lines 변경 |
|------|----------|--------------|
| `frontend/src/contexts/PremiumContext.tsx` | 대규모 리팩터 (병합 로직) | ~80 |
| `frontend/src/components/PaywallModal.tsx` | 구매 가드 + 폴링 | ~40 |
| `frontend/src/utils/subscriptionPolling.ts` | **신규** | ~35 |
| `frontend/src/services/api.ts` | getSubscriptionStatus 메소드 | ~15 |
| `frontend/src/screens/main/SubscriptionScreen.tsx` | displayPlanType/ExpiresAt 사용 | ~10 |
| `frontend/src/services/sentry.ts` | addBreadcrumb helper (이미 있으면 skip) | 0~20 |
| **총계** | | **~180 lines** |

---

## 3. Phase 3 — 검수 계획 (수정 검증)

### 3.1 단위 테스트 — PremiumContext 상태 전이 (15개 시나리오)

**파일**: `frontend/__tests__/contexts/PremiumContext.test.tsx` (신규)

| # | 시나리오 | 초기 상태 | 이벤트 | 기대 결과 |
|---|---------|----------|-------|----------|
| U1 | 미구독 초기 | server=free, rc=null | mount | isPremium=false, planType=undefined |
| U2 | 서버 premium만 확정 | server=premium(monthly, +30d), rc=null | mount | isPremium=true, planType='monthly' |
| U3 | RC purchase 직후 서버 아직 free | server=free, rc=purchase(yearly) | mount | **isPremium=true**, planType='yearly' |
| U4 | RC foreground-sync만 (서버 free) | server=free, rc=foreground-sync(monthly) | mount | **isPremium=false** ← F3 가드 |
| U5 | 서버 premium + RC 일치 | server=premium(yearly), rc=purchase(yearly) | mount | isPremium=true, planType='yearly' |
| U6 | 서버 premium + RC 불일치 (서버 우선) | server=premium(monthly), rc=foreground-sync(yearly) | mount | isPremium=true, planType='**monthly**' ← 서버 우선 |
| U7 | 서버 free + RC 만료 | server=free, rc=purchase(yearly, expiresAt=past) | mount | isPremium=false |
| U8 | 서버 expires 과거 | server=premium(monthly, expiresAt=past), rc=null | mount | isPremium=false |
| U9 | V155 reconciliation: 서버 expired | rc=purchase(monthly), server=free | after refresh | isPremium=false, rcEntitlement cleared |
| U10 | 구매 플로우: markPremium + poll 성공 | server=free, call markPremium(snap) | 서버가 2초 후 premium 반영 | 중간: isPremium=true(RC), 최종: isPremium=true(server) |
| U11 | 구매 플로우: poll 타임아웃 | server=free, markPremium 후 15초 서버 미반영 | 15초 경과 | isPremium=true(RC 유지), Sentry 보고됨 |
| U12 | 로그아웃 전환 | server=premium, markLoggingOut() | | isPremium=true (광고 억제) |
| U13 | 로그아웃 완료 | user=null | | isPremium=false, rcEntitlement=null |
| U14 | Foreground 복귀, 서버 premium 없음 | server=free, AppState change | | 서버 refresh 호출됨, rcEntitlement.source='foreground-sync' but isPremium=false |
| U15 | Foreground 복귀, 서버 premium 있음 | server=premium, AppState change | | isPremium=true, displayPlanType from server |

**Coverage target**: PremiumContext.tsx 95%+

### 3.2 통합 테스트 — 결제→Webhook→UI 플로우

**파일**: `backend/test/subscription-flow.e2e-spec.ts` (신규)

```typescript
describe('Subscription webhook flow', () => {
  it('INITIAL_PURCHASE monthly → status API reflects planType/expiresAt', async () => {
    // 1. 사용자 생성 (free)
    // 2. RevenueCat webhook POST (INITIAL_PURCHASE, product_id=premium_monthly)
    // 3. GET /subscription/status
    // 4. expect: { tier: 'premium', planType: 'monthly', expiresAt: future }
  });

  it('INITIAL_PURCHASE monthly → RENEWAL yearly (플랜 교차)', async () => {
    // 월간 결제 후 연간으로 PRODUCT_CHANGE webhook 수신 시
    // planType이 yearly로 업데이트되는지 검증
  });

  it('EXPIRATION 후 isPremium=false', async () => {
    // EXPIRATION webhook 수신 → status API에서 tier=free 반환
  });

  it('중복 결제 시나리오 방지: premium 상태의 재결제 webhook', async () => {
    // 월간 premium 상태에서 연간 INITIAL_PURCHASE webhook 받을 때
    // → planType='yearly'로 업데이트되고 expiresAt 갱신 (PRODUCT_CHANGE와 동등 취급)
  });
});
```

### 3.3 수동 QA 체크리스트

**환경**: Google Play License Tester (5분 갱신 주기), Alpha 트랙 빌드

#### Matrix A: 구독 상태별 UI 정확성 (각 20초 이내 로딩 완료 기대)

| 상태 | [프로필] 메뉴 | [구독] 화면 상단 카드 | [구독] 플랜 메타 |
|------|--------------|---------------------|----------------|
| 미구독 | "업그레이드" 프로모 배너 | "프로 구독 시작하기" (주황색 카드) | "이전 구독 정보" 섹션 없음 |
| 월간 구독 중 | PremiumBadge + "프리미엄" | 왕관 카드 + "월간 플랜" + 다음 결제일 | planType=월간, expiresAt 표시 |
| 연간 구독 중 | PremiumBadge + "프리미엄" | 왕관 카드 + "연간 플랜" + 다음 결제일 | planType=연간, expiresAt 표시 |

#### Matrix B: 구매 시도 가드 (9개 케이스)

| 현재 상태 \ 시도 | 월간 구매 | 연간 구매 | Restore |
|----------------|----------|----------|---------|
| 미구독 | ✅ 결제 진행 | ✅ 결제 진행 | "활성 구독 없음" Alert |
| 월간 구독 중 | ❌ "이미 구독 중" Alert | ❌ "이미 구독 중" Alert | ✅ 복원 성공 Alert |
| 연간 구독 중 | ❌ "이미 구독 중" Alert | ❌ "이미 구독 중" Alert | ✅ 복원 성공 Alert |

#### Matrix C: 타이밍/경쟁 조건 시나리오

1. **앱 최초 설치 + 구독** → PaywallModal → 결제 완료 → 즉시 UI 반영 (폴링 15초 이내)
2. **구독 활성 상태에서 앱 킬 + 재실행** → foreground에서 isPremium 유지 (서버 premium 확인)
3. **구독 활성 + 백그라운드 10분 + foreground 복귀** → 상태 유지, "갑자기 구독됨" 없음
4. **License Tester 구독 만료 (5분 후)** → foreground 복귀 시 isPremium=false로 전환, 광고 재노출
5. **네트워크 끊김 상태에서 앱 진입** → 캐시된 `user`로 premium 유지, 온라인 복귀 시 refresh
6. **동일 계정 다른 기기 구독 후 현재 기기 foreground** → 서버 premium 반영 (5초 이내 refresh 성공)

#### Matrix D: Sentry 검증

- Sentry 대시보드에서 `category='subscription'` breadcrumb 조회
- 이벤트 전이 로그 순서 확인 (free → foreground-sync → purchase → server-confirmed)
- Webhook 지연 이벤트 (`reportWebhookDelay`) 수집 여부

### 3.4 회귀 테스트 — 기존 기능 영향 없는지 검증

| 기능 | 검증 항목 |
|------|----------|
| AI 여행 생성 한도 | 무료 사용자 3/월, premium 30/월 정확히 표시 |
| 광고 노출 | 무료 사용자 광고 노출, premium 사용자 광고 숨김 |
| 로그아웃 | markLoggingOut → 광고 플래시 없이 로그아웃 |
| 구독 만료 | V155 reconciliation 여전히 동작 (서버 free 전환 시 RC override 클리어) |
| V165 foreground 체크 | 정상 작동하되 isPremium 전환은 서버 우선 |

---

## 4. Phase 4 — 프로덕션 출시 전수 검수 계획

### 4.1 Critical Path 전수 점검 (출시 전 48시간)

1. **신규 회원가입 → 첫 여행 생성 → 구독 → 광고 제거 확인**
   - 이메일 가입 + Google OAuth 2가지 루트
   - 여행 생성 시 광고 노출 → 구독 결제 → 즉시 광고 숨김 (폴링 15초 이내)

2. **기존 premium 사용자 재로그인**
   - 로그아웃 → 재로그인 → [구독] 화면에서 월간/연간/만료일 정확히 표기
   - 여행 생성 시 광고 미노출 유지

3. **구독 관리 URL 연결**
   - [구독] → [플랜 관리] → Google Play 구독 관리 페이지 오픈
   - `package=com.longpapa82.travelplanner` 쿼리 포함 확인

4. **License Tester 5분 갱신 사이클 관찰**
   - 구독 활성 → 5분 대기 → RENEWAL webhook 도달 → expiresAt 자동 갱신

5. **다중 기기 동기화**
   - 기기 A에서 구독 → 기기 B foreground 복귀 → 5초 이내 premium 반영

### 4.2 Regression 위험 영역 (우선 점검)

| V155/V159/V165 수정 영역 | 회귀 가능성 | 점검 방법 |
|------------------------|-----------|----------|
| V155 localPremiumOverride reconciliation | **중** — 병합 로직 리팩터 영향 | U9 단위 테스트 + 만료 시나리오 수동 QA |
| V159 Android KAV 금지 | 낮음 — 무관 영역 | 회귀 테스트 스모크 패스 |
| V165 foreground RC 재조회 | **높음** — 본 계획 F3에서 수정 | Matrix C-3 수동 QA |
| V137 expenses settleUp IDOR | 낮음 | 회귀 테스트 스모크 패스 |

### 4.3 프로덕션 롤아웃 기준

#### Go 기준 (Alpha → Production 트랙 제출)
- [ ] 단위 테스트 U1~U15 전부 PASS
- [ ] 통합 테스트 E2E webhook 플로우 PASS
- [ ] 수동 QA Matrix A, B, C 모두 PASS
- [ ] TypeScript 0 errors (frontend + backend)
- [ ] Jest 기존 435/435 유지 (회귀 없음)
- [ ] Sentry breadcrumb 정상 수집 확인
- [ ] 내부 QA 계정 3개에서 3일간 버그 재발 없음

#### Stop 기준 (롤백 조건, D+3~D+14 모니터링)
| 메트릭 | 임계값 | 대응 |
|-------|-------|------|
| 구독 오류율 (purchase 실패 / 시도) | > 5% | 단계적 롤아웃 중단 |
| 중복 결제 환불 요청 | ≥ 1건 | **즉시 롤백 + 근본 원인 재조사** |
| Sentry webhook 지연 이벤트 | > 10건/일 | 백엔드 webhook 처리 점검 |
| ANR | > 2% | 롤백 |
| 크래시율 | > 1% | 롤백 |
| Google Play 정책 알림 | 발생 시 | 즉시 대응 |

### 4.4 단계적 출시 (Phased Rollout)

| 단계 | 기간 | 대상 | 통과 조건 |
|-----|------|------|----------|
| Alpha (내부 10명) | D-3 ~ D-1 | 수동 QA 팀 | Matrix A/B/C 전체 통과 |
| Production 1% | D+0 ~ D+2 | 일반 사용자 1% | 구독 오류율 < 5%, 중복 결제 0건 |
| Production 5% | D+3 ~ D+5 | 5% | 메트릭 안정 |
| Production 20% | D+6 ~ D+8 | 20% | 메트릭 안정 |
| Production 50% | D+9 ~ D+11 | 50% | 메트릭 안정 |
| Production 100% | D+12 ~ D+14 | 전체 | 완전 전환 |

### 4.5 출시 후 후속 모니터링 대시보드

**추가할 관리자 대시보드 지표**:
1. 일일 신규 구독 수 (monthly / yearly 분리)
2. Webhook 수신율 (RevenueCat 전송 수 vs 서버 처리 성공)
3. 평균 purchase → server premium 반영 지연 (P50/P95/P99)
4. 중복 결제 시도 차단 건수 (F1 가드 동작 확인)
5. `rcEntitlement.source='foreground-sync'` 발생률

---

## 5. 리스크 및 고려사항

### 5.1 알려진 Trade-off

| 결정 | 장점 | 단점 | 완화 |
|------|------|------|------|
| 서버 우선, RC fallback | 단일 진실 소스, 중복 결제 위험 최소 | Webhook 지연 시 구매 직후 UI 지연 가능 | F4 폴링으로 15초 이내 확인 |
| `foreground-sync`를 isPremium에 미반영 | 증상 3 근본 차단 | 다른 기기 구매 후 복귀 시 서버 refresh 타이밍 의존 | refreshUser도 병행 호출 (F3) |
| 15초 폴링 타임아웃 | 사용자 대기 시간 제한 | Webhook 진짜 지연 시 false 보고 가능 | Sentry에 context 포함, 주간 리뷰 |

### 5.2 출시 후 개선 여지 (Phase 2)

1. **WebSocket 실시간 구독 상태 푸시**: 폴링 대신 서버 → 클라이언트 push
2. **구독 교차 변경 (월간→연간 업그레이드)**: 공식 지원 플로우 설계
3. **Google Play Billing 직접 복원 API**: RC 외 안전망
4. **Admin 대시보드 구독 수동 정정**: 극단적 오류 시 관리자 개입 경로

### 5.3 외부 의존성

- **RevenueCat SDK**: 버전 잠금 필요 (package.json ^^ 제거)
- **Google Play Billing**: 정책 변경 알림 구독
- **Sentry**: 구독 관련 breadcrumb 수집 쿼리 저장

---

## 6. 실행 타임라인

| Day | 작업 | 담당 |
|-----|------|------|
| D-5 | F1, F2 구현 + 단위 테스트 (U1~U15) | Dev |
| D-4 | F3, F4, F6 구현 + 통합 테스트 | Dev |
| D-3 | 내부 QA Matrix A/B/C 실행 | QA |
| D-2 | 회귀 테스트 + Sentry 검증 | Dev + QA |
| D-1 | 빌드 V170 + Alpha 업로드 | Dev |
| D+0 | 프로덕션 1% 출시 | Release |
| D+2~D+14 | 단계적 확대 + 메트릭 모니터링 | Release + Dev |

---

## 7. 요약: 3가지 핵심 결정

1. **단일 진실 소스 확정**: 서버 > RC(purchase) > 없음. `foreground-sync`는 UI 전환 근거가 될 수 없다.
2. **이중 UI 가드**: `showPaywall()` + `handlePurchase()` 양쪽에서 `isPremium` 차단. 중복 결제 = P0 리스크.
3. **Webhook 지연 내성**: 구매 직후 15초 폴링 + 실패 시 Sentry 보고. RC 스냅샷은 서버 반영 대기 중 bridge로만 기능.

**불변식 #16, #17, #18** 추가로 향후 회귀 방지.
