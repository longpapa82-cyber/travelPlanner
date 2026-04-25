# V115 QA Auto-Review Report

- Date: 2026-04-15
- Reviewer: QA agent (precision review, no code modifications)
- Scope: V115 fix set (20 change groups) against V112 contract invariants
- Method: git diff HEAD against `main`, cross-checked against PremiumContext, RootNavigator, and i18n resource bundles

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH     | 4 |
| MEDIUM   | 6 |
| LOW      | 5 |

**P0 (CRITICAL + HIGH): 5** → **Gate 5 NOT passed** (requires P0 = 0).

Biggest single issue: the `action: 'refreshed'` 2-way dialog in RegisterScreen never fires because it reads `pendingVerification?.action` from a stale React closure. The entire V114-8 refreshed-register UX regression fix is effectively dead on the first attempt.

---

## CRITICAL

### C1. RegisterScreen refreshed-dialog reads stale `pendingVerification` closure — fix is a no-op on first attempt

- File: `frontend/src/screens/auth/RegisterScreen.tsx:125`
- Related: `frontend/src/contexts/AuthContext.tsx:364` (setPendingVerification → throw)

**Problem**
```ts
// RegisterScreen.tsx
if (error instanceof EmailNotVerifiedError) {
  const action = pendingVerification?.action; // ← stale closure
  if (action === 'refreshed') { Alert.alert(...) }
  return;
}
```
`AuthContext.register()` calls `setPendingVerification({..., action})` and then immediately throws `EmailNotVerifiedError` in the same synchronous tick. The RegisterScreen handler's `pendingVerification` variable was captured at render time — React has not yet rerendered when the catch block runs, so the hook value is still whatever it was before the click (typically `null`, or the stale action from a previous attempt).

Net effect:
- First register attempt on a "refreshed" email → `action` is `undefined` → dialog never shows → silent navigation to EmailVerificationCodeScreen → **identical UX to V114** (the very regression V115 is meant to fix).
- Second attempt (after the user somehow comes back) may see a stale "refreshed" from the previous state.

**Reproduction path**
1. Register `foo@test.com`, abandon verification.
2. Re-register `foo@test.com` in a fresh RegisterScreen mount.
3. Expected: 2-way Alert ("인증 이어가기" / "처음부터 다시 가입").
4. Observed: silent transition to code screen — V114-8 bug is NOT fixed.

**Secondary race**
Even if C1 is fixed, `RootNavigator` unconditionally swaps away from RegisterScreen the instant `pendingVerification !== null` (RootNavigator.tsx:113). On Android, `Alert.alert` is a native dialog that can survive unmount, but the "처음부터 다시 가입" branch then calls `clearPendingVerification()` (navigator pops back), then `registerForce()` (navigator pushes forward again) — a visible flicker and at least one double-mount of `EmailVerificationCodeScreen`.

**Recommended fix** (design-level)
Carry the discriminator on the error, not in shared state:
```ts
// auth.service / EmailNotVerifiedError constructor
throw new EmailNotVerifiedError(resumeToken, user, action);

// RegisterScreen
if (error instanceof EmailNotVerifiedError) {
  if (error.action === 'refreshed') { /* alert */ }
}
```
And gate the RootNavigator transition on an explicit `pendingVerification.confirmed` flag that RegisterScreen sets only after the user chooses "인증 이어가기".

**Priority: Must fix before merge.**

---

## HIGH

### H1. `ErrorLogController.IGNORED_PATTERNS` contains `'abortError'` (mixed case) — will never match

- File: `backend/src/admin/admin.controller.ts:263`

```ts
private static readonly IGNORED_PATTERNS = [
  ...
  'abortError',   // ← mixed case
  'request cancelled',
];

private isExpectedFlowError(message: string): boolean {
  const m = message.toLowerCase();
  return ErrorLogController.IGNORED_PATTERNS.some((p) => m.includes(p));
}
```
`m` is lowercased but `p = 'abortError'` contains an uppercase `E`. A lowercase string can never `.includes('abortError')`. The intended filter will silently pass AbortError frames through to the `error_logs` table — the exact noise this filter was added to eliminate.

**Impact**: admin dashboard continues to drown in cancel-originated AbortErrors. No functional break, but the filter is half-broken as shipped.

**Recommended fix**: change `'abortError'` → `'aborterror'`. Consider `IGNORED_PATTERNS.map(s => s.toLowerCase())` at class load to eliminate the foot-gun entirely.

**Priority: Must fix before merge.**

### H2. `CreateTripScreen` aiInfo branch `aiTripsLimit === -1 / !Number.isFinite` is dead code

- File: `frontend/src/screens/trips/CreateTripScreen.tsx:1606`
- Related: `frontend/src/contexts/PremiumContext.tsx:120-121`

