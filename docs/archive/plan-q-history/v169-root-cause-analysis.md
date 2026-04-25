# V169 Subscription Sync Bug — Root Cause Analysis

Date: 2026-04-24
Analyst: Debugging Specialist (read-only investigation, no code modifications)
Scope: Frontend `PremiumContext` + `PaywallModal` + `SubscriptionScreen` + `ProfileScreen`, backend `SubscriptionService` + `AuthService.getProfile`.

---

## 1. Executive summary

Two **independent** defects combine to produce the five reported symptoms:

1. **Defect A — Missing purchase precondition** (`PaywallModal.handlePurchase`). `purchasePackage` is called without ever checking RevenueCat's *current* active entitlements or Google Play's existing SKU. There is no branch for "user already subscribed" and no `oldSKU`/`replaceProductInfo` path. Result: the user can buy monthly while yearly is active (and vice versa), producing two concurrently active Google Play subscriptions on the same account.
2. **Defect B — Late reveal of server state** (`PremiumContext`). The initial mount effect (`[user?.id]`) is the only place that calls RevenueCat/restorePurchases, and it runs *after* `user` is first populated. Between "user arrived from `/auth/me`" and "RevenueCat finished confirming entitlement", the UI renders `isPremium=false`, because it only consumes `user.subscriptionTier`. If `/auth/me` returns `subscriptionTier='free'` (webhook never landed, or webhook payload did not include `planType`, or the user is on a different device where we never received INITIAL_PURCHASE) the UI will **stay** "not subscribed" until (a) the async RevenueCat round-trip completes, or (b) the foreground AppState effect fires, or (c) `refreshUser()` lands a server update. The "갑자기 월간 결제가 되어 있다" flip is precisely this resolution step firing late.

Symptom 4 (monthly active + yearly purchase succeeds) is a direct consequence of Defect A. Symptom 5 (yearly active + monthly purchase succeeds) is the same defect in the opposite direction.

Neither defect is a regression of the V155 reconciliation work — the reconciliation effect (lines 176–184 of `PremiumContext.tsx`) only handles the *downgrade* race ("server says free, RevenueCat cache says premium"). It does **not** handle the *upgrade* race ("RevenueCat has an active entitlement but server hasn't gotten the webhook / `/auth/me` hasn't been re-fetched"). That is the gap exploited by symptoms 1–3.

---

## 2. Evidence catalogue (file → exact lines)

### 2.1 `frontend/src/contexts/PremiumContext.tsx`

| Lines | What it does | Relevance |
|---|---|---|
| 81–125 | Mount effect keyed only on `user?.id`. Calls `initRevenueCat → logIn → getCustomerInfo → (fallback) restorePurchases → setLocalPremiumOverride(true) → refreshUser()`. Also registers `addCustomerInfoUpdateListener`. | Sole entry point for promoting `localPremiumOverride` to true. Runs **once** per user id, so any later RC state change depends on the listener. |
| 106, 119 | `if (hasActiveEntitlement && !localPremiumOverride) setLocalPremiumOverride(true)` — both inside the mount effect body **and** inside the `addCustomerInfoUpdateListener` callback. | The listener closure was created when `localPremiumOverride===false`. It keeps seeing `false` even after a later set, but this is harmless (it sets to `true` if already `true`). However, **the listener is registered with dependency array `[user?.id]`**, so it never re-registers. The `refreshUser?.()` reference inside the callback is stale relative to AuthContext re-renders — not currently breaking but fragile. |
| 116–123 | Listener body calls `refreshUser?.()` on every RevenueCat push. | Good for refresh, but `refreshUser` here is the AuthContext's identity-unstable function. Because `useEffect` deps are `[user?.id]`, the captured `refreshUser` is the one from first render after login. If AuthContext swaps `refreshUser` identity (it does not memoize — see AuthContext.tsx line 546), the listener still calls the old function, which still works because it closes over the live `apiService`. OK for now but a refactor hazard. |
| 134–163 | AppState foreground effect keyed `[user?.id, localPremiumOverride]`. Re-subscribes every time `localPremiumOverride` changes. | This **is** a subtle bug: every override flip detaches and re-attaches the AppState listener. If the listener is mid-callback when the effect re-runs, the callback still executes against stale state. Not a root cause but adds noise to repro. |
| 140–158 | On foreground, fetches `getCustomerInfo()` only, never `restorePurchases`. Sets override `true` if active; **does not** trigger `refreshUser()` so the server profile stays stale until the next natural fetch. | Contributes to symptom 1: a user who came back from Play Store after buying monthly elsewhere (or after our purchase callback was killed by Android before `refreshStatus()` completed) keeps the `/auth/me` view of `subscriptionTier='free'` until something else hits `refreshUser()`. The subscription feels "hidden" until a seconds-later RC callback wakes up. |
| 176–184 | **Downgrade** reconciliation — clears override when server says expired. | Correct for expiry, but there is **no symmetric upgrade reconciliation**: if `localPremiumOverride===false` and server says `free` but RevenueCat says *active*, nothing in this file re-checks until next mount/foreground. |
| 186–197 | `isPremium` memo: returns `isLoggingOut || localPremiumOverride || (server premium & not expired)`. | This memo is what `ProfileScreen` (line 50) and `SubscriptionScreen` (line 22) read. Both defects collapse through this single gate. |
| 239–259 | Context value includes `expiresAt`, `startedAt`, `planType`, **but only from `user.*`** — never from the RevenueCat `CustomerInfo`. | Symptom 3 ("갑자기 월간 결제가 되어 있다") is exactly this: once the server webhook lands and `refreshUser()` refreshes `user.subscriptionPlanType`, the UI suddenly shows the plan type. Before the webhook, these values are `undefined`. |

