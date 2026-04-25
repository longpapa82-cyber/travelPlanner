# Bug #4: Browser Password Save Popup in Native App

## Problem Description
Native Android app was showing browser-like "Save password to Google?" popups when users logged in or registered, causing user confusion.

## Root Cause
React Native's `TextInput` component with `autoComplete` values like `"current-password"` or `"new-password"` triggers Android's Autofill Service, which treats the app like a web browser.

## Solution Implemented

### 1. Core Input Component (`src/components/core/Input/Input.tsx`)
- Changed `autoComplete` for password fields from `"off"` to `"off"` (consistent)
- Added `importantForAutofill="no"` for password types
- This ensures password fields don't trigger autofill prompts

### 2. Direct TextInput Usage (Auth Screens)
Updated all password TextInput components in:
- `LoginScreen.tsx` - 1 password field
- `RegisterScreen.tsx` - 2 password fields
- `ResetPasswordScreen.tsx` - 2 password fields
- `ProfileScreen.tsx` - 4 password fields (change password + delete account modals)

### Changes Applied to Each Password Field:
```tsx
// Before (problematic)
<TextInput
  secureTextEntry={true}
  autoComplete="current-password"  // or "new-password"
  ...
/>

// After (fixed)
<TextInput
  secureTextEntry={true}
  autoComplete="off"           // Disable autofill
  importantForAutofill="no"     // Android-specific: disable autofill
  autoCapitalize="none"         // Ensure proper behavior
  ...
/>
```

### Email Fields
Email fields retain `autoComplete="email"` which is appropriate and doesn't cause browser-like popups.

## Files Modified
1. `/frontend/src/components/core/Input/Input.tsx` - Core component
2. `/frontend/src/screens/auth/LoginScreen.tsx` - Login password
3. `/frontend/src/screens/auth/RegisterScreen.tsx` - Register passwords
4. `/frontend/src/screens/auth/ResetPasswordScreen.tsx` - Reset passwords
5. `/frontend/src/screens/main/ProfileScreen.tsx` - Profile password changes

## Testing Instructions

### Android Testing
1. Build and run on Android device/emulator
2. Navigate to Login screen
3. Enter email and password
4. Verify NO "Save password?" popup appears
5. Repeat for Register, Reset Password, and Profile password change

### Verification Script
Run the verification script to ensure all password fields are properly configured:
```bash
cd frontend
./scripts/verify-password-fields.sh
```

## Prevention
1. Always use `autoComplete="off"` for password fields in React Native
2. Include `importantForAutofill="no"` for Android
3. Use the core `Input` component with `type="password"` when possible
4. Run verification script before releases

## References
- React Native TextInput autoComplete docs
- Android Autofill Framework documentation
- Issue: Native apps shouldn't behave like web browsers for password management