```ts
const AI_TRIPS_PREMIUM_LIMIT = 30;
const aiTripsLimit = (isPremium || isAdmin) ? AI_TRIPS_PREMIUM_LIMIT : AI_TRIPS_FREE_LIMIT; // always 3 or 30
```
In the new UI branch:
```tsx
{isAdmin || aiTripsLimit === -1 || !Number.isFinite(aiTripsLimit) ? ( ... admin label ... )
 : aiTripsRemaining === -1 || aiTripsLimit <= 0 ? ( ... loading ... )
 : ( ... X/Y remaining ... )}
```
`aiTripsLimit` is always a finite positive integer (3 or 30). The `-1 / !isFinite / <=0` guards will never trip in this client. This is harmless cosmetic dead code today, but the comment around it ("Loading state (aiTripsLimit === 0 before profile fetch completes)") is **factually wrong** — there is no such loading state. The actual loading signal is `aiTripsRemaining === -1`, which already had a branch.

Real risk: a future dev relies on that comment and propagates the misunderstanding. Also, premium users (not admin) during profile load now render `30/30 남음` (since PremiumContext returns `AI_TRIPS_PREMIUM_LIMIT` during load) instead of the loading label — mildly inaccurate for ~500ms.

**Recommended**: remove the dead guards, delete the misleading loading comment, or explicitly set `aiTripsLimit === 0` as the loading sentinel in `PremiumContext` (requires coordinated change).

### H3. Premium "월 30회 AI 자동 생성 가능" label is gone — spec says only admin should be special-cased

- File: `frontend/src/screens/trips/CreateTripScreen.tsx:1609-1625`

Before V115, premium saw a static marketing label:
```
프리미엄: 월 30회 AI 자동 생성 가능
```
Now, premium users fall into the same `X/Y회 남음` branch as free users. The V115 comment explicitly calls this out as intentional ("everyone sees the same X/Y format"), but the **screen-level copy no longer surfaces "premium" anywhere** in aiInfo. This is a meaningful functional reduction for the subscription upsell loop — premium users lose positive reinforcement that their paid status is active.

**Recommended**: verify with product that the unified format is the intended regression. If yes, at minimum add a premium badge next to the counter. If no, restore the premium label branch before the counter.

### H4. `register.refreshed.*` and `create.aiInfo.preWarning` i18n keys exist only as `defaultValue` — 16 non-Korean locales will ship Korean strings

- Files:
  - `frontend/src/screens/auth/RegisterScreen.tsx:128-135`
  - `frontend/src/screens/trips/CreateTripScreen.tsx:470`
  - `frontend/src/screens/auth/LoginScreen.tsx:121`
- Search result: `preWarning`, `aiInfo.admin`, `aiInfo.loading`, `register.refreshed`, `login.alerts.emailNotVerified` do not exist in **any** of the 17 `locales/*/{auth,trips,premium}.json` bundles.

All four new strings rely on `t(key, { defaultValue: '한국어 문자열...' })`. English, Japanese, Chinese, Arabic, Hindi, etc. users will see Korean text interrupt their flows.

Not a functional break — i18next falls back gracefully — but the project already ships 17 locales with full translation coverage, and this introduces the first regression of that invariant. Alpha testers in en/ja tracks will flag it as a bug.

**Recommended**: add the 5 new keys to all 17 language bundles before cutting V115. At minimum add ko/en/ja before the Alpha push (Alpha tracks are ko/en/ja-only per the Play Console state).

---

## MEDIUM

### M1. `CoachMark` comment claims "사용자는 오버레이 바깥을 탭하거나" but no tap-outside-to-dismiss handler exists

- File: `frontend/src/components/tutorial/CoachMark.tsx:152-156`

The V115 comment states the skip button was removed because "the user can tap outside the overlay or press Next", but the overlay `<View>`s have no `onPress` / `TouchableWithoutFeedback` wrapper. Tapping outside does nothing. If the tutorial has only the one step (create trip button) the user is forced through `onNext` — which works, but the comment misleads future maintainers.

**Recommended**: either wrap the 4 overlay views in `TouchableWithoutFeedback` bound to `onDismiss`, or remove the misleading comment.

### M2. `onDismiss` prop still required on `CoachMarkProps` but no longer referenced in JSX

- File: `frontend/src/components/tutorial/CoachMark.tsx:43`

`onDismiss` is destructured but unused after the skip button removal. TypeScript `noUnusedLocals`/`noUnusedParameters` may emit a warning if enabled (most RN starters have it off, but the project CI config was not inspected). Also: `HomeScreen.tsx:561` still passes `onDismiss={completeCoach}` on the assumption the CoachMark uses it — it no longer does. `completeCoach` is effectively unreachable via CoachMark.