### 2.2 `frontend/src/components/PaywallModal.tsx`

| Lines | What it does | Relevance |
|---|---|---|
| 90–105 | Loads `offerings.current.monthly` and `offerings.current.annual` into `packages` state once. | Fine. |
| 107–152 | `handlePurchase`. **Never checks** `isPremium`, `packages.monthly.product.identifier`, or `getCustomerInfo().entitlements.active` before firing `purchasePackage(pkg)`. No `replaceProductInfo`, no `oldProductIdentifier`, no `prorationMode`. | **Primary root cause of symptoms 4 and 5.** Google Play Billing treats `launchBillingFlow` without `oldSkuPurchaseToken` as a **new** subscription. If the user's account already has an active subscription to a *different* SKU in the same group, Play shows a plan-switch dialog **only if** the SDK surfaces `setOldPurchaseToken`. RevenueCat's default `purchasePackage` does **not** pass `oldSKU` unless the caller uses `Purchases.purchaseProduct(productId, { oldSKU, prorationMode })`. Net effect: both subscriptions end up active in Play. |
| 138–145 | `markPremium()` immediately, then `refreshStatus()`, then `hidePaywall()`. | This masks the pre-purchase `isPremium=false` state after a successful buy, but does nothing for the pre-purchase check. |
| 171 | `customerInfo?.entitlements?.active?.['premium']` is checked on **restore** only, never on purchase. | Confirms the missing guard. |

### 2.3 `frontend/src/screens/main/SubscriptionScreen.tsx`

| Lines | What it does | Relevance |
|---|---|---|
| 19–34 | Consumes `usePremium()` only. | Fine. |
| 72–139 | Premium branch: shows plan card, plan type, renewal info. | Dependent on `planType`, `expiresAt`, `startedAt` from `user.*`. **Does not read RevenueCat directly.** So if the backend has not recorded `subscriptionPlanType` yet, the premium card appears *without* the plan type line — and if `subscriptionTier='free'` still, the entire branch is skipped, re-rendering the upgrade CTA (symptom 2). |
| 141–164 | Non-premium branch: `onPress={() => showPaywall()}` — opens PaywallModal with **no guard against an existing active entitlement**. | Secondary enabler of symptoms 4/5: even when RevenueCat's local cache already has an active package, we never call `getCustomerInfo()` here before opening the paywall. |
| 274–284 | Action button: `!isPremium ? cta(showPaywall) : cta(openManageSubscription)`. | Also only switches on `isPremium` from PremiumContext. |

### 2.4 `frontend/src/screens/main/ProfileScreen.tsx`

