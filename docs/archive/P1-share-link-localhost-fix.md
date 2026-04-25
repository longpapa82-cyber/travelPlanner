# P1 Bug Fix: Share Link Using localhost Instead of Production URL

## Bug Report
- **Date**: 2026-04-03
- **Severity**: P1 (Critical feature broken)
- **Version Affected**: versionCode 43-51
- **Reporter**: User feedback

## Symptoms
- User clicks "여행 공유" (Share Trip) button
- Generated share link uses `http://localhost:8081/share/[token]`
- Opening link in browser shows "ERR_CONNECTION_REFUSED"
- Share feature completely non-functional

## Root Cause Analysis

### Investigation Path
1. Located share link generation in `frontend/src/components/ShareModal.tsx`
2. Found `getBaseUrl()` function using `APP_URL` from constants
3. Checked `frontend/src/constants/config.ts`:
   ```typescript
   export const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
   ```
4. Verified `.env.production` has correct value:
   ```
   EXPO_PUBLIC_APP_URL=https://mytravel-planner.com
   ```
5. **ROOT CAUSE**: `eas.json` production build config was missing `EXPO_PUBLIC_APP_URL`

### Why It Failed
- EAS Build doesn't automatically use `.env` files
- Environment variables must be explicitly set in `eas.json` under the `env` section
- `EXPO_PUBLIC_API_URL` was set, but `EXPO_PUBLIC_APP_URL` was missing
- Code fell back to default value: `'http://localhost:8081'`

## Fix Applied

### File: `frontend/eas.json`
```diff
"staging": {
  "distribution": "internal",
  "env": {
    "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
+   "EXPO_PUBLIC_APP_URL": "https://mytravel-planner.com",
    "REVENUECAT_ANDROID_KEY": "goog_BeyiIKXfhmqtbtzaEGMRICChtQd"
  }
},
"production": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://mytravel-planner.com/api",
+   "EXPO_PUBLIC_APP_URL": "https://mytravel-planner.com",
    "REVENUECAT_ANDROID_KEY": "goog_BeyiIKXfhmqtbtzaEGMRICChtQd"
  },
  "autoIncrement": true
}
```

## Verification

### Test Scenario
```javascript
// With fix applied:
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
// APP_URL = 'https://mytravel-planner.com'

const shareToken = 'abc123';
const shareUrl = `${APP_URL}/share/${shareToken}`;
// shareUrl = 'https://mytravel-planner.com/share/abc123' ✅
```

### Expected Behavior After Fix
1. User clicks "여행 공유" button
2. Share link generated: `https://mytravel-planner.com/share/[token]`
3. Link opens in browser successfully
4. Shared trip page displays (public read-only view)

## Prevention Measures

### 1. Environment Variable Checklist
Create a checklist for all environment variables needed in production:
- [ ] `EXPO_PUBLIC_API_URL`
- [ ] `EXPO_PUBLIC_APP_URL`
- [ ] `REVENUECAT_ANDROID_KEY`
- [ ] AdMob IDs (all 8 production IDs)

### 2. Build Configuration Validation
Before each production build:
1. Review `eas.json` production env section
2. Compare with `.env.production` to ensure parity
3. Test share functionality specifically in staging build

### 3. E2E Test Addition
Add test to verify share URL format:
```typescript
test('share link should use production domain', async () => {
  // Generate share link
  const shareUrl = await generateShareLink(tripId);

  // Verify URL format
  expect(shareUrl).toMatch(/^https:\/\/mytravel-planner\.com\/share\//);
  expect(shareUrl).not.toContain('localhost');
});
```

### 4. Documentation Updates
- Add to build checklist: "Verify all EXPO_PUBLIC_* env vars in eas.json"
- Document that EAS doesn't use .env files automatically
- Create environment variable mapping table

## Related Files
- `frontend/src/components/ShareModal.tsx` - Share link UI
- `frontend/src/constants/config.ts` - Environment config
- `frontend/eas.json` - Build configuration
- `frontend/.env.production` - Production environment (reference only)

## Deployment
- **Next Build**: versionCode 52+ will include this fix
- **Build Command**: `eas build --platform android --profile production`
- **Testing**: Verify share links in Alpha track before production release

## Lessons Learned
1. **EAS Build Gotcha**: `.env` files are NOT automatically used by EAS Build
2. **Environment Variables**: Must be explicitly defined in `eas.json` env section
3. **Fallback Values**: Always consider what happens when env vars are missing
4. **Testing**: Share functionality should be part of smoke tests for each release

## References
- [EAS Build Environment Variables](https://docs.expo.dev/build/environment-variables/)
- [Share Feature Implementation](/frontend/src/components/ShareModal.tsx)
- [Deep Linking Configuration](/frontend/src/navigation/RootNavigator.tsx)