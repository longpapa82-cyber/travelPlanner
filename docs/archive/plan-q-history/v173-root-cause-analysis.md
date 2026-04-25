# V173 Alpha — Root Cause Analysis (Read-Only Report)

**Date:** 2026-04-24
**Scope:** 4 issues reported from V173 Alpha. Code is NOT modified. This is a tracking/diagnosis report.
**Target account for Issue 1 reproduction:** `hoonjae723@gmail.com`

---

## Executive Summary

| # | Severity | Title | Primary Root Cause |
|---|---|---|---|
| 1 | **P0 CRITICAL** | Admin account shows contradictory subscription states | Frontend hardcoded `ADMIN_EMAILS` list diverges from backend → UI believes user is admin, but `isPremium` stays false because the server returns `subscriptionTier='free'`. Simultaneously the RevenueCat SDK caches a device-level anonymous `appUserID` carrying an entitlement from a prior test purchase — and `AuthContext.logout()` **never calls `rcLogOut()`**, so cache survives logout/re-register. |
| 2 | P1 HIGH | CreateTripScreen input values persist | `navigation.addListener('focus', ...)` is declared AFTER the params-refill `useEffect` with no ordering guarantee. More importantly, `numberOfTravelers` and `travelerInputText` are independent states whose reset paths have diverged across V140/V142/V143/V165/V169 — the "chip selected [3~4명] but number shows 1" output is exactly the asymmetry predicted by two independent sources of truth. |
| 3 | P2 MEDIUM | Profile menu legal basis review | Both items are defensible: licenses = OSS attribution obligation; export = GDPR Art.20 / CCPA §1798.110 / Google Play Data safety. Implementation is present; no bug. |
| 4 | P2 MEDIUM | ErrorLog schema gaps | Entity fields fine; but `all-exceptions.filter.ts` save path drops `userId`/`userEmail`, client-report path drops `routeName`/`breadcrumbs`/`errorName`. Platform hardcoded `'web'` in filter. |

---

## ISSUE 1 [P0 CRITICAL] — Subscription State Contradiction

### Reported symptoms on `hoonjae723@gmail.com`
- Paywall purchase: `"이미 연간 플랜 구독 중"` alert fires.
- Profile menu subscription status: `"미구독"` displayed.
- Delete account → re-register → the `"연간 플랜 구독 중"` alert STILL fires.
- AI quota UI: `3/3` (free display), but AI trips generate without counter decrementing, and can exceed 3.

### The four candidate causes
1. Admin OR-logic flaw (frontend vs backend)
2. RevenueCat SDK device-level anonymous `appUserID` cache
3. Leftover `localPremiumOverride` / `rcEntitlement` snapshot
4. `PaywallModal.resolvePurchaseAction` second-line guard bug

### Evidence — which is the REAL root cause?

**All four contribute. The combination is the root cause, but the dominant mechanism is #2 amplified by #1.** Ranked by causal weight:

#### Candidate #2 — RevenueCat device-level cache survives logout/re-register (DOMINANT)

Evidence path:

- `frontend/src/services/revenueCat.ts:18-32` — module-level `let isInitialized = false;` plus early return: `Purchases.configure()` runs **exactly once per process lifetime**.
- `frontend/src/services/revenueCat.ts:156-170` — `logIn(userId)` / `logOut()` wrappers exist but the Android/iOS RC SDK maintains a **device-level anonymous `appUserID`** in its own SharedPreferences/Keychain cache, independent of the app's AsyncStorage.
- `frontend/src/contexts/AuthContext.tsx:575-610` — `logout()` calls `trackEvent('logout')`, `flushEvents()`, `apiService.logout()`, `apiService.removePushToken()`, `nativeGoogleSignOut()`, clears tokens, clears offline cache, clears `user` state, clears `pendingVerification`. **It does NOT import or call `logOut as rcLogOut` from revenueCat.ts.**
- `grep -rn "rcLogOut\|Purchases.logOut" /frontend/src/` confirms `rcLogOut` is **imported at `PremiumContext.tsx:8` but never invoked anywhere in the codebase**. Dead import.
- `frontend/src/contexts/PremiumContext.tsx:231-236` — on `user === null`, the effect clears `rcEntitlement` React state, but does NOT call `Purchases.logOut()`. RC SDK remains logged in under the previous `appUserID`.

