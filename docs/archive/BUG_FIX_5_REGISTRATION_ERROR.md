# Bug Fix #5: Registration Error - Entity-Database Schema Mismatch

## Bug Report
- **Date**: 2026-04-05
- **Severity**: P0 (CRITICAL)
- **Affected Version**: versionCode 70-79
- **Impact**: 100% registration failure rate
- **Status**: ✅ FIXED

## Symptom
Users receive "An unexpected error occurred" error message when attempting to register new accounts through the signup screen.

## Root Cause Analysis

### Investigation Process
1. **Frontend Analysis**: RegisterScreen → AuthContext → API service flow confirmed working
2. **Backend Analysis**: auth.controller → auth.service → users.service create method
3. **Error Reproduction**: Direct API testing showed consistent 500 errors
4. **Log Analysis**: Docker logs revealed PostgreSQL column errors
5. **Schema Verification**: Database inspection confirmed missing columns

### Root Cause
**Entity-Database Schema Mismatch** after Stripe to Paddle payment provider migration:

1. Migration `1740400000000-RenameStripeToPaddle.ts` renamed `stripeCustomerId` to `paddleCustomerId`
2. User entity still defined both `stripeCustomerId` and `stripeSubscriptionId` columns
3. TypeORM generated INSERT queries with non-existent columns
4. PostgreSQL threw "column does not exist" errors
5. Global exception filter caught errors and returned generic message

### Technical Details
```typescript
// User entity had these columns that no longer existed in database:
@Column({ type: 'varchar', nullable: true, select: false })
stripeCustomerId?: string;  // ❌ Renamed to paddleCustomerId in DB

@Column({ type: 'varchar', nullable: true, select: false })
stripeSubscriptionId?: string;  // ❌ Removed from DB entirely
```

Database actual columns (verified via psql):
- ✅ `paddleCustomerId` (renamed from stripeCustomerId)
- ❌ `stripeCustomerId` (no longer exists)
- ❌ `stripeSubscriptionId` (no longer exists)

## Solution

### Code Changes

1. **backend/src/users/entities/user.entity.ts**
```diff
- @Column({ type: 'varchar', nullable: true, select: false })
- stripeCustomerId?: string;
-
- @Column({ type: 'varchar', nullable: true, select: false })
- stripeSubscriptionId?: string;
+ // Note: stripeCustomerId was migrated to paddleCustomerId in migration 1740400000000
+ // stripeSubscriptionId was also removed from the database
```

2. **backend/src/email/email.module.ts**
```diff
- import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
+ const { HandlebarsAdapter } = require('@nestjs-modules/mailer/dist/adapters/handlebars.adapter');
```

### Deployment Challenges

Docker build cache persisted old compiled JavaScript despite source changes:

1. **Initial attempts failed** due to cached layers:
   - `docker compose build backend` - Used cached layers
   - `docker compose build --no-cache backend` - Partial cache clear

2. **Final solution** - Complete cache purge:
```bash
docker compose down backend
docker system prune -f  # Remove all dangling images/containers
docker compose build --no-cache backend
docker compose up -d backend
```

## Verification

### Test Command
```bash
curl -X POST https://mytravel-planner.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -H 'Accept-Language: ko' \
  --data '{"email":"test@example.com","password":"Test123456","name":"Test User"}'
```

### Successful Response
```json
{
  "data": {
    "user": {
      "id": "546af132-3486-4a2a-8ab0-283c9f3e142f",
      "email": "test@example.com",
      "name": "Test User",
      "provider": "email",
      "isEmailVerified": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI9IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI9IkpXVCJ9..."
  }
}
```

## Prevention Measures

1. **Entity-Database Synchronization**:
   - Always update entities when creating database migrations
   - Run TypeORM synchronize check in development
   - Add migration validation tests

2. **Docker Build Process**:
   - Document cache clearing procedures
   - Consider using `--no-cache` for critical production deployments
   - Add build verification scripts

3. **Error Visibility**:
   - Improve error logging in development mode
   - Add Sentry or similar error tracking for production
   - Create health check endpoints for critical flows

## Impact Assessment

- **Users Affected**: All new users attempting registration
- **Duration**: Unknown (discovered during versionCode 79 testing)
- **Data Loss**: None - registration attempts failed cleanly
- **Recovery**: No user action needed - fix is automatic

## Lessons Learned

1. **Migration Completeness**: Database migrations must include corresponding entity updates
2. **Build Cache Management**: Docker cache can mask critical issues in production
3. **Error Messages**: Generic error messages hide root causes - need better observability
4. **Testing Gap**: Registration flow wasn't covered in automated tests

## Related Files

- Migration: `backend/src/migrations/1740400000000-RenameStripeToPaddle.ts`
- Entity: `backend/src/users/entities/user.entity.ts`
- Service: `backend/src/users/users.service.ts`
- Error Handler: `backend/src/common/filters/all-exceptions.filter.ts`

## Commit

- Hash: `ad41b0f5`
- Message: "fix(auth): Remove legacy Stripe columns causing registration failure"
- Date: 2026-04-05