| Lines | What it does | Relevance |
|---|---|---|
| 50 | `const { isPremium, isServiceAdmin, showPaywall, ... } = usePremium();` | Pulls the same `isPremium` that Defect B produces stale values for. This is why the profile menu reads "구독 안됨" until the late resolution fires. |
| 513–541 | Premium menu item: `onPress={() => isPremium ? navigation.navigate('Subscription') : showPaywall('general')}`. | If `isPremium=false` at tap time, the paywall opens (symptom 2). Without a post-showPaywall active-entitlement check, it continues to allow purchase. |

### 2.5 `frontend/src/services/revenueCat.ts`

| Lines | What it does | Relevance |
|---|---|---|
| 43–51 | `purchasePackage` → `Purchases.purchasePackage(pkg)` with no options. | No hook for passing `oldSKU`/`upgradeInfo`. The raw SDK does accept `purchaseProduct(productId, { oldSKU, prorationMode })` but we never use it. |
| 89–93 | `addCustomerInfoUpdateListener` passes through. | Fine. |

### 2.6 Backend — `backend/src/subscription/subscription.service.ts`

| Lines | What it does | Relevance |
|---|---|---|
| 68–131 | `getSubscriptionStatus` returns `planType`, `startedAt`, `expiresAt`, `tier`, `isPremium`, `isSandbox`. | This **is** complete. |
| 206–217 | `planType` detection is pattern-based on `product_id` / `product_identifier`: contains `'year'` → yearly, contains `'month'` → monthly, else `undefined`. | If the SKU names are `premium_annual` and `premium_monthly`, only the monthly branch hits. **"annual" does not contain "year"** — so an annual purchase triggers `planType=undefined`, and the spread `...(planType && { subscriptionPlanType: planType })` **does not update the field**. User subscribes yearly, but server `subscriptionPlanType` stays at the previous value (or null). This directly explains symptom 3's confusing "월간 플랜" flicker: after a yearly purchase on a freshly provisioned account, the server keeps `planType=null` or inherits a stale `'monthly'` from a prior RC test purchase. |
| 225–234 | `userRepository.update(user.id, { subscriptionTier: PREMIUM, ... })` on INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/UNCANCELLATION. | Writes to DB, but `refreshUser()` on the client must be called **after** the write. The frontend only triggers `refreshUser()` inside the RC listener (line 122) — it is not triggered by a push from the server. So there is always a window of N seconds where the client's `/auth/me` is stale. |
| 298–321 | `isPremiumUser` caches to Redis with 5-minute TTL. | Not directly related but means the server itself can serve stale FREE to `/subscription/status` callers until cache expiry. The client doesn't call `/subscription/status` at the moment (it calls `/auth/me`), so this cache is mostly invisible to the bug, **but** `restoreSubscription` (line 323) clears the cache and re-reads DB — confirming that any path consuming `isPremiumUser` may still hit stale data until TTL. |

### 2.7 Backend — `backend/src/auth/auth.service.ts`

| Lines | What it does | Relevance |
|---|---|---|
| 425–443 | `getProfile` returns `subscriptionTier`, `subscriptionPlatform`, `subscriptionExpiresAt`, `subscriptionStartedAt`, `subscriptionPlanType`, `aiTripsUsedThisMonth`. | All five fields **are** in the payload. Frontend `User` type (types/index.ts:13–17) matches. No field drop. The stale data here is always *DB-stale*, not *serialization-stale*. |

### 2.8 Backend — `backend/src/subscription/dto/revenuecat-webhook.dto.ts`

| Lines | What it does | Relevance |
|---|---|---|
| 9–16 | Loosely typed `event: Record<string, any>`. | Forwards everything to service. No validation, no schema for `product_id` vs. `product_identifier` inconsistency. If RC sends `product_identifier` only, line 207 picks it up — OK. If the SKU is `premium_annual` (no "year"), `planType` is lost (Defect in service, not DTO). |

---

## 3. State transition diagram

