# V171 Alpha — Root Cause Analysis (Read-Only)

Investigation Date: 2026-04-24
Scope: CreateTripScreen bugs (1-A~1-D), 4/25 error-log surge (Issue 2), longpapa82 subscription anomaly (Issue 3)
Mode: Analysis only. No code changes.

---

## TL;DR

| Issue | Root Location | Root Cause (one line) | Severity |
|---|---|---|---|
| 1-A | `CreateTripScreen.tsx:235-245` vs `CreateTripScreen.tsx:293-296` | `setDurationDays` sets `start = today+1` but after focus-reset effect fires a second time, `startDate` is cleared — the reported symptom is actually an out-of-sync state between `effectiveMode==='ai'` limit check + **stale `startDate`** (empty string `''`) that validates as `new Date('') → Invalid → start <= today` | **P1** |
| 1-B | `CreateTripScreen.tsx:1190` derives "selected" purely from `duration === option.days`; duration is computed from `startDate`/`endDate` only | The button highlight is a derived pseudo-state. Manual date input that produces a non-matching span simply leaves no button highlighted — but there is NO "duration missing" validation path. Symptom "기간 미입력" is actually either (a) i18n mis-display from `create.alerts.datesRequired`, or (b) `IsDateString` DTO rejecting malformed manual input that never passed client validation | **P1** |
| 1-C | `trips.service.ts:212-221` commits AI counter increment in Phase A, **before** Phase B AI call. Phase B failure/timeout leaves the counter permanently decremented. Line 641 comment literally says *"Phase A is already committed — quota stays decremented (correct behavior)"* | **Design decision ≠ user contract.** No compensating decrement anywhere. Applies to: AI timeout, OpenAI 5xx, weather/timezone failure propagating, cancellation-race where abort fires AFTER Phase A commit but BEFORE user cancel button state | **P0** |
| 1-D | `CreateTripScreen.tsx:743-784` focus listener DOES reset form. | If symptom is real, it is a **stale-closure or focus-event-not-firing** edge case — e.g., `navigation.reset({routes: [...]})` on line 549 replaces the stack; on back-navigation to CreateTrip, a **pre-existing rendered instance** may not receive a new `focus` event. Alternatively `planningMode` is reset to `'ai'` on line 777 even when `isAiLimitReached` is true, which then forces manual in the effect on 148 — a visible flip | P2 |
| 2 | `all-exceptions.filter.ts:107-139` 5xx + 429 + auth-4xx auto-persists; `trips.service.ts:94-120` logs SLOW phases as `severity='warning'`. Client `reportError` path at `admin.controller.ts:285-306` also writes client-reported errors | 4/25 log surge candidates: (a) OpenAI rate-limit spill after V170 deploy, (b) `[TripCreation] SLOW: ai_generating` warnings from timeouts, (c) client `CreateTripScreen` error-reporting (`api.ts:682-687`). Exact distribution requires DB query — see §7 | P1 |
| 3 | `subscription.service.ts:336-341` `isUserPremium()`: `tier==='premium' && (!expiresAt || new Date(expiresAt) > new Date())`. Plus Redis cache TTL `PREMIUM_CACHE_TTL = 5 * 60 * 1000` ms (line 25) | License Tester **monthly** cycles are 5 minutes but `isSandbox` only flags `yearly` (line 114-120). If RevenueCat `EXPIRATION` webhook is delayed/dropped, DB `subscriptionExpiresAt` stays far-future. Also `isAdmin` on status API is from env `ADMIN_EMAILS` but quota check in trips.service uses DB `role` column — **two different admin signals** that can diverge | P2 |

---

## 1. File/Function/Line Bug Map

### 1-A: "기간 버튼 선택 시 startDate = today"

**Claim**: User reports `setStartDate(today)` when a duration button is pressed.

**Reality (code evidence)** — `frontend/src/screens/trips/CreateTripScreen.tsx:235-245`:

```
setDurationDays(days) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);   // ✅ tomorrow
  const start = new Date(tomorrow);
  const end   = new Date(tomorrow);
  end.setDate(end.getDate() + days - 1);
  setStartDate(start.toISOString().split('T')[0]);
  setEndDate(end.toISOString().split('T')[0]);
  ...
}
```

The code **does set start = today+1**. So what does the user actually see?

**Hypothesis A — `minStartDate` vs `startDate` drift**: `minStartDate` is a `useMemo(..., [])` (line 171-176). It freezes `today+1` at mount time. If the screen remains mounted across midnight, `minStartDate` is stale but `setDurationDays` uses a fresh `new Date()`. Not the reported symptom.

**Hypothesis B — `.toISOString().split('T')[0]` timezone drift (most likely)**: Line 242:
```
setStartDate(start.toISOString().split('T')[0])
```
`toISOString()` converts to **UTC**. For a user in KST (UTC+9) at local time e.g. `2026-04-24 06:00 KST`, `tomorrow = today+1 at local 06:00 = 2026-04-25 06:00 KST` → UTC `2026-04-24 21:00` → `.split('T')[0]` = `"2026-04-24"` — which is **today's date in KST**.

Then the validation at line 291-296:
```
const start = new Date(startDate + 'T00:00:00'); // → 2026-04-24 00:00 local
const today = new Date();
today.setHours(0, 0, 0, 0);                      // → 2026-04-24 00:00 local
if (start <= today) errors.dates = t('create.alerts.startDateFuture');
```
`start === today` → `start <= today` is true → **"출발일은 내일 이후여야 합니다"** error. **This exactly matches the reported symptom.**