Consequence: when a new account registers, `initRevenueCat()` short-circuits on `isInitialized=true` (line 21), and `Purchases.logIn(newUserId)` on line 162 of PremiumContext merely *aliases* — per react-native-purchases docs, `logIn` on an already-logged-in user without a prior `logOut` can retain the anonymous cache's active entitlements (`$RCAnonymousID:xxx`). In particular, a sandbox yearly purchase made under a previous account test cycle can reappear in `getCustomerInfo()` because the receipt is device-bound on Google Play License Tester.

So `PaywallModal.resolvePurchaseAction()` at `PaywallModal.tsx:127-149` asks `getCustomerInfo()` and gets back a **stale device-cached entitlement with `productIdentifier=premium_yearly`**, returns `{ kind: 'block' or 'switch', currentPlan: 'yearly' }`, and the `"이미 연간 플랜 구독 중"` alert fires (lines 193-199).

Meanwhile the backend user record is genuinely `subscriptionTier='free'` (new account, no purchase), so `/auth/me` returns free → `SubscriptionScreen` renders `isPremium=false` branch → `"미구독"`.

#### Candidate #1 — Frontend/Backend ADMIN_EMAILS divergence (SECONDARY, shapes the "3/3 + bypass" mismatch)

- `frontend/src/contexts/PremiumContext.tsx:33-36` hardcodes `['longpapa82@gmail.com', 'hoonjae723@gmail.com']` as `ADMIN_EMAILS`. `isAdmin` (line 287-289) is computed from this client-side list.
- `backend/src/common/utils/admin-check.ts:26-29` reads `ADMIN_EMAILS` from `process.env.ADMIN_EMAILS`. If the production env var is unset, only DB `role='admin'` counts as admin.
- `backend/.env`, `backend/.env.production`, `backend/.env.example` — none contain `ADMIN_EMAILS=` in the repo. Unless set at runtime on the Hetzner VPS, only DB role matters.
- `backend/src/subscription/subscription.service.ts:100-108` — `isAdmin = isOperationalAdmin(email, role)`. For admins, `aiTripsLimit` is still **`effectiveLimit = isPremium ? 30 : 3`**, NOT `isAdmin ? ∞ : ...`. So an admin who is not premium gets the free tier counter (3).
- `backend/src/trips/trips.service.ts:261-304` — here admins bypass quota: `if (isAdminUser) { /* no limit check */ }` AND `if (!isAdminUser) { increment... }`. **The counter is never incremented for admin, AND the limit check is skipped.**

Asymmetry: `/subscription/status` reports `aiTripsLimit=3, aiTripsUsed=0 → 3/3 remaining` (because `aiTripsUsedThisMonth` in DB stays at 0 for admins), while trip creation happily proceeds beyond 3.

**This is why the UI says `3/3` but AI generation never actually runs the counter down.** The `3/3` is stale-looking but technically the "remaining=3" because used=0. The UI has no visibility into "admin unlimited" because `getProfile` (auth.service.ts:425-444) does NOT return `isAdmin` — the frontend has to re-derive it from the ADMIN_EMAILS fallback list.