```
                      ┌────────────────────────────────────┐
                      │  App cold-start, user logs in      │
                      └────────────────┬───────────────────┘
                                       ▼
              ┌──────────────────────────────────────────────┐
              │ T0   setUser(authResponse.user)              │
              │      → user.subscriptionTier MAY be 'free'   │
              │        even if Play receipt is valid,        │
              │        because webhook may be stale.         │
              │      → isPremium = FALSE                      │ ← Symptom 1 window
              └────────────────┬─────────────────────────────┘
                               │  (ms later)
                               ▼
              ┌──────────────────────────────────────────────┐
              │ T1   getProfile() resolves                   │
              │      → sets user with server fields          │
              │      → still isPremium = FALSE if webhook     │
              │        hasn't landed yet                     │ ← Symptom 1/2 window
              └────────────────┬─────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
  ┌───────────────────────┐          ┌───────────────────────────┐
  │ PremiumContext mount  │          │ User taps "구독 관리"      │
  │ effect fires (once):  │          │ in Profile menu            │
  │   initRC → logIn      │          │   isPremium=false          │
  │   → getCustomerInfo   │          │   → showPaywall('general') │
  │   → active? → set     │          │   → PaywallModal opens     │ ← Symptom 2
  │     localPremium=true │          │     with NO pre-check       │
  │   else restorePurchase│          └───────────┬───────────────┘
  │   if still no active: │                      │
  │     STAY false        │                      ▼
  └───────────┬───────────┘          ┌───────────────────────────┐
              │                      │ User taps subscribe       │
              ▼                      │ (monthly or yearly)       │
  ┌───────────────────────┐          │   → purchasePackage(pkg)  │
  │ T2   localPremium=true│          │   → NO oldSKU check        │
  │      → isPremium=TRUE │          │   → NO entitlement check   │
  │      refreshUser()    │          │   → Play bills new SKU     │ ← Symptom 4/5
  │      → server catches │          └───────────┬───────────────┘
  │        up eventually  │                      │
  │      → planType appears│                      ▼
  │                       │          ┌───────────────────────────┐
  │  ┌─ "suddenly showing │          │ markPremium() → override  │
  │     already monthly"  │          │ refreshStatus() → server  │
  │    ← Symptom 3        │          │ now has TWO active subs   │
  └───────────────────────┘          └───────────────────────────┘
```

---

## 4. Symptom → root-cause mapping

| # | Symptom | Root cause | Evidence |
|---|---------|-----------|----------|
| 1 | Profile menu shows "구독 안됨" | Defect B (upgrade reconciliation gap). `user.subscriptionTier` from `/auth/me` is the UI source, and the mount effect that fetches RC state runs only once after login. Until `localPremiumOverride` flips, `isPremium=false`. | `PremiumContext.tsx:186-197` reads `user.subscriptionTier`; `ProfileScreen.tsx:50,516` and `SubscriptionScreen.tsx:22,72` consume it; no fallback sync. |
| 2 | Tapping "구독" opens paywall | Defect B. `showPaywall('general')` is gated only by `isPremium` (ProfileScreen.tsx:516, SubscriptionScreen.tsx:143,275). When `isPremium=false`, paywall opens even if Play has an active subscription. | Same files as #1; no `getCustomerInfo()` / restore guard before `showPaywall`. |
| 3 | Suddenly "already monthly subscribed" | Defect B — *resolution*. The RevenueCat `addCustomerInfoUpdateListener` fires, `setLocalPremiumOverride(true)` runs, and `refreshUser()` lands server state including `subscriptionPlanType`. This is the moment the UI transitions from "not subscribed" to "월간 플랜". The flip feels sudden because it waited on the async RC listener + server webhook race. | `PremiumContext.tsx:116-123` listener; `subscription.service.ts:206-217` sets `subscriptionPlanType` — **provided the product_id literally contains "month"**. If it does not (e.g., SKU is `premium_annual`), this code wrote `planType=undefined` into the update spread and the old DB value (potentially `monthly` from a prior test) persists — explaining why the user sees "월간" even if they never bought monthly. |
| 4 | Active monthly → yearly purchase succeeds | **Defect A.** `PaywallModal.handlePurchase` (lines 107–152) calls `purchasePackage(pkg)` with no entitlement precheck and no `oldSKU` option to `Purchases.purchaseProduct`. Google Play treats the call as a new subscription in the same subscription group; because the user already owned a different SKU, Play approves a second active sub. | `PaywallModal.tsx:130-145`, `revenueCat.ts:43-51`. |
| 5 | Active yearly → monthly purchase succeeds | Same as #4. The code path is symmetric — no `isPremium` check, no `customerInfo.entitlements.active['premium']` check, no plan-change path. | Same as #4. |

---

## 5. Reproduction scenarios

### 5.1 Symptom 1 — "구독 안됨" after cold start

