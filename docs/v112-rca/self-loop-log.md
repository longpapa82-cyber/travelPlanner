# V112 Self-Loop Log

Iteration-by-iteration record of Phase 3 (fix execution) → Phase 4 (QA) →
Phase 5 (self-loop) → Phase 6 (deploy). Each entry captures what changed,
what was verified, and what blocks the next wave.

---

## Iteration 0 — Wave 1 Backend Core

**Date**: 2026-04-14
**Scope**: subscription constants + sentinel removal + changePassword token invalidation + error log filter
**Session**: Phase 3 start (fresh from RCA commit `86d54531`)

### Changes

| File | Change |
|---|---|
| `backend/src/subscription/constants.ts` (new) | `AI_TRIPS_FREE_LIMIT=3`, `AI_TRIPS_PREMIUM_LIMIT=30` shared constants |
| `backend/src/subscription/dto/subscription-status.dto.ts` (new) | Explicit `SubscriptionStatusDto` with `isAdmin` and `isSandbox` flags |
| `backend/src/subscription/subscription.service.ts` | Removed `-1` sentinel, `getSubscriptionStatus` returns real `aiTripsLimit` (3 or 30), `checkAiTripLimit` uses `Number.MAX_SAFE_INTEGER` for admin, added sandbox detection (`planType==='yearly' && expiresAt-startedAt<7d`) |
| `backend/src/users/users.service.ts:221` | `changePassword` writes `pwd_changed:${userId}` Redis key with current epoch seconds (TTL 31 days) |
| `backend/src/auth/auth.service.ts` (`refreshToken`) | Rejects refresh tokens whose `payload.iat` predates the stored password-change timestamp |
| `backend/src/common/filters/all-exceptions.filter.ts` | `EXPECTED_ERROR_NAMES` Set filters PaywallError/QuotaExceededError/AbortError/CancelledError/CancelledException/RequestCancelledException from ErrorLog ingestion; `/subscription` route only logs 5xx |

### Verification

- `npx tsc --noEmit` → 0 errors
- No runtime verification yet (no new Jest cases added in this iteration — Wave 4 work)

### Issues addressed (partial or foundational)

- **#8** (20/30 4-version recurrence): foundational — backend now returns real 30 limit for premium, so frontend hardcoded fallbacks (`limit > 0 ? limit : 3`) become removable in Wave 6
- **#7** (yearly date display): backend now flags `isSandbox` — frontend batch reveal in Wave 6
- **#1** (web bypass, supporting): password-change forces refresh token invalidation — reduces account-takeover blast radius even if a token leaks
- **#10** (error logs): expected-flow errors (paywall/abort/cancel) no longer pollute `error_logs` table

### Deferred to next iteration

- **Wave 2** (auth state machine): register re-entry, JWT scope restriction, login PENDING_VERIFICATION response, discriminated error codes, cleanup cron. *Started and rolled back* to keep Wave 1 commit clean — `refreshUnverifiedRegistration` method needs to be added to `users.service.ts` first in the next session.
- **Wave 3** (trip cancel infra): jobs.service.cancelJob, ai.service signal/timeout/chunking, trips.service quota rollback, trips.controller DELETE endpoint. Not started.
- **Wave 4-9**: not started.

### Next session resume command

> "docs/v112-rca/self-loop-log.md Iteration 0 이후 Wave 2부터 재개. users.service.ts 에 refreshUnverifiedRegistration 먼저 추가하고 auth.service.ts register 재진입 흐름 복원."

### Context budget notes

- Wave 2-9 cannot fit in a single session alongside Phase 4-6
- Recommend: Wave 2+3+4 in next session (backend finalization + tests), then a third session for Wave 5-9 (frontend + deploy + self-loop)

---

## Iteration 1 — Wave 2a Register Re-entry (partial)

