# PlacesAutocomplete Bug Analysis

## Current Flow (What Should Happen)

1. User types "Doky" in the input field
   - `handleChangeText("Doky")` is called in PlacesAutocomplete
   - This calls `onChangeText("Doky")` from parent
   - ActivityModal: `setFormData((prev) => ({ ...prev, location: "Doky", placeId: undefined }))`
   - State: `formData.location = "Doky"`

2. After 500ms debounce, search is triggered
   - API returns predictions including "Tokyo, Japan"
   - Dropdown shows with options

3. User clicks on "Tokyo, Japan" option
   - `handleSelect(place)` is called with `place = { description: "Tokyo, Japan", placeId: "..." }`
   - Since `onSelect` is provided, it calls `onSelect(place)`
   - ActivityModal: `setFormData((prev) => ({ ...prev, location: "Tokyo, Japan", placeId: "..." }))`
   - State should update: `formData.location = "Tokyo, Japan"`

4. PlacesAutocomplete re-renders with new props
   - `value={formData.location}` should now be "Tokyo, Japan"
   - TextInput should display "Tokyo, Japan"

## Potential Issues

### Issue 1: skipNextSearch flag
When handleSelect is called, it sets `skipNextSearch.current = true` (line 119).
This might prevent the component from properly updating if there's an unintended onChangeText call.

### Issue 2: Race Condition
The state update in ActivityModal might not be immediate, and if there's any intermediate event that triggers onChangeText, it could overwrite the selection.

### Issue 3: handleChangeText being called unexpectedly
If the TextInput's onChangeText is somehow triggered after selection (maybe by the component re-rendering), it would call:
```
onChangeText(text) => setFormData((prev) => ({ ...prev, location: text, placeId: undefined }))
```
This would clear the placeId and potentially reset the location.

### Issue 4: Platform-specific behavior
The `onBlur` has a 200ms delay (line 136). During this time, if the input somehow regains focus or triggers a change event, it could interfere.

## Most Likely Root Cause

Looking at the code, the most likely issue is that after selection:
1. The dropdown closes
2. Something triggers the TextInput's onChangeText with the old value
3. This overwrites the selected location

This could happen if:
- The TextInput component maintains internal state
- There's a focus/blur cycle that triggers a change event
- The platform (iOS/Android) behaves differently with controlled inputs

## The Fix

We need to ensure that when a selection is made, the value is properly propagated and no spurious onChangeText calls can override it.