**Preconditions**
- Account has a valid RevenueCat entitlement (either from a previous session on this device or from another device).
- Backend DB row has `subscriptionTier='free'` (webhook lost, webhook delayed, or account restored from another install where webhook `INITIAL_PURCHASE` never targeted this userId).

**Steps**
1. Kill app fully (swipe away from recents).
2. Set network to moderate latency (~2 s add) via proxy — simulates Hetzner RTT under load.
3. Cold-start the app.
4. Log in (email/password or OAuth).
5. Immediately navigate to Profile tab (within ~500 ms of login response).

**Expected (buggy) result**
- Profile menu "구독" row shows "구독 안됨" + Upgrade badge for ~1–4 s.
- After the RC listener resolves and `refreshUser()` returns, row transitions to premium badge.

**Why**
- At step 5, the mount effect (PremiumContext.tsx:81) has started but not finished; `localPremiumOverride=false`; server profile still shows `tier='free'`.

### 5.2 Symptom 2 — Tapping "구독" opens paywall

**Preconditions**
- Same as 5.1, and the user taps the "구독" menu during the window before `localPremiumOverride` flips.

**Steps**
1. Execute scenario 5.1 through step 5.
2. Within the first 1–2 s, tap the "구독" row (subscription menu item).

**Expected (buggy) result**
- PaywallModal opens with subscribe CTAs.

**Why**
- `ProfileScreen.tsx:516` gates navigation on `isPremium`; it is `false` in this window, so `showPaywall('general')` fires.

### 5.3 Symptom 3 — "갑자기 월간 결제가 되어 있다"

**Preconditions**
- Either (a) user is in scenario 5.1 and RC resolves while the paywall is already open, **or** (b) user's last webhook wrote `subscriptionPlanType='monthly'` but their *current* active sub is yearly (Defect in `subscription.service.ts:211-217` — SKU contains neither "month" nor "year" verbatim, so `planType` was not overwritten).

**Steps (variant a)**
1. Execute 5.2 (paywall open).
2. Keep paywall open.
3. Wait ~2–4 s.

**Expected (buggy) result**
- Paywall does not close by itself (no listener on `isPremium` changes), but the underlying SubscriptionScreen behind it now shows the premium plan card.
- Closing the paywall reveals "월간 플랜" text even though the user never bought monthly this session.

**Steps (variant b, more severe)**
1. Use an account that previously had `subscriptionPlanType='monthly'` written to DB.
2. Cancel that subscription, wait past expiration (`subscriptionTier='free'`).
3. Purchase yearly via paywall. Webhook fires with `product_id='premium_annual'` (or similar — **without "year" substring**).
4. Reload profile.

**Expected (buggy) result**
- UI shows "프리미엄" + "월간 플랜" (from the stale DB value).

**Why**
- `subscription.service.ts:211-217` only matches substring `'year'`. `'premium_annual'` does not contain `'year'`, so the spread `...(planType && ...)` no-ops. DB keeps old `monthly`.
- `AuthService.getProfile` (line 439) returns `subscriptionPlanType: user.subscriptionPlanType` → UI shows monthly.

### 5.4 Symptom 4 — Monthly active → Yearly purchase

**Preconditions**
- Google Play test account currently has an active monthly subscription for product `premium_monthly`.
- Offerings return both `current.monthly` and `current.annual`.

**Steps**
1. Log in; confirm `isPremium=true` (wait for RC).
2. Force a state flip so `isPremium=false` momentarily (e.g., kill app, cold-start, tap Profile → Subscription menu during the stale window; tap the upgrade card at Subscription screen).
3. In the paywall, select "연간" and tap subscribe.
4. Complete Play Billing flow (real Play, not sandbox).

**Expected (buggy) result**
- Play Billing completes without asking about plan switching.
- RevenueCat and Play now both report two active subscriptions (monthly + annual) for the same user.
- `subscription.service.ts:handleRevenueCatEvent` receives INITIAL_PURCHASE for the annual SKU and overwrites `expiresAt` / `planType` with the yearly values, hiding the fact that monthly is still billing separately.

