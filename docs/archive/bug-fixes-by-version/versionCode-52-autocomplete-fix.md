# versionCode 52: PlacesAutocomplete Selection Bug Fix

## 🔴 P1 Bug: Location autocomplete selection not working

### Bug Report
- **User Report**: "When I type 'Doky' and select 'Tokyo' from dropdown, the field still shows 'Doky'"
- **Impact**: Core feature broken - all manual activities showing "위치 미확인" (location unknown)
- **Severity**: P1 (Critical UX issue affecting core functionality)
- **Regression**: This was supposedly fixed in versionCode 43 but the fix was incomplete

### Root Cause Analysis

The bug was in the `PlacesAutocomplete` component's `handleChangeText` function:

```typescript
// BEFORE (Bug):
const handleChangeText = (text: string) => {
  onChangeText(text);  // ← Called FIRST, before checking flags
  if (skipNextSearch.current) {
    skipNextSearch.current = false;
    return;
  }
  // ...
}
```

**Problem**: When a user selected a location from the dropdown:
1. `handleSelect` would be called, setting `skipNextSearch = true`
2. Parent component would update state with the selected location
3. Component would re-render with new value
4. **BUT** a spurious `onChangeText` event would fire with the OLD value
5. Since `onChangeText` was called BEFORE checking the flag, it would reset the field

### Solution Implemented

```typescript
// AFTER (Fixed):
const handleChangeText = (text: string) => {
  // Check flags BEFORE calling onChangeText
  if (skipNextSearch.current || justSelected.current) {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
    }
    return;
  }
  onChangeText(text);  // ← Now called AFTER checks
  // ...
}
```

**Additional safeguards**:
1. Added `justSelected` ref to prevent any changes during selection
2. Set both flags BEFORE any state updates to prevent race conditions
3. Clear flags after a short delay to allow normal operation to resume

### Files Modified
- `/frontend/src/components/PlacesAutocomplete.tsx` - Core fix
- `/frontend/src/components/__tests__/PlacesAutocomplete.test.tsx` - Test coverage
- `/frontend/src/components/__tests__/PlacesAutocomplete.manual-test.md` - Test scenarios
- `/frontend/app.json` - Version bump to 52

### Testing Performed

#### Manual Testing Scenarios
1. ✅ Basic selection: Type "tok" → Select "Tokyo" → Field shows "Tokyo, Japan"
2. ✅ Multiple selections: Select different locations sequentially
3. ✅ Fast typing: Type quickly and immediately select
4. ✅ Focus/blur: Verify value persists through focus changes
5. ✅ API unavailable: Manual input still works when API fails

#### Edge Cases Covered
- Race conditions between typing and selection
- Platform-specific TextInput behavior (iOS/Android)
- Blur/focus cycles during selection
- API failures and fallback scenarios

### Verification Steps

1. **Local Testing**:
   ```bash
   cd frontend
   npm start
   # Test on both iOS and Android simulators
   ```

2. **Build for Testing**:
   ```bash
   eas build --platform android --profile preview
   ```

3. **Production Deployment**:
   - Deploy to Alpha track first
   - Monitor for 24 hours
   - If no issues, promote to Production

### Prevention Measures

1. **Code Comments**: Added clear comments explaining the critical fix
2. **Test Coverage**: Comprehensive test suite to catch regressions
3. **Documentation**: This document and manual test scenarios
4. **Defensive Programming**: Multiple safeguards (two flags) to prevent edge cases

### Lessons Learned

1. **Order Matters**: In event handlers, always validate/check flags BEFORE performing actions
2. **React Native TextInput**: Can fire spurious change events during re-renders
3. **Controlled Components**: Need careful handling of value updates to prevent conflicts
4. **Testing**: Manual testing on actual devices is crucial for input-related bugs

### Related Issues
- versionCode 43: Initial attempt to fix this issue (incomplete)
- versionCode 49: Another attempt that didn't fully resolve it
- versionCode 52: Complete fix with proper safeguards

### Commit
```
f2ea4a3c - fix: PlacesAutocomplete selection not updating field (P1 regression fix)
```

---
**Date**: 2026-04-03
**Fixed by**: Development Team
**Verified by**: Pending Alpha testing