Furthermore, on `hoonjae723@gmail.com` specifically the backend env likely does NOT include that email (repo doesn't), so backend returns `isAdmin: false`. Frontend still returns `isAdmin: true` (hardcoded list). UI inconsistency.

#### Candidate #3 — `rcEntitlement` snapshot leakage (TERTIARY)

- `PremiumContext.tsx:231-236` clears `rcEntitlement` on `!user` (logout). This IS wired.
- But `mount-restore` snapshot (line 181) is re-captured at mount whenever `user?.id` changes, and `getActiveEntitlementSnapshot()` reads from `Purchases.getCustomerInfo()` — which returns the device-cached entitlement per candidate #2.
- So after re-register, `mount-restore` fires, sees a cached yearly entitlement under the anonymous RC user, and sets `rcEntitlement.source='mount-restore', planType='yearly'`.
- Then the `isPremium` memo (line 260-282) evaluates `server.subscriptionTier==='premium' || (rcEntitlement.source in trusted-set && expiresAtMs > now)`. Since `mount-restore` IS in the trusted set (line 275), `isPremium = true` **on the React state layer**.
- But if server-side reconciliation at line 241-258 fires first (`user.subscriptionTier === 'free'` for the new account), the snapshot is cleared. The ordering of these two effects is race-sensitive.

In practice, the SubscriptionScreen read and the PaywallModal guard evaluate at slightly different times — SubscriptionScreen derives from `isPremium` (after reconciliation fires → `"미구독"`), PaywallModal's `resolvePurchaseAction` calls `getCustomerInfo()` directly (line 130) which still returns the cached entitlement → `"already subscribed"`.

#### Candidate #4 — `resolvePurchaseAction` second-line guard (NOT the bug)

- `PaywallModal.tsx:127-149` logic is correct given its inputs. It correctly prefers RC SDK over React state — that's actually by-design for V169. The problem is that RC SDK itself is poisoned by #2.

### Why re-registration does NOT clear the state

Timeline:
1. Delete account at `ProfileScreen.handleConfirmDelete` (lines 196-214) → `apiService.deleteAccount()` → `markLoggingOut()` → `logout()`.
2. `logout()` (AuthContext.tsx:575-610) never touches RevenueCat SDK. RC SDK still logged in as previous userId.
3. Navigation bounces to Auth stack. `user === null` triggers `PremiumContext.tsx:231-236` → `setRcEntitlement(null)`, `setIsLoggingOut(false)`. React state clean.
4. New signup / login → `setUser(newUser)`.
5. `PremiumContext.tsx:156-198` effect fires (deps = `user?.id`). `initRevenueCat(newId)` short-circuits because `isInitialized=true`. `logIn(newId)` runs — but per react-native-purchases docs, calling `logIn` when already logged in WITHOUT a preceding `logOut` **aliases** the two IDs: the previous user's receipts can remain visible.
6. `getCustomerInfo()` on line 165 returns CustomerInfo still containing the anonymous-device entitlement. `mount-restore` snapshot captured with `planType='yearly'`.
7. Paywall opens → `resolvePurchaseAction` → block/switch alert.

### Reproduction scenario
1. On a test device, log in as `hoonjae723@gmail.com` (admin).
2. Complete a sandbox yearly purchase via Google Play License Tester (or any prior RC test purchase that landed on the device).
3. Logout via Profile menu.
4. Register a brand-new email (e.g. `brandnew+test@...`).
5. Open Subscription menu → shows `"미구독"` (correct, server = free).
6. Tap upgrade → Paywall opens → tap Subscribe yearly → `"이미 연간 플랜 구독 중"` alert fires.
7. Admin specifically: AI trip counter stays at 0/3 but trips generate regardless.

### Code-line evidence summary (Issue 1)

| Line | File | Finding |
|---|---|---|
| `frontend/src/contexts/AuthContext.tsx:575-610` | AuthContext.logout | Missing `await rcLogOut()` call |
| `frontend/src/contexts/PremiumContext.tsx:8` | PremiumContext | `logOut as rcLogOut` imported, never called anywhere |
| `frontend/src/services/revenueCat.ts:18,21` | revenueCat.initRevenueCat | `isInitialized` guard — configure() runs once per process |
| `frontend/src/contexts/PremiumContext.tsx:156-198` | PremiumContext useEffect | On user change, logIn() called but no prior logOut() — anon cache persists |
| `frontend/src/contexts/PremiumContext.tsx:33-36` | PremiumContext ADMIN_EMAILS | Client-side hardcoded list diverges from server env |
| `backend/src/auth/auth.service.ts:425-444` | getProfile | Does not return `isAdmin` — client must re-derive from its hardcoded list |
| `backend/src/subscription/subscription.service.ts:100-108` | getSubscriptionStatus | `aiTripsLimit = isPremium ? 30 : 3` — admin users who are not premium still see `3/3` |
| `backend/src/trips/trips.service.ts:261-304` | createAiTrip quota | Admin bypasses check AND skips increment — counter desync with UI |
| `frontend/src/components/PaywallModal.tsx:127-149` | resolvePurchaseAction | Correct logic, but input (RC cache) is poisoned |

---

## ISSUE 2 [P1 HIGH] — CreateTripScreen input persistence (V155~V171 recurring regression)

### Reported symptoms
- Re-entering the screen, `destination="이탈리아"`, `duration=[한달]`, `travelers=[3~4명]`, dates `4/26~5/8` persist.
- The `[3~4명]` chip is visually selected, but the number input reads `"1"`.

### Why this has regressed 4+ times

The screen maintains **two independent state sources** for traveler count:
- `numberOfTravelers: number` (CreateTripScreen.tsx:97, default `1`)
- `travelerInputText: string` (line 98, default `'1'`)

These were introduced to fix V143's "backspace 입력 안됨" — but every fix that reset one state without the other produces an asymmetry. Trace:

| Version | Claimed fix | Code move |
|---|---|---|
| V140 (commit `043fe3b6`) | "폼 초기화 — navigation.setParams 클리어 + params 소비 후 즉시 초기화" | Added focus listener reset |
| V142 (`b33800a5`) | "인원수 입력" | Adjusted input handlers |
| V143 (`fd924c6e`) | "인원수 진짜 해결" | Split `travelerInputText` from numeric state |
| V165 (`d9515eda`) | "인원수 동기화" | Sync between the two states |
| V167 (`3aa5cf41`) | "인원수 입력 수정" | Input sanitization |
| V169 (`0c96a71b`) | "인원수 입력 근본 수정" | Removed `value={travelerInputText \|\| numberOfTravelers.toString()}` fallback so backspace works; added `safeTravelers` NaN guard before server send |

The problem: each fix targets one side of the input but the **reset path at lines 746-789 resets both together**, while `handleSelectTravelers` (lines 259-270) also updates both together. The "chip selected but number shows 1" symptom in V173 is the signature of:
- `numberOfTravelers` set to 4 via chip
- `travelerInputText` NOT updated because of a code path where `setTravelerInputText` is skipped

Looking at `handleSelectTravelers` (lines 259-270):
```
if (count === -1) {        // "5+" case
  const val = numberOfTravelers >= 5 ? numberOfTravelers : 5;
  setNumberOfTravelers(val);
  setTravelerInputText(val.toString());   // ← updated
  setTimeout(...focus...)
} else {                    // normal chip case
  Keyboard.dismiss();
  setTravelersCount(count);                // sets numberOfTravelers
  setTravelerInputText(count.toString());  // ← updated
}
```

Both paths DO update both states. But the reset effect at lines 769-776:
```
setNumberOfTravelers(1);
setTravelerInputText('1');
```
also updates both. So in isolation, the states track.

**The actual root cause is that the focus listener is unreliable in the nested stack/tab setup.**

### The structural root cause: `navigation.addListener('focus')` in a Tab-nested Stack

`MainNavigator.tsx:162-178` registers a `tabPress` listener on the `Trips` tab:
```
listeners={({ navigation }) => ({
  tabPress: (e) => {
    e.preventDefault();
    navigation.navigate('Trips', { screen: 'TripList' });
  },
}),
```

This means tapping the Trips tab from WITHIN CreateTripScreen explicitly navigates to `TripList`, popping the stack. When the user then taps "+ Create Trip" to return, `CreateTripScreen` mounts anew with empty state — this should work.

BUT the regression happens when navigation lands back on `CreateTripScreen` WITHOUT unmount — e.g.:
- Deep-link from HomeScreen "popular destination" passes `route.params.destination`
- The params-refill effect (lines 195-205) fires with old params in `route.params` because they were never cleared
- Or: user navigates `CreateTrip → TripDetail → back` (only the TripDetail unmounts, CreateTrip stays mounted)

The focus listener at line 749 DOES fire on every focus — but `navigation.setParams({ destination: undefined, ... })` at line 786 runs AFTER the input resets. Meanwhile, the params-refill effect at lines 195-205 uses dependency `[route.params]`. Setting params to `undefined` in the reset handler mutates `route.params` to a new reference → the refill effect runs again → sees `params.destination=undefined`, guard at `if (!hasParams) return` at line 199 prevents refill. This part is OK.

The real structural problem: the focus listener uses `navigation.addListener('focus', ...)` inside a `useEffect` with deps `[navigation]` (line 789). Under Tab + Native Stack nesting, "focus" fires on both:
- native-stack focus (returning from TripDetail)
- tab focus (switching tabs)

But NOT on:
- re-rendering the same mounted screen via `navigate` with new params (when you're already on CreateTrip)

In that last case, the params-refill effect fires (dep `[route.params]`), but focus does NOT fire because the screen was never blurred. The reset never runs. Old state remains. New params overlay → mixed state (e.g. new destination, old travelers).

### Additional mechanism: `useFocusEffect` is NOT used

`useFocusEffect` from `@react-navigation/native` is the idiomatic hook that runs a callback every time the screen becomes focused (including on the same-mount navigate case via `goBack` and nested nav transitions). `CreateTripScreen` uses `navigation.addListener('focus', ...)` inside `useEffect(..., [navigation])` instead. Those two have subtly different semantics under React Navigation v6/v7 with native stack screens nested in a tab navigator.

`MainNavigator.tsx:58-64` DOES use `useFocusEffect` — proof the idiom is available and known in the codebase.

### Other contributing patterns
- State initialization is done at top of component (`useState('')`), not inside a reset helper → reset and init paths diverge.
- `useMemo`-free derived values: `POPULAR_DESTINATIONS` / `DURATION_OPTIONS` / `TRAVELER_OPTIONS` at lines 168-180 use `useMemo(..., [t])`, but `minStartDate` is `useState` initialized once and refreshed on focus (line 175-179) — different pattern for different fields.
- `route.params` read effect (lines 195-205) and reset effect (lines 748-789) are two separate effects with no documented ordering. Under React 18, they run in source order, but that ordering is not enforced as an invariant anywhere.

### Reproduction scenario
1. On HomeScreen, tap a "popular destination" card (e.g. "이탈리아") → navigates to CreateTrip with params.
2. On CreateTripScreen, select duration `1 week`, change travelers to `3-4명`, pick dates.
3. Tap Trips tab → lands on TripList (due to tabPress listener).
4. Tap `+ Create Trip` from TripList → navigates to CreateTrip.
5. Expected: empty form. Actual: previous values persist.

Alt-path (shows chip/number mismatch):
1. Land on CreateTrip with no params.
2. Tap `[3~4명]` chip. `numberOfTravelers=4`, `travelerInputText='4'`.
3. Tap the `"5+"` chip. `numberOfTravelers=5`, `travelerInputText='5'`, focus into input.
4. Backspace and leave blank. V169 `onBlur` resets `travelerInputText='5'` — OK.
5. Navigate to TripDetail and back. If focus listener does NOT fire (same-mount case), text field stays `'5'` but chip check on line 1300 `numberOfTravelers >= 5` still highlights `[5+]`. If focus DOES fire, both states reset to `1` together.

The specific V173 symptom `chip=[3~4명]` with `input="1"` can only occur if:
- `numberOfTravelers` was set to 4 at some point and never reset.
- `travelerInputText` was reset to `'1'` independently.

The most likely code path is a partial reset — some state-changing effect was triggered during the navigation transition that wrote to `travelerInputText` only (e.g. AsyncStorage restore at lines 119-129 runs `setDestination(savedDest)` but not the travelers). Look closer:

`lines 119-129` restoration effect runs on mount with deps `[]`. After a rewarded ad, only `destination` and `insightsUnlocked` are restored. If the screen remounts with stale params AND this effect runs, you get a destination from AsyncStorage + old traveler state from React. But travelers should default to 1 on fresh mount. So chip=[3~4명] + input="1" implies the screen did NOT fresh-mount; instead, it re-received focus without unmounting, and the params-refill effect ran with `params.travelers=4` (updating `numberOfTravelers`) but the `onChangeText` of the input ran separately and got cleared to ''.

### Code-line evidence summary (Issue 2)

| Line | File | Finding |
|---|---|---|
| `CreateTripScreen.tsx:97-98` | Two states | `numberOfTravelers: number` and `travelerInputText: string` — two sources of truth |
| `CreateTripScreen.tsx:195-205` | Params refill effect | Dep `[route.params]` — fires on every params change, including `setParams(undefined)` |
| `CreateTripScreen.tsx:748-789` | Focus reset | Uses `navigation.addListener('focus')` inside `useEffect` — not `useFocusEffect` |
| `CreateTripScreen.tsx:203-204` | setParams race | Clears params inside params-refill effect — order-sensitive with reset effect |
| `MainNavigator.tsx:172-177` | tabPress | Explicit navigate to TripList — shapes the unmount behavior when tab is re-tapped |
| `CreateTripScreen.tsx:119-129` | Rewarded-ad restore | On mount only; restores `destination` from AsyncStorage — can produce mixed state with fresh travelers |
| `CreateTripScreen.tsx:1300` | Chip selection check | `option.count === -1 ? numberOfTravelers >= 5 : numberOfTravelers === option.count` — derives visual state from `numberOfTravelers` only |
| `CreateTripScreen.tsx:1353` | TextInput value | `value={travelerInputText}` — derives from the OTHER state |

---

## ISSUE 3 [P2 MEDIUM] — Profile menu legal-basis review

### [오픈소스 라이선스] menu
- Defined at `ProfileScreen.tsx:691-695` — opens `https://mytravel-planner.com/licenses`.
- File `frontend/public/licenses.html` exists.
- **Legal necessity**: REQUIRED for most permissive OSS licenses in dependencies (MIT, Apache-2.0, BSD-2/3, ISC) — all require notice preservation when distributing compiled software. Since the app bundles `react-native`, `@react-navigation/*`, `axios`, `expo-*`, `react-native-purchases`, `@sentry/react-native`, `i18next`, etc., surfacing OSS notices is mandatory.
- Google Play does not audit this, but a DMCA-style notice from a BSD-3-Clause licensor would be actionable if attribution is absent.
- Apple App Store Review Guideline 5.2 / 5.6.3 requires third-party IP compliance.
- **Keep as-is.**

### [내 데이터 내보내기] menu
- Defined at `ProfileScreen.tsx:702-716`; handler `handleExportData` at lines 216-243. Calls `apiService.exportMyData()`, writes a JSON file, opens share sheet.
- **Legal necessity** (any ONE suffices):
  - **GDPR Art. 20 (Right to Data Portability)**: EEA users have the right to receive their personal data in a structured, commonly-used, machine-readable format. Since the app serves 17 languages including EU locales, GDPR applies.
  - **CCPA § 1798.110 / 1798.130**: California residents have the right to access specific pieces of personal data in a portable format within 45 days.
  - **Korea PIPA Art. 35 (열람·전송 요구권)**: Korean users can demand data transfer. This is the most directly applicable one given the domestic user base.
  - **Google Play Data safety form** requires a data-deletion + data-access mechanism disclosure.
- **Keep as-is.** The JSON format satisfies "machine-readable" requirement under GDPR.

### Recommendation
Neither item is bloat. Both are legally defensible and well-implemented. No change required unless the user wants to consolidate them under a "Privacy controls" subsection for clarity.

---

## ISSUE 4 [P2 MEDIUM] — ErrorLog improvement priority

### Current schema (`backend/src/admin/entities/error-log.entity.ts`)
Present fields: `id, userId?, userEmail?, errorMessage, stackTrace?, screen?, severity, deviceOS?, appVersion?, platform?, userAgent?, isResolved, createdAt`. Indexed on `createdAt, severity, platform`.

### Current population paths

**Path A — AllExceptionsFilter (backend 5xx)** at `all-exceptions.filter.ts:125-135`:
- Populates: `errorMessage, stackTrace, severity, platform='web'(hardcoded), screen='${method} ${path}', userAgent, isResolved=false`.
- **DROPS**: `userId, userEmail, deviceOS, appVersion`.
- **BUG**: `platform: 'web'` is hardcoded (line 131). Since this filter runs server-side, platform is unknown from this side — should be derived from `user-agent` (admin.controller.ts:303 already has `detectPlatform(ua)` helper).

**Path B — Client `reportError` (api.ts:1108-1109)** on 5xx auto-interceptor at api.ts:222-229:
- Populates: `errorMessage, stackTrace (= response data message), screen='ApiInterceptor', severity='error', deviceOS=Platform.OS, appVersion=Constants.expoConfig?.version`.
- `admin.controller.ts:287-306` adds: `userId, userEmail, platform (via UA detection), userAgent`.
- **DROPS**: error name/type (e.g. `TypeError` vs `NetworkError`), route name (`CreateTripScreen` vs `ApiInterceptor`), recent breadcrumbs, retry count, network status.

### Value-ranked field proposals

| Rank | Field | Cost | Value | Rationale |
|---|---|---|---|---|
| **1** | `errorName` (varchar 100) | Trivial — add column, populate from `error.constructor.name` or `exception.name` | **High** | Distinguishes `AxiosError`, `TypeError`, `TimeoutError`, `NetworkError` without parsing message strings. Enables grouping in admin dashboard without NLP. Directly addresses "원인 진단에 불충분한 로그" concern. |
| **2** | `routeName` (varchar 100) | Trivial — frontend: pass `useRoute().name` in reportError payload | **High** | Server-side `screen` is currently `'ApiInterceptor'` for all client-reported errors. Knowing "which screen was open" (e.g. `CreateTrip`, `TripDetail`) is the single highest-value debugging field. |
| **3** | `breadcrumbs` (jsonb, last 10) | Moderate — already captured by Sentry; mirror into ErrorLog | **High** | Sequence like `[trip.create.start, api.post.500, retry.1, api.post.500]` reveals whether the bug is first-request or retry-induced. Enables root-cause diagnosis without Sentry subscription. |
| **4** | `deviceModel` (varchar 100) | Low — use `expo-device`'s `Device.modelName` | Medium | Crashes frequently Android-OEM-specific (Samsung OneUI vs Xiaomi MIUI edgeToEdge differences directly caused V159 KAV OOM). Keeps Sentry-equivalent signal locally. |
| **5** | `osVersion` (varchar 50) | Low — `Device.osVersion` | Medium | Android 14 `edgeToEdgeEnabled` behavior drove V159 crash cluster. Separating OS major.minor lets you filter "only Android 14+" regressions. |
| 6 | `sessionId` (uuid) | Low | Low | Correlates multiple errors in one session, but already approximable via userId + time window. |
| 7 | `networkStatus` ('online'/'offline'/'slow') | Low | Medium-Low | Distinguishes offline-induced 5xx from real server bugs. |
| 8 | `httpStatus` (int) | Trivial | Medium | Currently embedded in `errorMessage` string as `[API 503]`. Promoting to a column enables index-based filtering. |
| 9 | `memoryWarningCount` (int) | High (requires native bridge) | Low | Useful only for Android OOM triage. Overlaps with Sentry native crash reports. |
| 10 | `retryCount` (int) | Moderate | Low | Only relevant for the auto-retry interceptor. |

### Top 5 recommendation (best value/cost)
1. **errorName** (varchar 100)
2. **routeName** (varchar 100, replaces current `screen` semantics or supplements it)
3. **breadcrumbs** (jsonb, last 5-10 events)
4. **deviceModel** (varchar 100)
5. **httpStatus** (int)

### Existing log gaps specifically hindering V173 diagnosis

- `AllExceptionsFilter` saves `userId=null, userEmail=null` (lines 125-135) — it has the `request.user` from JWT guard but doesn't read it. **Single-line fix opportunity**: pass `(req as any).user?.userId` into the save call.
- `platform: 'web'` is hardcoded on the server save path. Client-reported path correctly uses `detectPlatform(ua)` at admin.controller.ts:303; the filter should use the same helper.
- Client's auto-report interceptor (api.ts:222-229) passes `deviceOS: Platform.OS` which is the CORRECT value (`ios`/`android`/`web`), but the server's `CreateErrorLogDto` doesn't include a `platform` field — the DTO lets the server derive it from UA. Fine for web, but for native clients sending via axios over RN, the UA might be less informative than `Platform.OS`. **Overlap ambiguity** — the `deviceOS` field ends up with the accurate value but is stored separately from `platform`, so queries filtering on `platform='android'` may miss native-reported errors.

### Code-line evidence summary (Issue 4)

| Line | File | Finding |
|---|---|---|
| `error-log.entity.ts:13-52` | Entity | No `errorName`, no `routeName`, no `breadcrumbs`, no `deviceModel`, no `httpStatus` |
| `all-exceptions.filter.ts:125-135` | Save path | Missing `userId, userEmail`; hardcoded `platform='web'` |
| `admin.controller.ts:287-306` | Client-report save | Correctly populates userId/userEmail/platform — asymmetric with filter path |
| `api.ts:222-229` | Client interceptor | Hardcoded `screen='ApiInterceptor'` — loses route context |
| `create-error-log.dto.ts` | DTO | No `platform`, no `errorName`, no `routeName` fields exposed to client |

---

## Reproduction scenarios (consolidated)

### Scenario 1 — Issue 1
1. Device has prior sandbox yearly entitlement on RC (e.g. from License Tester 30-min cycle or a past admin test).
2. Log in as `hoonjae723@gmail.com`.
3. Open SubscriptionScreen → observe `"미구독"` (server says free).
4. Tap Upgrade → PaywallModal opens → select Yearly → tap Subscribe.
5. Observe `"이미 연간 플랜 구독 중"` alert.
6. Go to Profile → Delete Account → confirm.
7. Register new email.
8. Repeat step 4. Observe same alert.
9. Create AI trip. Confirm the counter on SubscriptionScreen stays at 0/3 (or whatever it was), and trips still generate beyond 3.

### Scenario 2 — Issue 2 (reliable reproduction)
1. Fresh mount of CreateTripScreen.
2. On HomeScreen or Discover, tap popular destination "이탈리아" → arrives CreateTripScreen with `route.params.destination='이탈리아'`.
3. Select `1주` duration chip. Dates auto-fill.
4. Select `3~4명` chip.
5. Tap Trips tab (bottom nav) → lands on TripList due to tabPress preventDefault.
6. Tap the Trips tab again, then tap `+ Create Trip` from header.
7. Expected: fresh empty form. Actual (V173): values persist OR partial reset with chip/number mismatch.

Alt reproduction without tab interaction:
1. Navigate CreateTrip → open a modal (e.g. Budget picker) → close.
2. Navigate back → CreateTrip was never unmounted → focus did NOT fire → params-refill did not run → state persists.

### Scenario 3 — Issue 3
No reproduction needed — legal-basis review, both items are intact.

### Scenario 4 — Issue 4
1. Trigger an Android-side `TypeError` in CreateTripScreen (e.g. bad OpenAI response).
2. Query `/admin/error-logs` → observe entry with `errorMessage='[API 500] POST /trips'`, `screen='ApiInterceptor'`, no `userId`, no route name, no error type.
3. Trigger same error on iOS. Error log is indistinguishable from Android in `screen`/`errorName` sense.

---

## Priority summary for fix scheduling

| Priority | Issue | Fix complexity | Regression risk |
|---|---|---|---|
| P0 | Issue 1 | Medium (must call `Purchases.logOut()` in `AuthContext.logout` and `handleConfirmDelete`; fix `ADMIN_EMAILS` sync; add `isAdmin` to `/auth/me` payload; fix `aiTripsLimit` for admins to `Infinity` or `n/a`) | Medium — touches billing-adjacent paths. Must keep V169 double-billing guard intact. |
| P1 | Issue 2 | Medium (migrate `addListener('focus')` → `useFocusEffect`; collapse two traveler states into one + derived; guarantee reset ordering) | Low-Medium — CreateTripScreen is critical path but state logic is internal. |
| P2 | Issue 3 | None required | None |
| P2 | Issue 4 | Low (DB migration for 5 new columns; populate from existing data sources in filter + interceptor) | Low — additive only |

---

## Key files (absolute paths) referenced in this analysis

- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/contexts/PremiumContext.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/contexts/AuthContext.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/services/revenueCat.ts`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/components/PaywallModal.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/main/SubscriptionScreen.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/main/ProfileScreen.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/screens/trips/CreateTripScreen.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/navigation/MainNavigator.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/navigation/TripsNavigator.tsx`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/services/api.ts`
- `/Users/hoonjaepark/projects/travelPlanner/frontend/public/licenses.html`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/subscription/subscription.service.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/trips/trips.service.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/common/utils/admin-check.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/auth/auth.service.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/admin/entities/error-log.entity.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/admin/admin.controller.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/admin/admin.service.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/admin/dto/create-error-log.dto.ts`
- `/Users/hoonjaepark/projects/travelPlanner/backend/src/common/filters/all-exceptions.filter.ts`

---

**End of report.** No code was modified. All findings are grounded in specific file:line references.
