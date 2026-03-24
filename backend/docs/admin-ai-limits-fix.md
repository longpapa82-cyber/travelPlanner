# Admin AI Generation Limits Fix

## Issue
Admin users were incorrectly limited to 3 AI trip generations per month, the same as free users.

## Root Causes
1. **Database Issue**: The admin user (longpapa82@gmail.com) had `role = 'user'` instead of `role = 'admin'`
2. **Code Issue**: The `trips.service.ts` file was not checking user role or subscription tier when enforcing AI generation limits

## Solution

### 1. Database Fix
Updated the user role to admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'longpapa82@gmail.com';
```

### 2. Code Changes in trips.service.ts

#### Added role selection (line 99)
```typescript
.select([
  'users.id',
  'users.aiTripsUsedThisMonth',
  'users.subscriptionTier',
  'users.role',  // Added this line
])
```

#### Added role and tier-based limit logic (lines 112-142)
```typescript
// Admin users have unlimited AI generations
if (user.users_role === 'admin') {
  // No limit check for admins
} else {
  // Determine limit based on subscription tier
  let aiTripLimit: number;

  if (user.users_subscriptionTier === 'premium') {
    aiTripLimit = parseInt(process.env.AI_TRIPS_PREMIUM_LIMIT || '30', 10);
  } else {
    aiTripLimit = parseInt(process.env.AI_TRIPS_FREE_LIMIT || '3', 10);
  }

  // Check limit
  if (currentCount >= aiTripLimit) {
    const tierMessage = user.users_subscriptionTier === 'premium'
      ? 'Premium monthly'
      : 'Monthly';
    throw new ForbiddenException(
      `${tierMessage} AI generation limit (${aiTripLimit}) reached.`
    );
  }
}
```

#### Skip incrementing counter for admins (lines 146-153)
```typescript
// Skip incrementing for admin users as they have unlimited access
if (user.users_role !== 'admin') {
  await queryRunner.manager
    .createQueryBuilder()
    .update('users')
    .set({ aiTripsUsedThisMonth: () => 'aiTripsUsedThisMonth + 1' })
    .where('id = :userId', { userId })
    .execute();
}
```

### 3. Environment Variables
Added new environment variable for premium users:
```
AI_TRIPS_FREE_LIMIT=3
AI_TRIPS_PREMIUM_LIMIT=30
```

## New Behavior
- **Admin users**: Unlimited AI trip generations (no limit check, no counter increment)
- **Premium users**: 30 AI trip generations per month (configurable via env)
- **Free users**: 3 AI trip generations per month (configurable via env)

## Testing
Created comprehensive test suite in `trips.service.ai-limits.spec.ts` covering:
- Admin users with unlimited access
- Premium users with 30 trip limit
- Free users with 3 trip limit
- Manual mode bypassing all limits

## Files Modified
- `/backend/src/trips/trips.service.ts` - Added role/tier checking logic
- `/backend/.env` - Added AI_TRIPS_PREMIUM_LIMIT variable
- `/backend/src/trips/trips.service.ai-limits.spec.ts` - New test file

## Database Changes
- Updated longpapa82@gmail.com user role from 'user' to 'admin'

## Deployment Notes
1. Ensure environment variables are set in production
2. Run database migration to update any other admin users if needed
3. Monitor logs for proper role detection

## Verification
To verify the fix works:
1. Admin users should be able to create unlimited AI trips
2. Check logs for "Admin user ... creating AI trip (unlimited access)"
3. Database aiTripsUsedThisMonth should not increment for admin users