Same class of bug exists for `end.toISOString()` → `endDate` can land one day earlier than intended for [당일] in certain timezones.

**Root cause**: `.toISOString()` always serializes in UTC, but the user-facing "tomorrow" computed from `new Date()` is in local time. For any user west of UTC (negative offset), or any user east of UTC when wall-clock is ≥ `24 - offsetHours`, the ISO date string is **one calendar day earlier than the user expects**.

**Evidence**:
- Location `CreateTripScreen.tsx:235-245` + `CreateTripScreen.tsx:288-300`
- Same anti-pattern at `CreateTripScreen.tsx:171-176` for `minStartDate` (uses local `new Date()`) but validation at 291 uses string concat `+ 'T00:00:00'` → parsed as LOCAL. Mismatch only appears in `setDurationDays` via `toISOString()`.

---

### 1-B: "수동 입력 시 기간 버튼 해제 → '기간 미입력'"

**Claim**: Pressing a duration chip, then manually editing the end date, causes the button chip to deselect. Submitting then fails with "기간 미입력".

**Reality (code evidence)**:

Button "selected" highlight is a **derived value** — `CreateTripScreen.tsx:1189-1190`:
```
const isSelected = duration === option.days;
```
And `duration` is computed by `calculateDuration()` on line 269-275:
```
const start = new Date(startDate);
const end = new Date(endDate);
const diff = Math.ceil((end - start) / (1000*60*60*24));
return diff + 1;
```

So:
- Tap [3일] → `setStartDate(tomorrow)`, `setEndDate(tomorrow+2)` → `duration === 3` → 3일 chip highlighted. ✅
- Manually edit endDate to tomorrow+4 → `duration` becomes 5 → no chip matches → **no chip highlighted, but dates are still valid**. ✅

**There is no "presetDuration" mutex state.** Button selection is derived, not stored. So 1-B's premise — that button deselection causes "기간 미입력" — is **structurally impossible with the current code**.

**What actually causes the reported "기간 미입력" error?** Look at `CreateTripScreen.tsx:288-289`:
```
if (!startDate || !endDate) {
  errors.dates = t('create.alerts.datesRequired');
}
```
This only fires when `startDate === ''` or `endDate === ''`. Manual edit does not clear either. Possibilities:

1. **DatePicker onChange emits empty string on invalid manual typing**. Check `frontend/src/components/core/DatePicker.tsx` (not read in this session). If `onChange('')` can fire on invalid input, `setEndDate('')` would trigger this path.
2. **Misattribution**: The real error message shown is `create.alerts.startDateFuture` ("출발일은 내일 이후여야 합니다") due to the timezone bug in 1-A, and the user is reading that as "기간 미입력".
3. **Backend `@IsAfterDate('startDate')` rejects manual dates** where `endDate < startDate` after user edits end first — but DTO rejection returns `message: "endDate must be on or after startDate"`, not "기간 미입력".

**Recommended verification**: Read `DatePickerField.tsx` onChange contract.

---

### 1-C: AI 횟수 차감 후 실패 (P0 — the critical one)

**Evidence trail** — `backend/src/trips/trips.service.ts`:

Phase A (lines 149-260) does **inside a SINGLE transaction**:
1. `SELECT ... FOR UPDATE` the user row (line 163-174)
2. Read `aiTripsUsedThisMonth` (line 180)
3. Limit-check (line 201-209) — throws `ForbiddenException` if reached
4. `UPDATE users SET aiTripsUsedThisMonth = aiTripsUsedThisMonth + 1` (line 215-220)
5. INSERT into trips with `aiStatus: 'generating'` (line 236-243)
6. `commitTransaction()` (line 246)

Phase B (lines 268-553) does, **outside any transaction**:
1. `progress$.next({step: 'validating'})`
2. `getLocationInfo` with 5s timeout (line 304-314)
3. `getTimezoneInfo` with 5s timeout (line 326-338)
4. `aiService.generateAllItineraries(...)` — no timeout at the service level
5. `weatherService.getWeatherForDateRange` with 5s timeout
6. `finalAiStatus = 'success'` or `'failed'` or TripCancelledError thrown

**The quota decrement is already committed by the time Phase B starts.**

The outer catch (line 640-651) handles Phase B failures:
```
} catch (error) {
  // Phase A is already committed — quota stays decremented (correct behavior).
  // Trip is already persisted with aiStatus: 'generating' or 'failed'.
  if (!(error instanceof TripCancelledError)) {
    await markTripFailed(`Pipeline error: ${getErrorMessage(error)}`);
  }
  ...
  throw error;
}
```

**There is no `UPDATE users SET aiTripsUsedThisMonth = aiTripsUsedThisMonth - 1` anywhere.** The counter is only ever reset by the monthly cron at `subscription.service.ts:617-626`.

**Failure paths that burn a quota**:

| Phase B failure | What happens | Counter rollback? |
|---|---|---|
| OpenAI rate limit / 5xx | AI fallback (line 543 sets `finalAiStatus='failed'`, empty itineraries saved in Phase C) | NO |
| OpenAI timeout | Falls into catch at line 526, `finalAiStatus='failed'` | NO |
| `getLocationInfo` timeout | Caught at line 343, proceeds with `locationInfo=null`, AI still runs | NO (but trip continues) |
| User cancels mid-flight (V112 fix #4 via abort) | `TripCancelledError` throws in Phase B, reaches outer catch at 640, `markTripFailed` called | **NO** (explicit comment line 641) |
| Phase C itinerary save failure (DB error) | `throw saveError` on line 615 → outer catch | NO |
| Network error between client and backend after Phase A commit | Server-side: no error signal reaches the handler. Trip sits at `aiStatus='generating'` forever unless Phase B completes | NO |

**Worst case** (matches user report "실패했는데 차감됨"):
- AI fails → fallback path creates empty itineraries → trip persists with `aiStatus='failed'` → frontend shows toast at `CreateTripScreen.tsx:494-500` ("AI 자동 생성 실패 — 빈 일정으로 저장됨") → user sees "실패" but quota already +1.

This is exactly the "free user quota 도둑질" vector the user described.

**Also note**: The catch block does NOT rethrow when AI fallback succeeds — line 526-552 swallows the AI error, creates empty itineraries, Phase C commits them. From the server's perspective this is a **success** (returns trip with `aiStatus='failed'`). But from the user's perspective it's a failure.

**Concurrence with client**: Client polling (`api.ts:572-588`) treats `status==='completed'` as success. Even if `trip.aiStatus === 'failed'`, the client counts this as a successful generation. `refreshStatus()` then re-reads the user and sees the bumped counter. The frontend toast on line 494-500 warns the user, but **from their mental model the trip "failed" → quota should not be consumed**.

---

### 1-D: "재진입 시 이전 입력값 잔존"

**Evidence** — `CreateTripScreen.tsx:743-784`:

The focus listener:
```
navigation.addListener('focus', () => {
  setFieldErrors({});
  setIsLoading(false);
  ...
  setDestination('');
  setStartDate('');
  setEndDate('');
  setNumberOfTravelers(1);
  ...
  setPlanningMode('ai');
  ...
});
```

The listener IS present and DOES reset all form fields. BUT:

**Subtle bug candidates**:

1. **`planningMode` reset to `'ai'` conflicts with `isAiLimitReached` effect (line 147-151)**. When focus fires:
   - Line 777: `setPlanningMode('ai')` schedules re-render
   - Line 146 on next render: `effectiveMode = isAiLimitReached ? 'manual' : planningMode` — for limit-reached users, still 'manual'. OK.
   - Line 147-151 effect: re-runs, calls `setPlanningMode('manual')` again. Two re-renders. Visible flip.
2. **Preferences auto-fill useEffect (line 180-189)** runs on mount only (empty deps). On focus, form resets but `prefBudget`/`prefStyle`/`prefInterests` do NOT re-fetch. After focus reset, they stay empty — UNLESS a previous mount already loaded them and the component never unmounted. This wouldn't leave "stale" values; rather, **it prevents auto-fill from happening again**.
3. **AsyncStorage `@rewarded_ad_destination` (line 118-128)**: `useEffect` runs once at mount. If the screen remained mounted and the user comes back via navigation (not reset), this does not re-read. Only affects rewarded-ad persistence, not general state.
4. **After navigation.reset at line 549 to TripDetail**, going back to CreateTrip via `navigation.goBack()` or bottom tab does fire focus. But if the user dismisses via system back gesture in a way that skips the tab-bar remount, React Navigation may re-use the instance → focus fires → reset runs. Should be OK.

**Most likely explanation**: User-perceived "잔존" is in fact state that was re-populated by the **route.params effect (line 192-202)**:
```
useEffect(() => {
  const params = route.params;
  if (!params) return;
  const hasParams = params.destination || params.duration || params.travelers;
  if (!hasParams) return;
  if (params.destination) handleSelectDestination(params.destination);
  if (params.duration)    handleSelectDuration(params.duration);
  if (params.travelers)   handleSelectTravelers(params.travelers);
  navigation.setParams({ destination: undefined, duration: undefined, travelers: undefined });
}, [route.params]);
```

If the user navigates to CreateTrip from a "popular destination" card that passes `route.params.destination`, focus listener fires first and resets, then this effect fires with stale params and re-fills. Then `setParams({destination: undefined})` happens but the damage is done. Racy between `focus` reset and `route.params` re-fill.

---

### Issue 2: 4/25 ErrorLog surge

**Sources that write to `error_logs` table**:

| Writer | File | Line | Trigger |
|---|---|---|---|
| `AllExceptionsFilter` | `common/filters/all-exceptions.filter.ts` | 125-138 | Any 5xx HTTP response, 429 throttler, 4xx on `/auth/*`, 4xx on `/admin/*`, 5xx on `/subscription/*` |
| `adminService.createErrorLog` | `admin/admin.service.ts` | 173-187 | Called by `ErrorLogController.createErrorLog` (POST `/error-logs`) |
| `ErrorLogController` (client relay) | `admin/admin.controller.ts` | 285-306 | Client `apiService.reportError(...)` POST. `IGNORED_PATTERNS` silently drop expected-flow messages |
| `trips.service.ts` `logSlowPhase` | `trips/trips.service.ts` | 94-120 | Phase exceeding `SLOW_THRESHOLDS` (validating 5s, weather 5s, ai_generating 60s, saving 3s, total 60s). Severity `warning` |

**Client error reporters that hit `/error-logs`**:
- `CreateTripScreen.tsx:588-593` — SSE stream interrupted after trip creation (severity `warning`)
- `CreateTripScreen.tsx:682-687` — Trip creation failure (severity `error`, includes `error.message` and `error.stack`)
- (Other screens likely — grep for `reportError` in `frontend/src/`)

**Filter — ignored substrings** (`admin.controller.ts:262-278`):
```
'monthly ai generation limit', 'ai 생성 제한', 'trip creation cancelled',
'여행 생성 취소', 'throttlerexception', 'too many requests', 'paywallerror',
'aborterror', 'request cancelled', 'api 504', 'network error', 'timeout of',
'잘못된 인증 정보', 'authentication required', 'invalid credentials'
```

**What would a 4/25 spike look like after V170 deploy?**
- If V170 introduced a new error not in IGNORED_PATTERNS, every occurrence writes a row.
- If V170 changed a message ("AI 생성 실패" vs "AI generation failed"), a previously-filtered pattern may now bypass the filter.
- If V170 slowed AI generation (prompt bloat?), `logSlowPhase` may now routinely fire for `ai_generating`.

**To identify the category**: see §7 runtime query.

---

### Issue 3: longpapa82 subscription

**`isUserPremium()` at `subscription.service.ts:336-341`**:
```
private isUserPremium(user: Partial<User>): boolean {
  return (
    user.subscriptionTier === SubscriptionTier.PREMIUM &&
    (!user.subscriptionExpiresAt ||
     new Date(user.subscriptionExpiresAt) > new Date())
  );
}
```

**Failure modes**:

1. **Stale `subscriptionExpiresAt` from missed RevenueCat webhook**
   - When a Google Play License Tester subscription "expires" (5 min for monthly, 30 min for yearly), RevenueCat should fire `EXPIRATION` → webhook → `CANCELLATION/EXPIRATION` switch at line 287-297 updates `subscriptionTier = FREE`.
   - If the webhook fails (network, signing mismatch, outage), `subscriptionTier` stays `premium` AND `subscriptionExpiresAt` stays at the originally-granted far-future date → `isUserPremium()` returns `true` forever.
   - RevenueCat delivery is NOT guaranteed in-order or at-most-once; dropped events are a known failure mode.

2. **5-minute Redis cache (line 25, `PREMIUM_CACHE_TTL = 5 * 60 * 1000`)**
   - After a legitimate expiry, the next `isPremiumUser(userId)` call (line 304-327) returns the cached `'true'` for up to 5 more minutes. Small window, but real.

3. **`isSandbox` only flags yearly plans** (line 114-120):
   - Monthly License Tester cycles (5 min) are NOT flagged as sandbox by the API response.
   - Frontend UI may therefore show "monthly" user as real premium.

4. **AI counter bypass for admin is done by DB `role` column, not env `ADMIN_EMAILS`**:
   - `trips.service.ts:183-231`: admin exemption uses `user.users_role === 'admin'` (DB column).
   - `subscription.service.ts:99-100`: `isAdmin` flag returned to UI uses `ADMIN_EMAILS` env list.
   - If `longpapa82@gmail.com` is in `ADMIN_EMAILS` env but `users.role = 'user'` in DB:
     - API returns `isAdmin: true` → frontend shows unlimited.
     - But each AI trip creation still runs the quota increment (since DB role != 'admin').
     - Counter climbs past 3 for free/non-premium but limit never triggers because `isPremium` is true.

5. **`aiTripsUsedThisMonth` monthly reset cron** (line 617-626):
   - Runs on the 1st of each month at midnight (`CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT`).
   - Timezone of the cron: server default (UTC on Hetzner unless overridden).
   - If `longpapa82` created many trips on 4/1–4/23 UTC, the counter stays high until 5/1 UTC. No relevance to "구독 만료" but explains "자동 횟수도 초과될 만큼 사용했을 것".

**Most likely root cause for longpapa82 subscription anomaly**:
- (a) DB `subscriptionTier = 'premium'` AND `subscriptionExpiresAt` in the far future because the RevenueCat `EXPIRATION` webhook was never received (sandbox vs prod mismatch, webhook secret rotation, etc.), OR
- (b) `longpapa82@gmail.com` is in `ADMIN_EMAILS` → frontend displays premium/unlimited without any DB backing. Needs env var + DB value to disambiguate.

---

## 2. State Transition Diagram — Duration & Date

```
            [mount]
               │
               ▼
          startDate=""
          endDate=""
          duration=calculateDuration()=null
          chips: none highlighted
               │
               ├──[tap 3일 chip]─────────────────┐
               │                                 │
               ▼                                 │
        setDurationDays(3):                     │
        start = today+1 (local clock)           │
        end   = today+3                          │
        setStartDate(start.toISOString().       │
                      split('T')[0])             │  ← TIMEZONE DRIFT: can yield "today" in KST
        setEndDate(...)                          │
               │                                 │
               ▼                                 │
        startDate="2026-04-25" (intended)       │
        endDate="2026-04-27"                     │
        duration = 3                             │
        chip "3일" highlighted (isSelected=true)│
               │                                 │
               ├──[manual: edit endDate to       │
               │       2026-04-29]               │
               │                                 │
               ▼                                 │
        endDate="2026-04-29"                     │
        duration = 5                             │
        chip "3일" NO LONGER highlighted         │
        chip "5일" does not exist in options     │
        NO chip highlighted — but dates valid   │
               │                                 │
               ├──[tap Create]                   │
               │                                 │
               ▼                                 │
        validation runs:                         │
          startDate !== '' ✓                    │
          endDate   !== '' ✓                    │
          start+'T00:00:00' parsed LOCAL        │
          today = now with H/M/S zeroed LOCAL   │
          if start <= today: "startDateFuture"  │ ← triggers in TZ-drift case
          else if start > end: "startDateReq"    │
               │                                 │
               ▼                                 │
        (either errors.dates OR proceeds)       │
```

There is no `presetDuration` state field — the chip highlight is purely a rendered derivation from `calculateDuration()`. So the user's intuition that "chip deselection = bad state" is wrong; the chip is just a UI affordance, not the source of truth.

---

## 3. Reproduction Scenarios

### Repro 1-A (timezone drift on preset duration button)

Preconditions: User device in timezone UTC+9 (KST) at local time ≥ 15:00 (so that local `today+1 at 00:00:00` falls into UTC `today at 15:00`).

1. Open app at, say, 16:30 KST on 2026-04-24.
2. Enter destination "Tokyo".
3. Tap [당일] (1 day) button.
4. Expected: `startDate` display = 2026-04-25, `endDate` = 2026-04-25.
5. Actual (if hypothesis B is correct): `startDate` display = 2026-04-24, `endDate` = 2026-04-24.
6. Tap "여행 만들기".
7. Validation at line 291-296:
   - `start = new Date('2026-04-24T00:00:00')` → local 2026-04-24 00:00 KST
   - `today = new Date()` with H/M/S zeroed → local 2026-04-24 00:00 KST
   - `start <= today` → **true**
   - Error: `create.alerts.startDateFuture` ("출발일은 내일 이후여야 합니다")
8. **User reads this as "1-A: startDate가 오늘로 설정됨"**.

Verification command (browser DevTools or RN debugger with user's timezone mocked):
```js
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
console.log(tomorrow.toISOString().split('T')[0], 'vs expected local', 
            tomorrow.toLocaleDateString());
```

### Repro 1-B (manual edit → no button highlight)

1. Tap [3일] chip → `startDate` filled, `endDate` filled, chip highlighted.
2. Tap the end date picker, change to a date 5 days after start.
3. Observe: [3일] chip no longer highlighted. No other chip highlighted.
4. Tap "여행 만들기".
5. Behavior (per code): validation passes, request goes through. User may **misattribute** any subsequent error to "button not selected".
6. Only way to get "기간 미입력": `endDate` somehow becomes `''`. Requires DatePicker quirk — needs `DatePickerField.tsx` inspection.

### Repro 1-C (AI fails, quota consumed — P0)

Preconditions: free user with `aiTripsUsedThisMonth = 2` (1 remaining).

Method A — simulated AI failure:
1. Stop or rate-limit the OpenAI API key (or set `OPENAI_API_KEY=invalid`).
2. From client: tap "여행 만들기" in AI mode.
3. Server: Phase A commits, `aiTripsUsedThisMonth = 3`.
4. Server: Phase B `aiService.generateAllItineraries` fails → catch at trips.service.ts:526 → `finalAiStatus = 'failed'` → empty itineraries → Phase C commits.
5. Server returns trip with `aiStatus='failed'`.
6. Client: `refreshStatus()` reloads user → `aiTripsRemaining = 0`.
7. Client shows toast "AI 자동 생성 실패 — 빈 일정" and navigates to TripDetail.
8. User sees: quota spent on a failed trip.

Method B — user cancels mid-flight:
1. Tap "여행 만들기".
2. After `/trips/create-async` responds with jobId (Phase A already committed server-side), tap "취소".
3. Client `cancelTripJob(jobId)` → `DELETE /trips/jobs/:jobId`.
4. Server `cancelJob` fires abortController.
5. Phase B throws `TripCancelledError`.
6. `markTripFailed` marks the trip as failed. **No counter decrement.**
7. Client shows "여행 생성이 취소되었습니다".
8. User sees: counter bumped despite cancellation.

### Repro 1-D (form values persist)

1. On CreateTripScreen, enter destination + dates + budget.
2. Do NOT submit.
3. Tap bottom-tab to switch to another screen, then tap "여행 만들기" tab again.
4. Expected: focus listener (line 743) resets all fields to defaults.
5. If instance is remounted cleanly: fields reset. ✅
6. If `route.params` contains leftover values from a popular-destination tap elsewhere: the params effect (line 192-202) refills AFTER the reset.
7. User sees: partial re-fill.

### Repro 3 (subscription survives past expiry)

1. Create a Google Play License Tester subscription (monthly, 5-min cycle).
2. Purchase. Server receives RevenueCat `INITIAL_PURCHASE` webhook.
3. DB: `subscriptionTier = premium`, `subscriptionExpiresAt = +5min`.
4. Wait 5+ minutes.
5. Expected: RevenueCat fires `EXPIRATION` webhook → `subscriptionTier = FREE`.
6. Actual (if webhook fails): DB still `premium`, `expiresAt` now in the past.
7. `isUserPremium()` at line 339-340: `new Date(user.subscriptionExpiresAt) > new Date()` → `false` → returns `false` ✅ despite tier=premium.
8. **But**: `/subscription/status` returns `isPremium: false` correctly in step 7.
9. **BUT**: `usersService.getProfile()` (on frontend) may return cached `subscriptionTier: 'premium'` and `subscriptionExpiresAt: <past>`. The frontend `isPremium` check at `PremiumContext.tsx:260-282`:
   ```
   if (user?.subscriptionTier === 'premium') {
     if (!user.subscriptionExpiresAt) return true;
     if (new Date(user.subscriptionExpiresAt) >= new Date()) return true;
   }
   ```
   — checks expiresAt too, so should return false.
10. **More likely root cause**: `rcEntitlement` snapshot on RC listener push kept `source: 'listener'` with `expiresAtMs` in the future even though RC already expired the entitlement. Or `expiresAtMs === null` (grant with no known expiry). Line 272-279 would return `true`.

Check: `rcEntitlement` is set by `markPremium()` (line 330-358) on purchase. Without a `markPremium` on expiry (there is no listener path that clears it), `rcEntitlement` **persists until component unmount or app restart**.

---

## 4. Symptom → Root Cause Matrix

| Symptom | Primary Root Cause | Secondary / Compounding | Code Locations |
|---|---|---|---|
| "버튼 누르면 startDate가 오늘" | `toISOString().split('T')[0]` uses UTC, not local TZ | `minStartDate` frozen at mount with `useMemo(..., [])` | `CreateTripScreen.tsx:242-243, 171-176` |
| "출발일 검증 실패로 생성 차단" | Same TZ drift → `start === today` locally → `start <= today` trips the error | Validation on 295 uses local parse; chip setter uses UTC parse — mismatch | `CreateTripScreen.tsx:288-300` |
| "수동 입력 시 버튼 해제" | Button highlight is **derived** from `duration === option.days`, not stored. Any manual change to a non-option span deselects | No actual "presetDuration" state | `CreateTripScreen.tsx:1189-1190, 269-275` |
| "기간 미입력 에러" | Most likely `create.alerts.startDateFuture` misread OR DatePicker emits `''` on partial manual input | Also can be DTO rejection showing server error | `CreateTripScreen.tsx:288-289, 669-679` |
| "실패했는데 AI 횟수 차감" (P0) | Phase A commits counter BEFORE Phase B runs. No decrement on Phase B failure. Explicit design comment at line 641 acknowledges this | `TripCancelledError` path also skips decrement (line 644) | `trips.service.ts:212-221, 246, 640-651` |
| "재진입 시 이전 값 잔존" | `route.params` effect refills AFTER focus reset | `planningMode` re-set to 'ai' then forced to 'manual' flicker | `CreateTripScreen.tsx:192-202, 743-784` |
| "4/25 오류 로그 증가" | AllExceptionsFilter auto-persist + client reportError + logSlowPhase — exact source requires DB query | V170 deploy may have changed error messages or slowed AI | `all-exceptions.filter.ts:107-139`, `trips.service.ts:94-120`, `admin.controller.ts:285-306` |
| "구독 만료 미반영" | (a) Missed RevenueCat EXPIRATION webhook leaves DB stale; OR (b) `rcEntitlement` snapshot persists in client PremiumContext without expiry-check-against-fresh-now | 5-min Redis cache (PREMIUM_CACHE_TTL) adds a small grace window | `subscription.service.ts:336-341, 304-327`, `PremiumContext.tsx:272-280` |
| "License Tester 5분 만료인데 유지" | `isSandbox` only flags yearly → monthly cycles look like real subs. Also, no sandbox-specific early-expiry in `isUserPremium` | RevenueCat sandbox webhook reliability | `subscription.service.ts:114-120` |
| "AI 횟수 초과 사용 정황" | `trips.service.ts:183-188`: admin users bypass limit via DB `role` column. If `role=admin` at DB level, counter still increments (line 219) but no limit check | Admin user counter therefore grows unbounded | `trips.service.ts:183-231` |

---

## 5. Priority & Triage

### P0 — Fix before next release
**1-C: AI quota decremented on failure/cancel**

- Affects every free user who experiences any AI failure.
- Design-by-code: explicit acknowledgment at `trips.service.ts:641` that this is "correct behavior" — but the **user-facing contract** is otherwise.
- Fix candidates (for later, not this analysis):
  - Move counter increment to **after** Phase C commit.
  - Or add a compensating decrement in the outer catch when `!(error instanceof QuotaExceededException)`.
  - Or treat `aiStatus='failed'` as a "refundable" state and run a cleanup cron.

### P1 — Fix this release
**1-A: Timezone drift on preset duration buttons**

- Breaks the primary flow (duration chips). Deterministic failure for users east of UTC in evening hours and west of UTC in morning hours.
- Fix scope: replace `.toISOString().split('T')[0]` with a local-date formatter.

**1-B: DatePicker onChange contract**

- If `DatePickerField` emits `''` on invalid manual entry, the validation at 288 will fire "기간 미입력" on manual edit.
- Need to inspect `frontend/src/components/core/DatePicker.tsx`.

**2: 4/25 error log surge**

- Not blocking but indicates a regression from V170.
- Requires runtime data collection (§7).

### P2 — Fix when convenient
**1-D: Form state race between focus reset and route.params effect**

- Edge case. Only reproducible when user navigates from a popular-destination tap to CreateTrip with leftover route params.

**3: License Tester premium persistence**

- Dev-only path (production users cannot trigger 5-min cycles unless they are also License Testers).
- `isSandbox` flag could be extended to monthly.
- Webhook reliability is a separate ops concern.

---

## 6. Key Line-References

Consolidated for quick lookup:

**Frontend — `frontend/src/screens/trips/CreateTripScreen.tsx`**:
- `94-96` state: `startDate`, `endDate`, `numberOfTravelers`
- `171-176` `minStartDate` (useMemo, stale across midnight)
- `192-202` `route.params` refill effect — refills after focus reset
- `235-245` `setDurationDays` — **TZ drift location (line 242-243)**
- `247-250` `handleSelectDuration` — wraps setDurationDays
- `269-275` `calculateDuration` — derived from startDate/endDate
- `277-320` `handleCreateTrip` — validation including line 291-296 **start <= today check**
- `349-720` `doCreateTrip` — polling, error handling, toast
- `562-709` outer catch — client error path, calls `reportError` and `Sentry.captureException`
- `682-687` client ErrorLog write
- `743-784` focus listener — form reset
- `1189-1190` chip isSelected derivation
- `1238-1266` DatePickerField consumers — check for onChange emitting `''`

**Backend — `backend/src/trips/trips.service.ts`**:
- `33-40` `SLOW_THRESHOLDS` (feeds logSlowPhase)
- `63-68` `TripCancelledError` class
- `94-120` `logSlowPhase` — writes ErrorLog rows for slow phases
- `122` `create(userId, createTripDto, language, progress$, signal)` signature
- `149-260` **Phase A** (SELECT FOR UPDATE, limit check, increment, insert trip, commit)
- `183-231` **admin exemption** (uses DB `role` column, not env ADMIN_EMAILS)
- `212-221` **counter increment — committed before Phase B**
- `263-553` Phase B
- `526-552` AI fallback path (`finalAiStatus='failed'`)
- `557-618` Phase C (itinerary save)
- `640-651` **outer catch — explicit "quota stays decremented" comment (line 641)**

**Backend — `backend/src/trips/trips.controller.ts`**:
- `83-101` `createAsync` — hands off to JobsService, returns `jobId`
- `115-122` `cancelJob` (DELETE)
- `141-197` `startTripCreation` — background worker
- `181-196` catch — propagates to JobsService status='error' or 'cancelled'

**Backend — `backend/src/trips/jobs.service.ts`**:
- `101-132` `cancelJob` — fires AbortController
- `168-175` `getJob` — polling endpoint handler

**Backend — `backend/src/subscription/subscription.service.ts`**:
- `25` `PREMIUM_CACHE_TTL = 5 * 60 * 1000` ms
- `27-31` `ADMIN_EMAILS` env parse
- `72-135` `getSubscriptionStatus` — returns `isAdmin` (env), `isPremium` (DB)
- `99-100` **isAdmin from env, not DB role**
- `114-120` **isSandbox only for yearly**
- `149-155` `incrementAiTripCount` — public method, NOT called by trips.service.create
- `287-297` `EXPIRATION` event handler
- `304-327` `isPremiumUser` — Redis-cached
- `336-341` **`isUserPremium` predicate — tier AND (no expiry OR expiry > now)**
- `617-626` Monthly cron reset

**Backend — `backend/src/common/filters/all-exceptions.filter.ts`**:
- `22-138` `catch` — 5xx/429/auth-4xx auto-persist
- `166-173` `EXPECTED_ERROR_NAMES` (filter)
- `183-212` `shouldLogError` routing
- `219-286` MESSAGE_MAP i18n

**Backend — `backend/src/admin/admin.controller.ts`**:
- `246-307` `ErrorLogController` (client-relay)
- `262-278` `IGNORED_PATTERNS` substring filter
- `285-306` `createErrorLog` — writes via adminService

**Backend — `backend/src/admin/admin.service.ts`**:
- `173-187` `createErrorLog`
- `189-295` `getErrorLogStats` (used by dashboard)
- `297-327` `getErrorLogs` (pagination)

**Backend — `backend/src/admin/entities/error-log.entity.ts`**:
- Full schema — 52 lines, columns: `userId`, `userEmail`, `errorMessage`, `stackTrace`, `screen`, `severity`, `deviceOS`, `appVersion`, `platform`, `userAgent`, `isResolved`, `createdAt`.

---

## 7. Runtime Data Collection Guide (for the user to run)

### 7.1 Connect to prod DB

```bash
# SSH to Hetzner
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# Enter backend container (postgres client inside or via docker exec)
cd /root/travelPlanner/backend
docker compose ps
# Identify postgres container name, e.g. backend-postgres-1
docker compose exec postgres psql -U postgres -d travelplanner
```

### 7.2 Issue 2 — 4/25 error log breakdown

```sql
-- Total count for 4/25 (server-local or UTC — confirm with SHOW TIMEZONE;)
SELECT COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-25 00:00:00'
  AND created_at <  '2026-04-26 00:00:00';

-- Breakdown by severity
SELECT severity, COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-25 00:00:00'
  AND created_at <  '2026-04-26 00:00:00'
GROUP BY severity
ORDER BY 2 DESC;

-- Breakdown by screen (endpoint)
SELECT screen, COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-25 00:00:00'
  AND created_at <  '2026-04-26 00:00:00'
GROUP BY screen
ORDER BY 2 DESC
LIMIT 20;

-- Top error messages
SELECT LEFT(error_message, 200) AS msg, COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-25 00:00:00'
  AND created_at <  '2026-04-26 00:00:00'
GROUP BY LEFT(error_message, 200)
ORDER BY 2 DESC
LIMIT 20;

-- Slow-phase vs real errors
SELECT
  CASE
    WHEN error_message LIKE '[TripCreation] SLOW:%' THEN 'slow_phase'
    WHEN error_message LIKE '%AI generation%'       THEN 'ai_failure'
    WHEN error_message LIKE '%timeout%'             THEN 'timeout'
    WHEN error_message LIKE '%OpenAI%'              THEN 'openai'
    WHEN error_message LIKE '%weather%'             THEN 'weather'
    ELSE 'other'
  END AS category,
  COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-25 00:00:00'
  AND created_at <  '2026-04-26 00:00:00'
GROUP BY 1
ORDER BY 2 DESC;

-- Platform distribution
SELECT platform, COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-25 00:00:00'
  AND created_at <  '2026-04-26 00:00:00'
GROUP BY platform;

-- Compare with 4/24 for baseline
SELECT DATE(created_at) AS day, COUNT(*)
FROM error_logs
WHERE created_at >= '2026-04-20'
  AND created_at <  '2026-04-26'
GROUP BY 1
ORDER BY 1;
```

### 7.3 Issue 3 — longpapa82 subscription state

```sql
-- Current state
SELECT id, email, role, subscription_tier, subscription_platform,
       subscription_plan_type, subscription_started_at, subscription_expires_at,
       ai_trips_used_this_month, created_at
FROM users
WHERE LOWER(email) = 'longpapa82@gmail.com';

-- Row lifecycle (if audit_log exists)
SELECT created_at, action, metadata
FROM audit_logs
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = 'longpapa82@gmail.com')
ORDER BY created_at DESC
LIMIT 50;

-- RevenueCat app_user_id mapping
SELECT revenuecat_app_user_id FROM users
WHERE LOWER(email) = 'longpapa82@gmail.com';
```

### 7.4 Issue 3 — env check

```bash
# On the server, inside backend container
docker compose exec backend sh -c 'echo "$ADMIN_EMAILS"'

# Check if longpapa82 is in the list
docker compose exec backend sh -c 'echo "$ADMIN_EMAILS" | tr "," "\n" | grep -i longpapa82'
```

Expected outcomes:
- If env contains `longpapa82@gmail.com`: frontend will show `isAdmin: true` regardless of DB tier. This is the likely explanation.
- If env does NOT contain it: check DB `role` and `subscription_expires_at` for the actual state.

### 7.5 Issue 3 — Redis cache probe

```bash
# Connect to Redis
docker compose exec redis redis-cli

# In redis-cli:
GET premium:<USER_UUID>
TTL premium:<USER_UUID>
```

If `GET` returns `'true'` and TTL is positive, the 5-minute cache may be holding a stale premium flag.

### 7.6 Issue 3 — RevenueCat webhook delivery check

```sql
-- If you log webhook receipts (check audit.service.ts / logs)
-- Otherwise inspect RevenueCat dashboard for delivery history to the user
SELECT COUNT(*), MIN(created_at), MAX(created_at)
FROM audit_logs
WHERE metadata::text LIKE '%revenuecat%'
  AND metadata::text LIKE '%longpapa82%';
```

Also check RevenueCat dashboard (https://app.revenuecat.com) → Customer Details → longpapa82 → Events tab.

### 7.7 Issue 1-C — Is the quota-after-failure pattern visible in prod?

```sql
-- Trips with aiStatus='failed' in last 7 days
SELECT user_id, COUNT(*) AS failed_trips
FROM trips
WHERE ai_status = 'failed'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY 2 DESC
LIMIT 20;

-- Users whose ai_trips_used_this_month grew but had any failed trips
WITH failed AS (
  SELECT user_id, COUNT(*) AS fails
  FROM trips
  WHERE ai_status = 'failed'
    AND created_at >= date_trunc('month', NOW())
  GROUP BY user_id
)
SELECT u.email, u.ai_trips_used_this_month, f.fails
FROM users u
JOIN failed f ON f.user_id = u.id
WHERE f.fails > 0
ORDER BY f.fails DESC;
```

---

## 8. What to verify next (owner → user / human)

1. **1-A hypothesis B**: Read `frontend/src/components/core/DatePicker.tsx` to see whether it internally normalizes to local-date strings. If it does, the inconsistency is solely in `setDurationDays`. If not, user-entered dates also drift.
2. **1-B real trigger**: Read `DatePickerField` onChange callback shape. What does it emit for invalid input?
3. **1-C P0 impact size**: Run §7.7 queries to quantify how many users burned quota on `aiStatus='failed'` trips.
4. **2**: Run §7.2 breakdown to identify the 4/25 source category.
5. **3**: Run §7.3–7.6 to disambiguate which of the five candidate causes applies to longpapa82.

No code changes applied. Ready for remediation planning.