**Impact**: tutorial completion tracking may miss users who don't press Next (e.g., kill the app during the coach mark). `completeCoach` would otherwise have been called on manual dismissal.

**Recommended**: either restore internal usage (wrap with tap-outside handler) or make `onDismiss` optional in `CoachMarkProps` and document that dismissal is now onNext-only.

### M3. `SubscriptionScreen` comment claims backend `isAdmin=true`, but actual source is a hardcoded frontend email list

- File: `frontend/src/screens/main/SubscriptionScreen.tsx:53-58` (comment)
- Actual source: `frontend/src/contexts/PremiumContext.tsx:9,116`
  ```ts
  const ADMIN_EMAILS = ['a090723@naver.com', 'longpapa82@gmail.com'];
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  ```

The comment names `hoonjae723@gmail.com, longpapa82@gmail.com` as admin accounts. Only `longpapa82` is actually in the frontend list. `hoonjae723` is not admin in frontend; `a090723@naver.com` is admin but not mentioned. Any backend-side `isAdmin` flag is not consulted here at all.

Also the email comparison is case-sensitive (`includes(user.email)` without `.toLowerCase()`), unlike the backend which uses `user.email.toLowerCase()` (subscription.service.ts:96). A capitalized email in the DB will flip admin status between frontend and backend.

**Impact**: QA comment is misleading; the detailed datetime renders only for the two hardcoded emails. Low functional risk, but will confuse future maintainers about where to add admins.

### M4. `/api/version` contract has no enforcement path in the client

- File: `backend/src/app.controller.ts:80-89`

The endpoint is added and documents `minAppVersionCode = 100`, but no frontend change in this diff calls `GET /api/version` on launch. `minAppVersionCode` has zero effect until the client-side gate is implemented. Shipping this now without the client side means the backend has a floor nobody enforces.

Also: `recommendedAppVersionCode: 115` is hardcoded — a redeploy is required to bump it, as the comment notes. That's a deliberate choice but means hotfix rollouts (e.g., V116 blocker) require a full backend deploy to toggle the recommendation.

**Recommended**: either ship the frontend launch-check in the same release, or land `/api/version` as server-only and defer the hardcoded numbers until the client consumes them.

### M5. `register-force` rate limit is 1 per 10 minutes **per IP** — shared NAT / corporate networks lock out innocent bystanders

- File: `backend/src/auth/auth.controller.ts:57`

`@Throttle({ medium: { ttl: 600000, limit: 1 } })` — NestJS throttler default tracker is IP-based. On a school/office/mobile carrier NAT, one user calling `register-force` locks every other user behind the same gateway for 10 minutes. Users will see a cryptic 429 with no recovery path (no route to manual verify from login screen for an unrelated user).

**Recommended**: key by `email` (or `email + IP`) instead of IP-only, or increase limit to `{ limit: 3, ttl: 600000 }` to absorb one accidental double-tap + retry without a lockout.

### M6. `updateConsents` silently skips deprecated types — legacy DB rows remain but never returned to UI

- File: `backend/src/users/users.service.ts:910-912,838`
- Behavior: old `PRIVACY_OPTIONAL` rows stay in `user_consents` forever; `getConsentsStatus` filters them out of responses; `updateConsents` silently ignores incoming updates for them.