**Date**: 2026-04-14
**Scope**: `refreshUnverifiedRegistration` helper + `register()` re-entry branch only.
Login PENDING_VERIFICATION refactor, JWT scope restriction, discriminated error
codes, and cleanup cron remain deferred to Iteration 2.

### Changes

| File | Change |
|---|---|
| `backend/src/users/users.service.ts` | Added `refreshUnverifiedRegistration(existing, {password, name})`. Re-hashes password (bcrypt 12), replaces name, clears `emailVerificationToken`/`Expiry`/`Attempts`/`lastVerificationSentAt`. Guards against non-EMAIL provider and already-verified rows. |
| `backend/src/auth/auth.service.ts` (`register`) | Branches on `existingUser`: verified or non-EMAIL → `BadRequestException` (generic, no enumeration). Unverified EMAIL → call `refreshUnverifiedRegistration` then continue with existing token-generation flow. |

### Verification

- `npx tsc --noEmit` → 0 errors

### Deferred to Iteration 2 (still Wave 2)

- `register` JWT scope restriction (`{pendingVerification: true, email}` instead of full tokens)
- `login` PENDING_VERIFICATION 401 + resumeToken
- Discriminated error codes (`EMAIL_EXISTS`, `EMAIL_NOT_VERIFIED`, …)
- Cleanup `@Cron('0 * * * *')` for unverified rows older than 24h
- `auth.service.spec.ts` re-entry test cases

---

## Iteration 2 — Wave 2 finalization

**Date**: 2026-04-14
**Scope**: Close out Wave 2 — JWT scope hardening + PENDING_VERIFICATION login
response + discriminated error codes + hourly cleanup cron + auth spec coverage.

### Changes

| File | Change |
|---|---|
| `backend/src/auth/constants/auth-error-codes.ts` (new) | `AUTH_ERROR_CODES` const object (EMAIL_EXISTS, EMAIL_NOT_VERIFIED, INVALID_CREDENTIALS, ACCOUNT_LOCKED, …) and `JWT_SCOPE_PENDING_VERIFICATION` literal |
| `backend/src/auth/auth.service.ts` | `register()` now issues a scope-restricted resumeToken (15m) instead of full access/refresh pair. New `PendingVerificationResponse` shape. `login()` throws `HttpException` 401 with `{code: EMAIL_NOT_VERIFIED, resumeToken, user}` body for unverified EMAIL users. All error paths in `register`/`login` now carry `AUTH_ERROR_CODES` discriminators. Added private `generateResumeToken()` helper that signs `{sub, email, scope: pending_verification}` with 15m expiry. |
| `backend/src/auth/strategies/jwt.strategy.ts` | `validate()` propagates `payload.scope` so downstream guards can differentiate resume tokens from full tokens |
| `backend/src/auth/guards/jwt-auth.guard.ts` | Overrides `handleRequest` to reject `scope=pending_verification` tokens — prevents a resumeToken from unlocking any normal endpoint |
| `backend/src/auth/guards/pending-verification.guard.ts` (new) | Inverse of JwtAuthGuard: only accepts `scope=pending_verification`. Applied to `send-verification-code` / `verify-email-code` |
| `backend/src/auth/auth.controller.ts` | `send-verification-code` and `verify-email-code` now use `PendingVerificationGuard` instead of `JwtAuthGuard` |
| `backend/src/users/users.service.ts` | New `@Cron(EVERY_HOUR) cleanupUnverifiedRegistrations()` deletes abandoned EMAIL-provider rows where `isEmailVerified=false` and `createdAt < now-24h`. Uses queryBuilder for single DELETE. Wrapped in try/catch with logger.warn — never throws up to scheduler |
| `backend/src/auth/auth.service.spec.ts` | Register suite rewritten: resume-token shape, scope=pending_verification assertion on signAsync, EMAIL_EXISTS for verified + non-EMAIL provider, re-entry path via `refreshUnverifiedRegistration`. Login suite: verified path returns tokens, unverified path throws 401 with `response.code=EMAIL_NOT_VERIFIED` + resumeToken assertion. Token generation tests migrated from register → login (verified) since register no longer mints access/refresh tokens |
| `backend/src/auth/auth.controller.spec.ts` | `mockPendingVerificationResponse` added. Register mocks updated. Response structure assertions check `resumeToken` + `requiresEmailVerification`, explicitly assert absence of `accessToken`/`refreshToken`. `mockUser` gained `isEmailVerified: false` to match the new response contract |