**Why**
- `PaywallModal.handlePurchase` (lines 130–152) calls `Purchases.purchasePackage(pkg)` with no `oldSKU` / `upgradeInfo`. RevenueCat does not automatically infer the replacement because the call site did not provide it.
- Google Play's duplicate-subscription guard requires `BillingFlowParams.SubscriptionUpdateParams.Builder.setOldPurchaseToken()` to trigger the plan-change UX.

### 5.5 Symptom 5 — Yearly active → Monthly purchase

**Preconditions**
- Google Play test account has an active annual subscription.

**Steps**
1. Same as 5.4 but flipped plan selection in step 3.

**Expected (buggy) result**
- Play allows monthly purchase alongside existing annual.
- UI may settle on either plan type depending on which webhook event RC delivers last.

**Why**
- Symmetric root cause to 5.4.

---

## 6. File/line pointer index (no edits)

### Frontend
- `frontend/src/contexts/PremiumContext.tsx:81-125` — mount effect, runs once per user.id; sole initial RC sync.
- `frontend/src/contexts/PremiumContext.tsx:116-123` — `addCustomerInfoUpdateListener` callback (captures `refreshUser` from first render).
- `frontend/src/contexts/PremiumContext.tsx:134-163` — AppState foreground effect; re-registers on every `localPremiumOverride` change; does **not** call `refreshUser()` inside.
- `frontend/src/contexts/PremiumContext.tsx:176-184` — downgrade-only reconciliation; **no upgrade reconciliation counterpart**.
- `frontend/src/contexts/PremiumContext.tsx:186-197` — `isPremium` memo; all UI flows through here.
- `frontend/src/components/PaywallModal.tsx:107-152` — `handlePurchase`; **missing** active-entitlement precheck and `oldSKU` plan-switch path. **P0 site.**
- `frontend/src/components/PaywallModal.tsx:171` — restore's `entitlements.active['premium']` check exists only on restore, proving the guard pattern is known but not applied to purchase.
- `frontend/src/screens/main/SubscriptionScreen.tsx:22-34,72,140-164,274-284` — renders premium-vs-not purely on `isPremium`; no direct RC read; opens paywall without pre-check.
- `frontend/src/screens/main/ProfileScreen.tsx:50,513-541` — consumes `isPremium`; gates menu item on it; tapping navigates to Subscription or opens paywall.
- `frontend/src/services/revenueCat.ts:43-51` — `purchasePackage` wrapper; no plumbing for `oldSKU`/`prorationMode`.
- `frontend/src/contexts/AuthContext.tsx:546-553` — `refreshUser` (not memoized) → `apiService.getProfile()` → `/auth/me`.
- `frontend/src/services/api.ts:391-402` — `getProfile` hits `/auth/me`.

### Backend
- `backend/src/subscription/subscription.service.ts:196-244` — switch on `INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/UNCANCELLATION`; planType substring match on `'month'`/`'year'`. **P1 site** (naming mismatch risk).
- `backend/src/subscription/subscription.service.ts:211-217` — the substring heuristic that silently drops `planType` on SKUs like `premium_annual`, `sub_1m`, `1mo`, etc.
- `backend/src/subscription/subscription.service.ts:225-234` — the conditional spread that no-ops when `planType===undefined`, leaving DB value stale.
- `backend/src/subscription/subscription.service.ts:246-279` — CANCELLATION handling (keeps premium until expiry). Not implicated in V169 but relevant to "suddenly flips" perception.
- `backend/src/subscription/subscription.service.ts:298-321` — Redis `premium:${userId}` 5-min TTL. Not read by `/auth/me`, but any consumer of `isPremiumUser()` inherits up to 5 min of staleness.
- `backend/src/auth/auth.service.ts:425-443` — `/auth/me` serialization; includes all five subscription fields. Not a drop site, but a pure reflection of DB state (including the staleness above).
- `backend/src/users/users.service.ts:197-227` — select list for `findProfileById`; all subscription fields present. OK.
- `backend/src/subscription/dto/revenuecat-webhook.dto.ts:9-16` — untyped event, no whitelist. Not the cause but leaves room for RC rename (`product_identifier` vs `product_id`) to silently regress; currently both names are tolerated at service.ts:207-210.

---

## 7. Priority ranking