Audit trail is preserved (rows aren't deleted) which is good. But:
- A user who wants to **withdraw** their old PRIVACY_OPTIONAL consent has no path — the UI no longer shows it, and the API silently drops the request. Depending on GDPR/privacy jurisdictions, this may be non-compliant (right to withdraw).
- `getConsentsStatus` still computes counts based on the filtered enum — any logic that expects `PRIVACY_OPTIONAL` presence (e.g., analytics gates) will now see the user as "never consented" even if they actually did.

**Recommended**: add a one-shot migration that downgrades any existing `PRIVACY_OPTIONAL` rows to `MARKETING` (its effective semantic successor), or surface a hidden revoke endpoint for compliance.

---

## LOW

### L1. `admin.controller.ts` filter returns `{ filtered: true }` with HTTP 201 — inconsistent with the real create response

- File: `backend/src/admin/admin.controller.ts:276`

Clients sending a filtered error log get a response shape totally different from the non-filtered path. Clients that assume a consistent shape will break. Fire-and-forget loggers probably don't care, but it's a smell.

**Recommended**: return 204 No Content, or mimic the real response shape.

### L2. `email.service.ts` URL change is one-way — old reset/verify emails sitting in users' inboxes now break

- File: `backend/src/email/email.service.ts:82,224`

Pre-V115 password-reset emails contain `/reset-password?token=...`. After backend deploy, those links hit nginx and fall through to `WebAppRedirectScreen`. `isResetOrVerifyPath` in `WebAppRedirectScreen.tsx` does handle the legacy `/reset-password` and `/verify-email` paths, which is good — but the token is **not forwarded to the app** on deep-link open. The user sees "앱에서 진행하세요" and has to re-request a reset.

Verified by reading `WebAppRedirectScreen.tsx`: `token` is captured but never consumed. The "앱 실행" button uses `Linking.openURL(PLAY_STORE_URL)` unconditionally — no intent URI into the app's deep link handler.

**Recommended**: on web, construct an `intent://app/reset?token=...#Intent;...;end` URL and try that before falling back to the Play Store.

### L3. `WebAppRedirectScreen` hardcoded Korean strings; no i18n

- File: `frontend/src/screens/web/WebAppRedirectScreen.tsx:42-56`

All user-facing strings are Korean literals. A non-Korean user hitting mytravel-planner.com sees Korean. Minor — web traffic is overwhelmingly ko for this product — but this is the first hardcoded-string regression in the app.

### L4. `registerForce` analytics event abuse — reuses `register` event with `method: 'email_force'`

- File: `frontend/src/contexts/AuthContext.tsx:408`

Comment acknowledges the analytics schema has a fixed enum of events so it couldn't add `register_force`. Aggregation is now lossy — `register` count includes both real new registrations and abandoned re-starts. Acceptable for Alpha but should get its own event before production.

### L5. `ProfileScreen` `aiTripsLimit > 0 ? aiTripsLimit : 3` fallback is unreachable

- File: `frontend/src/screens/main/ProfileScreen.tsx:483`

Same analysis as H2 — `aiTripsLimit` is always `3` or `30`. The `> 0` guard never fails. Harmless but noise.

---

## Cross-cutting invariant check (V112 contracts)

| Invariant | Status | Notes |
|---|---|---|
| resumeToken scope isolation | PASS | No change to guards or scope. `/auth/register-force` is unauthenticated (no JWT guard), which is correct. |
| pwd_changed token invalidation | PASS | Untouched. |
| Quota rollback guarantee (wave 3) | PASS | Untouched. |
| Cancel authorization (cross-user 403) | PASS | Untouched. |
| No silent AI fallback on cancel | PASS | Untouched. |
| Unverified 24h cleanup cron | PASS | Untouched; `hardDeleteUnverifiedUser` is a new parallel path and does not conflict. |
| `register-force` on verified account → EMAIL_EXISTS | PASS | `AuthService.registerForce` explicitly checks `provider === EMAIL && !isEmailVerified` and throws otherwise. |
| `register-force` → `register()` reuse → race | LOW risk | The current impl calls `hardDeleteUnverifiedUser()` then re-enters `register()`. Between delete and re-create, a parallel `POST /auth/register` from another device would fall into the `!existingUser` branch and create a fresh row — the second inbound `register()` from `registerForce` would then hit the `EMAIL_EXISTS` path via `refreshUnverifiedRegistration`. Not broken, but not atomic. Consider wrapping in a transaction. |
| Rate limit on `register-force` | PARTIAL | See M5: IP-only keying is too coarse for NAT environments. |

---

## Tests not present in diff

- No unit test for `AuthService.registerForce()`.
- No unit test for `UsersService.hardDeleteUnverifiedUser()` rejecting verified/social-provider rows.
- No controller test for `POST /auth/register-force` with `confirmReset: false` → 400.
- No controller test for `ErrorLogController.isExpectedFlowError` pattern matching (which would have caught H1).
- No frontend test for RegisterScreen refreshed-dialog flow (which would have caught C1).

Coverage contribution of this diff is net-negative against the 80% target.

---

## Gate 5 decision

- P0 (CRITICAL + HIGH) count: **5** (1 critical + 4 high)
- Gate 5 criterion: P0 = 0
- **Gate 5: FAIL**

Blocking issues before V115 can ship:

1. **C1** — RegisterScreen stale closure (entire V114-8 fix is inert).
2. **H1** — `abortError` pattern never matches (filter half-broken).
3. **H2 + H3** — aiInfo branching dead code + premium label regression. Low-severity individually, but they live on the same `isPremium` upsell path the previous V111/V112 Alpha reports flagged.
4. **H4** — Missing i18n keys for 16 locales.

C1 alone justifies blocking merge — it nullifies one of the headline V115 fixes.

Recommended path to GO:
1. Fix C1 by carrying `action` on `EmailNotVerifiedError` (or via a ref), not shared state.
2. Fix H1 (one-character change).
3. Add the 5 new i18n keys to ko/en/ja at minimum.
4. Re-evaluate H2/H3 with product; accept if intentional.
5. Add the missing unit tests for `registerForce`/`hardDeleteUnverifiedUser` and the controller 400-path.

Everything else (M1–M6, L1–L5) can ship with V115 as long as tracking issues are filed.