### Verification

- `npx tsc --noEmit` → 0 errors
- `npx jest auth/auth.service.spec.ts auth/auth.controller.spec.ts` → **60/60 passing**
- `npx jest users/users.service.spec.ts` → 20/20 passing (cron added without regression)
- Full `npx jest` → **412 passing**, 3 pre-existing failures (`all-exceptions.filter.spec.ts` expected after Wave 1's EXPECTED_ERROR_NAMES filter; `email.service.spec.ts` V111-era drift — both deferred to Wave 4)

### Security properties now enforced

1. **Scope isolation**: a resumeToken can only call `send-verification-code` and `verify-email-code`. `JwtAuthGuard` rejects it on every other endpoint — there is no way to use it for `/trips`, `/subscription`, etc. even if a client misroutes it.
2. **No enumeration**: `EMAIL_EXISTS` is returned for both "already verified" and "non-EMAIL provider" cases with identical messages. Only the discriminator code differs; the message is i18n'd generic.
3. **Bounded exposure**: resumeToken expires in 15 minutes. If it leaks, the blast radius is limited to "send me a verification email" and "confirm the 6-digit code I already received".
4. **Self-healing state**: `cleanupUnverifiedRegistrations` runs hourly. An abandoned signup is deleted after 24h, so a third party who tries to sign up with the same email isn't permanently blocked by someone else's orphan.

### Deferred to next iteration

- **Wave 3** (trip cancel infra): `jobs.service.cancelJob`, `ai.service` signal/timeout/chunking, `trips.service` quota rollback, `trips.controller` DELETE endpoint. Not started.
- **Wave 4** (test harness): fix pre-existing `all-exceptions.filter.spec.ts` drift introduced by Wave 1's `EXPECTED_ERROR_NAMES` filter, fix `email.service.spec.ts` V111-era drift.
- **Frontend** (Wave 5+): update register/login/verification screens to consume the new resumeToken + error-code contract. Login screen needs an `EMAIL_NOT_VERIFIED` branch that reads `response.resumeToken` instead of relying on `requiresEmailVerification` on a 200 response.

### Breaking contract change (frontend impact)

| Endpoint | Before | After |
|---|---|---|
| `POST /auth/register` | 201 `{user, accessToken, refreshToken}` | 201 `{user, resumeToken, requiresEmailVerification: true}` |
| `POST /auth/login` (unverified) | 200 `{user, accessToken, refreshToken, requiresEmailVerification: true}` | **401** `{code: 'EMAIL_NOT_VERIFIED', message, resumeToken, user}` |
| `POST /auth/send-verification-code` | Bearer access token | Bearer **resumeToken** (scope=pending_verification) |
| `POST /auth/verify-email-code` | Bearer access token | Bearer **resumeToken** |

The frontend change is load-bearing: without it, users who register on the new backend will be unable to complete verification on the old app build. This must ship as part of the same V112 Alpha release — mixed versions are broken by design.

### Next session resume command

> "self-loop-log Iteration 2 이후 Wave 3 (trip cancel infra)부터 재개. jobs.service.cancelJob + ai.service signal/timeout/chunking + trips.service 쿼터 롤백 + trips.controller DELETE 엔드포인트."

---

## Iteration 3 — Wave 3 Trip Cancel Infrastructure

**Date**: 2026-04-14
**Scope**: End-to-end user-initiated cancellation for in-flight AI trip creation jobs — signal propagation from `DELETE /trips/jobs/:jobId` down through `TripsService.create` and `AIService.streamCompletion`, with quota + partial-trip rollback via the existing open transaction.

### Changes

| File | Change |
|---|---|
| `backend/src/trips/jobs.service.ts` | `JobData` gained `userId` + `abortController` fields. New `'cancelled'` status. `createJob(userId)` now requires owner. New `attachAbortController(jobId, controller)` (called by `startTripCreation` after it spins up the controller). New `cancelJob(jobId, userId)`: rejects cross-user calls with `ForbiddenException`, 404 for unknown ids, idempotent on terminal states, calls `abortController.abort()` then flips status to `'cancelled'` with `progress = { step: 'cancelled' }` |
| `backend/src/trips/trips.service.ts` | New exported `TripCancelledError` class (distinct so the AI catch block can tell "user cancelled" from "AI fallback"). `create()` accepts optional `signal: AbortSignal`. Internal `throwIfCancelled()` helper inserted at every async boundary (validating, weather fetch, AI start, AI await, pre-commit). Passes `signal` into `aiService.generateAllItineraries`. The AI catch block now re-raises `TripCancelledError` instead of falling back to empty itineraries — cancellation must roll back the transaction, not silently commit a shell trip. Added `'cancelled'` to `TripCreationStep` union |
| `backend/src/trips/services/ai.service.ts` | `generateDailyItinerary`, `generateFullTripItinerary`, `generateParallelItineraries`, and `generateAllItineraries` all thread an optional `signal`. `streamCompletion` composes the external cancel signal with a hard **90-second** `AbortSignal.timeout` via `AbortSignal.any` (Node 20+) and passes the combined signal to `openai.chat.completions.create({...}, { signal })`. `generateFullTripItinerary` no longer falls back to parallel on cancel — re-raises the error. |
| `backend/src/trips/trips.controller.ts` | New `DELETE /trips/jobs/:jobId` endpoint returning `204 No Content`, guarded by the existing `JwtAuthGuard` via `CurrentUser`. `createAsync` now passes `userId` into `jobsService.createJob` for owner tracking. `startTripCreation` creates an `AbortController` per job, registers it via `attachAbortController`, and threads the signal into `tripsService.create`. Progress subscription no longer overwrites a terminal `'cancelled'` status with late ticks. The outer catch checks `job.status === 'cancelled'` and declines to overwrite it with `'error'` — idempotent from the client's perspective |
| `backend/src/trips/jobs.service.spec.ts` (new) | 10 unit tests covering createJob (id format, uniqueness, owner), attachAbortController, cancelJob happy path, cross-user rejection, unknown jobId 404, idempotent double-cancel, terminal-state no-op (completed/error), and cancel-without-attached-controller. Uses `jest.useFakeTimers` to keep the 1h cleanup setTimeout from leaking test handles |
| `backend/src/trips/trips.controller.spec.ts` | Lifted `mockJobsService` to module scope with `attachAbortController` + `cancelJob`. Added 3 new integration tests against `DELETE /trips/jobs/:jobId`: 204 happy path, 404 on unknown id, 403 on cross-user. Updated the Guard Integration block's inline `JobsService` mock to match the new surface |
| `backend/src/trips/trips.service.spec.ts` | `should calculate numberOfDays correctly` updated to expect the new second argument (`undefined` AbortSignal) in `aiService.generateAllItineraries` call |

### Verification

- `npx tsc --noEmit` → 0 errors
- `npx jest trips/jobs.service.spec` → **10/10 passing**
- `npx jest trips/trips.controller.spec` → **43/43 passing** (was 40; +3 DELETE tests)
- `npx jest trips/trips.service.spec` → **40/40 passing** (regression fix applied)
- Full `npx jest` → **425 passing**, 3 pre-existing failures (`all-exceptions.filter.spec.ts`, `email.service.spec.ts` — both flagged in Iterations 0+2 as Wave 4 scope; neither touched by this iteration)

### Cancellation semantics now enforced

1. **Signal propagation**: a single `AbortController.abort()` call in `JobsService.cancelJob` reaches the OpenAI stream (via `openai.chat.completions.create({ signal })`), causing the stream loop to throw, which propagates back to `TripsService.create`, which routes to the outer catch, which calls `queryRunner.rollbackTransaction()`. This rolls back both the `aiTripsUsedThisMonth += 1` update AND the saved Trip row in a single atomic operation.
2. **No quota leaks**: because the transaction spans quota increment → trip insert → AI generation → itinerary save → commit, any abort before commit reverses the quota change. A user who hits cancel does not burn one of their 3 / 30 monthly AI generations.
3. **Hard ceiling**: even without a user cancel, the 90s `AbortSignal.timeout` inside `streamCompletion` means no single OpenAI request can hold a DB connection open indefinitely. Runaway generation fails fast with the same rollback path.
4. **Authorization**: `cancelJob` refuses cross-user attempts with `ForbiddenException`. A leaked jobId is not a cancellation oracle.
5. **Idempotency**: double-cancel is a no-op on terminal states. `startTripCreation`'s outer catch declines to overwrite `'cancelled'` with `'error'`, so the client sees a stable final status.
6. **No silent fallback**: the critical fix here is that the AI catch block used to mask any error (including `AbortError`) with a fallback to empty itineraries. That would have committed an empty trip against the user's quota, the opposite of what a cancel should do. The new branch checks `error instanceof TripCancelledError || signal?.aborted` and re-raises.

### Frontend contract (additional to Iteration 2)

| Endpoint | Behavior |
|---|---|
| `POST /trips/create-async` | Unchanged response shape (`{ jobId, status: 'pending' }`). Now tracks owner internally. |
| `GET /trips/job-status/:jobId` | `JobData.status` may now be `'cancelled'`; `progress.step` may be `'cancelled'`. Frontend polling loop should treat this as terminal (stop polling, show cancel confirmation). |
| `DELETE /trips/jobs/:jobId` | **New endpoint.** 204 on success, 404 if unknown, 403 if not owner. Frontend cancel button should call this and then stop polling. Race note: if `DELETE` arrives after the job already completed, the server returns 204 (idempotent) but the job state stays `'completed'` — the client should inspect the final status rather than assuming cancel won. |

### Deferred to next iteration

- **Wave 4** (spec drift cleanup): fix `all-exceptions.filter.spec.ts` to match the V112 `EXPECTED_ERROR_NAMES` filter added in Wave 1, and resolve the V111-era `email.service.spec.ts` drift. Neither blocks Wave 5+ functionality; they're both test-side mismatches with production code.
- **Wave 5+** (frontend): consume the new resumeToken contract from Wave 2 and the DELETE /trips/jobs/:jobId endpoint from Wave 3. These two ship together in V112 Alpha.
- **Observability** (post-Wave 5, optional): add a `trip_cancel` metric to the API usage dashboard so we can track how often users abort AI generations mid-flight (signal of latency problems or poor UX).

### Next session resume command

> "self-loop-log Iteration 3 이후 Wave 4 (spec drift) 정리 후 Wave 5 frontend 계약 업데이트 착수. all-exceptions.filter.spec + email.service.spec 수정부터."

---

## Iteration 4 — Wave 4 Spec Drift Cleanup

**Date**: 2026-04-14
**Scope**: Realign two legacy test files with V112 Wave 1 production policy so the full Jest run is green before Wave 5 (frontend) changes land.

### Changes

| File | Change |
|---|---|
| `backend/src/common/filters/all-exceptions.filter.spec.ts` | Replaced the old `should log subscription/payment errors` test (which expected every `/subscription` 402 to be recorded as `severity: 'warning'`). Wave 1 narrowed `/subscription` logging to 5xx only — paywall/quota 4xx are business-rule outcomes, not server faults, and were flooding `error_logs`. New tests: (a) asserts `repository.save` is NOT called for a 402 on `/subscription/checkout` — nails the exclusion so a future revert is caught immediately; (b) asserts a 500 on the same path IS logged with `severity: 'error'` — nails the positive side of the branch. Net: 1 test → 2 tests, both fenceposts of the policy covered. |
| `backend/src/email/email.service.spec.ts` | Two tests (`sendVerificationEmail` and `sendPasswordResetEmail`: "should not throw in dev mode when mailer fails") were written against a pre-V112 EmailService that silently swallowed SMTP failures in non-production environments. V112 production code re-throws in every environment (see `email.service.ts` lines 142, 213, 283 — "Always throw — email delivery failure must be reported to the caller"). The old "dev mode swallow" behavior was itself a bug: a dev stack with broken SMTP looked identical to a healthy one, and the feedback loop for diagnosing "verification email never arrived" was broken. The tests now use `rejects.toThrow(...)` with comments pointing at the V112 Wave 1 policy line. The existing "should throw in production mode" tests were untouched. |

### Verification

- `npx tsc --noEmit` → 0 errors
- `npx jest common/filters/all-exceptions.filter.spec` → **10/10 passing**
- `npx jest email/email.service.spec` → **16/16 passing**
- Full `npx jest` → **429 / 429 passing, 0 failing, 23 / 23 suites green**

### Why these failures existed in the first place

Both were **Wave 1 acceptable debt**: the RCA/fix iteration prioritized production correctness (stop logging paywall noise; stop silently swallowing email failures) and left the corresponding test updates for a later cleanup pass. Logging them as "pre-existing failures" through Iterations 1–3 was deliberate — it kept Wave 2 and 3 commits focused on their own scope while preventing a rebase conflict risk on shared spec files. Wave 4 is the agreed cleanup slot.

### State of the baseline

| Metric | Before Iteration 1 | After Iteration 4 |
|---|---|---|
| Test suites passing | 20 / 22 | **23 / 23** |
| Tests passing | 412 / 415 | **429 / 429** |
| Backend TS errors | 0 | 0 |
| Open pre-existing failures | 3 | **0** |

The baseline is now clean. Any new failure during Wave 5 is a real regression, not a test drift artifact.

### Deferred to next iteration

- **Wave 5** (frontend contract realignment): register/login 401 EMAIL_NOT_VERIFIED branch, resumeToken wiring through send-verification-code / verify-email-code, cancel button on AI generation screen using `DELETE /trips/jobs/:jobId`, polling loop terminal handling for `'cancelled'` status. These are the load-bearing frontend changes that **must** ship with V112 Alpha or the app will be broken against the new backend.
- **Observability** (post-Wave 5, optional): `trip_cancel` metric on the API usage dashboard.

### Next session resume command

> "self-loop-log Iteration 4 이후 Wave 5 frontend 계약 업데이트 착수. RegisterScreen/LoginScreen/EmailVerificationCodeScreen + CreateTripScreen 취소 버튼 + apiClient 401 핸들러."

---

## Iteration 5 — Wave 5 Frontend Contract Realignment

**Date**: 2026-04-14
**Scope**: Wire the V112 Wave 2 (pendingVerification) + Wave 3 (trip cancel) backend contracts into the React Native app so a user can actually exercise them end-to-end.

### Backend touch-up (required to keep the resume-token path coherent)

| File | Change |
|---|---|
| `backend/src/auth/auth.service.ts` | `verifyEmailCode(userId, code, lang)` now returns a full `{accessToken, refreshToken, user}` payload alongside `{message, isEmailVerified}`. Previously it returned only a success message, which forced the client to log in a second time to upgrade from a pending_verification resume token to a full session. User-hostile for zero security benefit — the user just proved they control the email. The endpoint is still `PendingVerificationGuard`-protected so only holders of a valid resume token can redeem it. |

### Frontend changes

| File | Change |
|---|---|
| `frontend/src/services/api.ts` | `sendVerificationCode(resumeToken?)` and `verifyEmailCode(code, resumeToken?)` now accept an optional resume token and pass it as `Authorization: Bearer ${resumeToken}` when present. The request interceptor already skips its default Bearer injection when `config.headers.Authorization` is set, so the override lands cleanly. `verifyEmailCode` return type extended with optional `accessToken`/`refreshToken`/`user`. New `cancelTripJob(jobId)` method that calls `DELETE /trips/jobs/:jobId` and swallows 404/403 (idempotent from the UI's perspective). `createTripWithPolling` now wires `signal.addEventListener('abort', sendCancelToServer)` so a local `AbortController.abort()` also stops the **server-side** job — without this, cancel would only hide the loading spinner and the backend would still burn the AI quota and commit an empty trip. Polling loop now treats `status === 'cancelled'` as a terminal state that rejects with `error.cancelled = true`. |
| `frontend/src/contexts/AuthContext.tsx` | New exported `EmailNotVerifiedError` class (carries `resumeToken` + pending user payload). New `PendingVerification` type and `pendingVerification` state on the context. New `completeEmailVerification({accessToken, refreshToken, user})` action that promotes the resume-token session to a full session and nulls out `pendingVerification`. New `clearPendingVerification()` action for cancel/logout flows. `register()` rewritten: on receiving `{resumeToken, requiresEmailVerification}` it sets `pendingVerification` and throws `EmailNotVerifiedError`. A legacy branch still handles the old `{accessToken, refreshToken}` shape for staged rollouts. Profile fetch moved inside the legacy branch — a resume token would 401 against `/auth/me`. `login()` catch block parses 401 with `body.code === 'EMAIL_NOT_VERIFIED'` and emits the same `pendingVerification` state + typed error. `logout` now also clears `pendingVerification`. |
| `frontend/src/navigation/RootNavigator.tsx` | New branch at the top of the render tree: if `pendingVerification` is set, show `EmailVerificationCodeScreen` with `resumeToken` + email, before checking `isAuthenticated`. The legacy "full session but `isEmailVerified === false`" branch is kept below for backwards compatibility during staged rollout. `onLogout` in the new branch clears `pendingVerification` before calling `logout`. |
| `frontend/src/screens/auth/EmailVerificationCodeScreen.tsx` | Props gained `resumeToken?: string`. `userEmail` widened to `string \| null`. `sendVerificationCode(resumeToken)` and `verifyEmailCode(code, resumeToken)` both forward the token. On successful verify, when `resumeToken` is present and the response includes `accessToken` + `refreshToken` + `user`, calls `completeEmailVerification` to atomically promote the session and null `pendingVerification`. `onVerified()` still fires for the legacy path. |
| `frontend/src/screens/auth/RegisterScreen.tsx` | `handleSubmit` catch block treats `EmailNotVerifiedError` as the happy path — AuthContext has already set `pendingVerification` and RootNavigator will swap to the verification screen on the next render. No toast, no navigation call; the transition is the feedback. |
| `frontend/src/screens/auth/LoginScreen.tsx` | Same change: `EmailNotVerifiedError` swallowed as happy path. `TwoFactorRequiredError` branch untouched. |
| `frontend/src/screens/trips/CreateTripScreen.tsx` | Catch block for the polling path widened from `error.name === 'AbortError'` to also match `error.cancelled === true` and `error.message === 'Trip creation cancelled'`. Covers all three shapes of cancel that can reach the screen (axios-level abort, polling-loop terminal state, AbortController reject fallback). The existing cancel UI (`handleCancelCreation` + `abortControllerRef.current?.abort()`) automatically propagates to the server via the new api.ts abort listener — no UI changes needed. |

### Verification

- **Backend**: `npx tsc --noEmit` → 0 errors. `npx jest` → **429 / 429 passing, 23 / 23 suites green**. The verifyEmailCode return-type extension is additive so no existing test fixtures break.
- **Frontend**: `npx tsc --noEmit` → 0 errors. `npx jest` → **205 / 209 passing, 14 / 16 suites green**. Failing suites: `ActivityModal.timeInput.test.tsx` and `ActivityModal.inlineToast.test.tsx` — these are V111-era `"Can't access .root on unmounted test renderer"` drift that predates this iteration and are listed as "pre-existing test drift" in `CLAUDE.md`. Not touched by this iteration. `AuthContext.test.tsx` and `LoginScreen.test.tsx` are **passing**, confirming the auth contract changes do not break the existing test harness.

### Why the resume-token upgrade happens on verify, not on a separate endpoint

An earlier draft of Wave 5 was going to force the client to call `/auth/login` again after a successful verify to fetch full tokens. That design was rejected because:

1. **Double password entry**: the user would type the password on the register form, go to verification, enter the code, then be bounced back to login to type the password *again*. This is user-hostile.
2. **No added security**: entering the code already proves control of the email account. A second password prompt doesn't provide additional proof of anything — the user had just typed it seconds earlier.
3. **Race with cleanup cron**: the Wave 2 `cleanupUnverifiedRegistrations` cron deletes abandoned unverified rows after 24h. If a user in the middle of a slow verification took long enough, their row could theoretically be deleted between verify and re-login. Unlikely in practice (the 24h window is huge) but the failure mode is opaque.

Making `verifyEmailCode` return the tokens directly is the clean path: a single `PendingVerificationGuard`-protected round trip upgrades the session, and from the user's perspective the transition is "enter code → land in the app."

### Contract summary (frontend ↔ backend, final V112 state)

| Flow | Request | Response |
|---|---|---|
| `POST /auth/register` (new email) | `{email, password, name}` | `201 {user, resumeToken, requiresEmailVerification: true}` |
| `POST /auth/register` (unverified email re-entry) | same | same — backend uses `refreshUnverifiedRegistration` |
| `POST /auth/register` (verified or non-EMAIL provider) | same | `400 {code: 'EMAIL_EXISTS', message}` |
| `POST /auth/login` (verified) | `{email, password}` | `200 {user, accessToken, refreshToken, ...}` |
| `POST /auth/login` (unverified EMAIL) | same | `401 {code: 'EMAIL_NOT_VERIFIED', resumeToken, user, message}` |
| `POST /auth/send-verification-code` | `{}` + `Bearer ${resumeToken}` | `200 {message, expiresIn}` |
| `POST /auth/verify-email-code` | `{code}` + `Bearer ${resumeToken}` | `200 {message, isEmailVerified, accessToken, refreshToken, user}` |
| `POST /trips/create-async` | `{...}` | `200 {jobId, status}` |
| `GET /trips/job-status/:jobId` | — | `{status, progress, tripId?, error?}` — `status` may be `'cancelled'` |
| `DELETE /trips/jobs/:jobId` | — | `204` / `404` / `403` |

### Deferred to next iteration

- **Wave 6** (V111 pre-existing test drift cleanup): `ActivityModal.timeInput.test.tsx` + `ActivityModal.inlineToast.test.tsx`. These predate V112 work and are not on the critical path for Alpha release. They should be fixed before Beta.
- **Observability** (optional): `trip_cancel` metric on the admin API usage dashboard.
- **V112 Alpha release**: build + EAS submit. All the load-bearing contract changes are in place; no more backend/frontend drift risk.

### Next session resume command

> "self-loop-log Iteration 5 이후 V112 Alpha 빌드 진행. /pdca status 확인 후 EAS Build submit."

---
