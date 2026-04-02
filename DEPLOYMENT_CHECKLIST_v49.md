# 🚨 CRITICAL DEPLOYMENT - versionCode 49

## ⚠️ URGENT: Production Bug Fixes

**Date**: 2026-04-02
**Version**: versionCode 49
**Priority**: P0 - CRITICAL

## 🔴 Critical Issue Discovered

**versionCode 48 was deployed WITHOUT the bug fixes!** The fixes existed only as uncommitted changes in the working directory and were never included in any build.

## Bug Fixes in This Release

### Bug #2 (P0): PlacesAutocomplete Selection Not Working ✅
- **Symptom**: User selects location from dropdown, but selection doesn't appear in input field
- **Root Cause**: Double state update causing race condition
- **Fix**: Modified to call only onSelect, preventing duplicate updates
- **Files Changed**:
  - `frontend/src/components/PlacesAutocomplete.tsx`
  - `frontend/src/components/ActivityModal.tsx`

### Bug #3 (P0): AdMob Rewarded Ad Not Showing ✅
- **Symptom**: "광고 보고 상세 여행 인사이트 받기" button does nothing
- **Root Cause**: Ad loading failures with no retry mechanism
- **Fix**: Added exponential backoff retry (3 attempts) + manual reload
- **Files Changed**:
  - `frontend/src/components/ads/useRewardedAd.native.ts`
  - `frontend/src/screens/trips/CreateTripScreen.tsx`

### Bug #1 (P1): Toast Behind Modal ✅
- **Symptom**: Toast notifications appear blurry/behind modal dialogs
- **Root Cause**: z-index (9999) lower than modal (10000)
- **Fix**: Increased z-index to 10001 + added elevation for Android
- **Files Changed**:
  - `frontend/src/components/feedback/Toast/Toast.tsx`

### Bug #4: Map Pins Not Showing ✅
- **Symptom**: "표시할 위치 정보가 없습니다" on map
- **Root Cause**: Consequence of Bug #2 - no valid location data
- **Fix**: Automatically resolved with Bug #2 fix

## Deployment Steps

### 1. Build with EAS
```bash
cd frontend
eas build --platform android --profile production
```

### 2. Verify Build
- Check build logs for inclusion of changed files
- Verify versionCode is 49
- Download APK and test locally if possible

### 3. Deploy to Google Play
```bash
# After build completes
eas submit --platform android --latest
```

### 4. Release Strategy
- Start with 1% rollout
- Monitor for 2 hours
- If stable, increase to 10%
- After 6 hours, increase to 50%
- After 24 hours, increase to 100%

## Testing Checklist

Before deploying, test these scenarios:

- [ ] **PlacesAutocomplete**: Type "Hotel" → Select suggestion → Verify text appears in field
- [ ] **AdMob**: Click reward button → Verify ad shows OR retry message appears
- [ ] **Toast**: Open activity modal → Trigger validation error → Verify toast appears on top
- [ ] **Map**: Create activity with location → Verify pin appears on map

## Rollback Plan

If critical issues are discovered:
1. Halt rollout immediately in Play Console
2. Revert to versionCode 43 (last stable)
3. Investigate and fix issues
4. Deploy as versionCode 50

## Contact for Issues

- Technical Lead: Review deployment logs
- QA Team: Test all 4 bug fixes
- Support Team: Monitor user reports

## Post-Deployment

1. Monitor crash reports in Play Console
2. Check user reviews for bug reports
3. Verify AdMob revenue metrics
4. Document lessons learned

---

**IMPORTANT**: This is a CRITICAL hotfix. The bugs have been affecting production users for multiple versions. Deploy immediately after testing.