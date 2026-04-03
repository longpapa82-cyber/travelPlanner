# Bug #6: ThrottlerException and 4xx Errors Not Logged to Admin Dashboard

## Issue Summary

**Date Identified**: 2026-04-03
**Severity**: Medium
**Status**: Fixed

### Symptoms
- Rate limiting errors (HTTP 429) from ThrottlerGuard not appearing in admin error logs
- Authentication failures (401/403) not being tracked
- Validation errors on critical endpoints (signup, login) not being monitored
- Admin dashboard missing visibility into important operational errors

## Root Cause Analysis

### The Problem
The `AllExceptionsFilter` was only logging errors with HTTP status code >= 500 (server errors), completely ignoring 4xx client errors including:
- 429 Too Many Requests (ThrottlerException)
- 401 Unauthorized (authentication failures)
- 403 Forbidden (authorization failures)
- 400 Bad Request (validation errors)

### Code Analysis
```typescript
// Original code (line 83 in all-exceptions.filter.ts)
if (status >= 500 && this.dataSource?.isInitialized && ...) {
  // Only 5xx errors were being logged
}
```

This meant critical operational issues like:
- Brute force attempts (multiple 401s)
- Rate limiting being triggered (429s)
- Validation failures during signup
- Unauthorized admin access attempts

Were invisible to administrators in the error monitoring dashboard.

## Solution Implemented

### 1. Selective 4xx Error Logging

Added intelligent error filtering to log operationally important 4xx errors while avoiding noise:

```typescript
private shouldLogError(status: number, path: string, error: string): boolean {
  // Always log 5xx errors
  if (status >= 500) return true;

  // Log rate limiting (ThrottlerException)
  if (status === 429) return true;

  // Log auth-related failures
  const authPaths = ['/auth/register', '/auth/login', '/auth/verify-email', '/auth/reset-password'];
  if (authPaths.some(p => path.includes(p))) {
    if ([400, 401, 403].includes(status)) return true;
  }

  // Log admin access attempts
  if (path.includes('/admin') && [401, 403].includes(status)) return true;

  // Log subscription/payment errors
  if (path.includes('/subscription') && status >= 400) return true;

  return false;
}
```

### 2. Proper Severity Classification

```typescript
private getSeverity(status: number): 'error' | 'warning' | 'fatal' {
  if (status >= 500) return 'error';
  if (status === 429) return 'warning'; // Rate limiting
  return 'warning'; // Other 4xx errors
}
```

### 3. Enhanced Error Message Extraction

Improved error message extraction to handle various error formats:

```typescript
let errorMessage: string;
if (typeof message === 'string') {
  errorMessage = message;
} else if (Array.isArray(message)) {
  errorMessage = message.join('; ');
} else if (exception instanceof Error) {
  errorMessage = exception.message;
} else {
  errorMessage = 'Unknown error';
}
```

## Testing

### Unit Tests
Created comprehensive test suite in `all-exceptions.filter.spec.ts`:
- ✅ Logs ThrottlerException (429)
- ✅ Logs 401 errors on auth endpoints
- ✅ Logs 400 validation errors on auth endpoints
- ✅ Does NOT log 404 errors on non-sensitive endpoints
- ✅ Always logs 5xx errors
- ✅ Logs admin access attempts (403)
- ✅ Logs subscription/payment errors
- ✅ Respects rate limiting for error logs
- ✅ Formats error responses correctly

### Manual Testing Scripts

1. **test-throttler.sh** - Bash script to trigger rate limiting
2. **test-throttler-logging.js** - Node.js script for comprehensive testing

### Integration Testing
```bash
# Trigger rate limiting
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"Test123!"}'
done

# Check error logs
SELECT * FROM error_logs
WHERE error_message LIKE '%Too Many%'
ORDER BY created_at DESC;
```

## Impact & Benefits

### Improved Monitoring
- Administrators can now see rate limiting patterns
- Early detection of brute force attempts
- Visibility into validation issues affecting user signup
- Better understanding of authentication failures

### Security Benefits
- Track unauthorized admin access attempts
- Monitor suspicious activity patterns
- Identify potential security threats earlier

### Operational Benefits
- Better debugging of user-reported issues
- Insights into API usage patterns
- Data for capacity planning (rate limit adjustments)

## Deployment

### Backend Changes
- Modified: `backend/src/common/filters/all-exceptions.filter.ts`
- Added: `backend/src/common/filters/all-exceptions.filter.spec.ts`

### Database Impact
- No schema changes required
- ErrorLog table already supports all necessary fields
- Increased volume of error logs (estimated 10-20% increase)

### Performance Considerations
- Rate limiting: Max 100 error logs per minute
- Fire-and-forget pattern for database writes
- No impact on response times

## Verification

### Admin Dashboard
1. Navigate to `/admin/error-logs` or `/admin/error-logs/stats`
2. Filter by severity = "warning"
3. Look for entries with:
   - errorMessage containing "Too Many Requests"
   - screen containing "POST /api/auth/register"
   - severity = "warning"

### Database Query
```sql
-- Check recent 429 errors
SELECT id, error_message, screen, severity, created_at
FROM error_logs
WHERE error_message LIKE '%Too Many%'
   OR error_message LIKE '%rate%'
ORDER BY created_at DESC
LIMIT 10;

-- Check auth endpoint errors
SELECT COUNT(*), screen, error_message
FROM error_logs
WHERE screen LIKE '%/auth/%'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY screen, error_message
ORDER BY COUNT(*) DESC;
```

## Rollback Plan

If issues arise, revert the changes:
```bash
git revert [commit-hash]
npm run build
# Deploy reverted version
```

The original behavior (only logging 5xx) is non-breaking, so rollback is safe.

## Future Improvements

1. **Configurable Error Logging**
   - Environment variables for which endpoints to monitor
   - Dynamic severity thresholds

2. **Enhanced Analytics**
   - Pattern detection for security threats
   - Automatic alerting on threshold breaches

3. **Error Aggregation**
   - Group similar errors to reduce database load
   - Implement error fingerprinting

## Related Issues
- Bug #1-5: Previous error handling improvements
- Security audit findings (2026-03-29)

## References
- [NestJS Throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [HTTP Status Code 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)