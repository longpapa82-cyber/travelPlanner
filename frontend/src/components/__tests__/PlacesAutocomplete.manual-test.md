# PlacesAutocomplete Manual Test Scenario

## Bug: Location autocomplete selection not working

### Steps to Reproduce (Before Fix)
1. Open the app and navigate to trip creation or activity modal
2. Click on the location input field
3. Type "Doky" (or any partial text)
4. Wait for autocomplete suggestions to appear
5. Select one of the suggestions (e.g., "Tokyo, Japan")

**Expected:** The input field should show "Tokyo, Japan"
**Actual (Bug):** The input field still shows "Doky"

### Root Cause
The bug was in `handleChangeText` function which was calling `onChangeText(text)` BEFORE checking the `skipNextSearch` flag. This caused any spurious change events after selection to reset the field to the old value.

### Fix Applied
1. **Primary Fix:** Moved the `skipNextSearch` check BEFORE calling `onChangeText`
2. **Additional Safeguard:** Added `justSelected` ref to prevent any input changes during the selection process
3. **Race Condition Prevention:** Set flags before any state updates in `handleSelect`

### Test Cases After Fix

#### Test 1: Basic Selection
1. Type "tok" in location field
2. Select "Tokyo, Japan" from dropdown
3. **Verify:** Input shows "Tokyo, Japan"
4. **Verify:** placeId is set in formData

#### Test 2: Multiple Selections
1. Type "new" and select "New York, NY, USA"
2. Clear the field
3. Type "lon" and select "London, UK"
4. **Verify:** Each selection updates correctly

#### Test 3: Fast Typing and Selection
1. Type quickly "san fran"
2. Immediately select "San Francisco, CA, USA"
3. **Verify:** No race condition, selection works

#### Test 4: Focus/Blur Behavior
1. Type "par"
2. Select "Paris, France"
3. Click outside the field
4. Click back on the field
5. **Verify:** Field still shows "Paris, France"

#### Test 5: API Unavailable Fallback
1. Disconnect network or exceed API limit
2. Type location manually
3. **Verify:** Manual input still works

### Code Changes Summary
```typescript
// Before (BUG):
const handleChangeText = (text: string) => {
  onChangeText(text);  // <-- This was called FIRST
  if (skipNextSearch.current) {
    skipNextSearch.current = false;
    return;
  }
  // ...
};

// After (FIXED):
const handleChangeText = (text: string) => {
  // Check flags BEFORE calling onChangeText
  if (skipNextSearch.current || justSelected.current) {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
    }
    return;
  }
  onChangeText(text);  // <-- Now called AFTER checks
  // ...
};
```

### Verification in Production
1. Deploy to test environment
2. Test on both iOS and Android devices
3. Test with slow network conditions
4. Monitor for any console errors

### Regression Prevention
- Added comprehensive test cases
- Added defensive programming with multiple flags
- Clear comments explaining the critical fix
- This manual test document for future reference