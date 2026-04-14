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