| P | Area | Concern | Impact |
|---|------|---------|--------|
| **P0** | `PaywallModal.handlePurchase` (lines 107–152) + `revenueCat.purchasePackage` (43–51) | No preflight active-entitlement check; no `oldSKU`/`prorationMode` on plan switch. | **Financial/regulatory** — users charged twice. Must be blocked before production rollout. Symptoms 4 and 5. |
| **P0** | `PremiumContext` upgrade reconciliation gap (no symmetric effect to lines 176–184) | When server says free and RC says active, UI stays free until mount/foreground. Combined with P0 above, the user is pushed to repurchase. | Directly enables the "tap subscribe while already subscribed" flow. Symptoms 1, 2, 3 (variant a). |
| **P1** | `subscription.service.ts:211-217` planType substring heuristic | SKUs that do not contain `month`/`year` verbatim (e.g., `premium_annual`, `premium_1y`, `premium_30d`) leave `subscriptionPlanType` unchanged, preserving stale value across plan changes. | Data integrity — UI displays wrong plan type. Symptom 3 (variant b). Also means analytics on planType are wrong. |
| **P1** | `PremiumContext.tsx:134-163` foreground effect does not call `refreshUser()` | Foreground resume detects RC active state but does not force a server profile refresh; UI may stay stale if `localPremiumOverride` was already true and RC state unchanged. | Hides the bug intermittently, making repro inconsistent. |
| **P2** | `PremiumContext` AppState effect dependency `[user?.id, localPremiumOverride]` | Re-registers listener on every override flip. Not a correctness bug but adds jitter and makes log tracing harder. | UX/DX. |
| **P2** | `AuthContext.refreshUser` is not memoized (line 546) | `useEffect` closures in PremiumContext pin the first-render identity. Currently OK because the function body closes over stable module-scope objects, but a future refactor that adds state inside `refreshUser` will break silently. | Maintainability. |
| **P2** | `RevenueCatWebhookDto` event field is untyped | No schema contract; RC naming drift could silently skip updates. | Defensive hardening. |
| **P2** | `isPremiumUser` 5-minute Redis TTL | Any server path that consumes it (not `/auth/me`) can serve stale FREE up to 5 min after webhook. | Latent. |

---

## 8. Why the V155 reconciliation does not save us

V155 introduced `PremiumContext.tsx:176-184` to handle the "RevenueCat stale cache keeps premium alive when server says expired" case. That is a **downgrade** correction. The V169 bugs are **upgrade** corrections: the server says free (or has a stale planType) while the entitlement is actually active. The existing reconciliation effect's guard `if (!localPremiumOverride || !user) return;` short-circuits in exactly the scenario that matters here — `localPremiumOverride===false` and the user has just logged in with a free-tier profile. No code path in the current tree promotes `localPremiumOverride` to `true` based on a delta between "server free" and "RC active" outside the single-shot mount effect.

---

## 9. Related historical notes

- V112 (cbb5e59, e4b6389) added `localPremiumOverride` and the initial RC sync.
- V155 added the downgrade reconciliation effect (lines 176–184).
- V157 added AppState foreground RC check (lines 134–163) but did **not** wire `refreshUser()` into the foreground callback (see evidence 2.1).
- V165 notes in the V159 unbreakable-list (CLAUDE.md) explicitly reference this effect but focus on downgrade scenarios only.

---

## 10. What to instrument if reproducing in production

Before changing code, the following log points will let a QA run prove each hypothesis:

1. `PremiumContext.tsx:81` entry: log `{ userId, userSubscriptionTier, timestamp }` at the start of the mount effect.
2. `PremiumContext.tsx:92` after `getCustomerInfo`: log `{ hasActiveEntitlement, activeKeys, originalAppUserId }`.
3. `PremiumContext.tsx:106` before `setLocalPremiumOverride(true)`: log the transition.
4. `PremiumContext.tsx:116` listener entry: log `{ hasActive, activeKeys, entitlementExpiresAt }` on every RC push.
5. `PaywallModal.tsx:138` before `purchasePackage`: log `{ selectedPlan, packageIdentifier, currentEntitlementsActiveCount }`.
6. `subscription.service.ts:207-217`: log `{ productId, derivedPlanType }` every webhook to see how often `planType===undefined`.
7. `subscription.service.ts:231` after `userRepository.update`: log the payload keys that were actually written.

These seven log points, set during a 24-hour Alpha run, will quantify how often each defect fires and confirm or reject the ranking above.

---

## End of report
