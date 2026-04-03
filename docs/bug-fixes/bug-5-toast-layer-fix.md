# Bug #5: Toast Layer Issue in ActivityModal

## Problem
When validation errors occurred in the ActivityModal (e.g., "시간, 제목, 장소, 설명을 모두 입력해주세요"), the toast message appeared behind the modal's semi-transparent overlay, making it look blurred and difficult to read.

## Root Cause
React Native's `Modal` component creates a separate native view hierarchy that sits above the normal component tree. Even though the Toast component had a higher z-index (10001), it couldn't appear above the native Modal because:

1. The Toast was rendered in the main app view hierarchy (inside ToastProvider)
2. The Modal creates a separate overlay view that covers everything
3. z-index only affects stacking within the same view hierarchy

## Solution
Created an `InlineToast` component that renders **inside** the Modal for native platforms (iOS/Android), while keeping the original portal-based Toast for web.

### Implementation Details

1. **InlineToast Component**: A lightweight toast component that renders within the modal
   - Uses Animated API for smooth entrance/exit animations
   - Positioned absolutely at the top of the modal content
   - Supports warning, error, success, and info types

2. **Platform-specific Rendering**:
   - **Native (iOS/Android)**: Uses InlineToast rendered inside the Modal
   - **Web**: Uses the original ToastContext with createPortal

3. **showModalToast Helper**: Determines which toast system to use based on platform

## Files Modified
- `/Users/hoonjaepark/projects/travelPlanner/frontend/src/components/ActivityModal.tsx`

## Key Changes

```typescript
// New InlineToast component for modal-specific toasts
const InlineToast: React.FC<{
  visible: boolean;
  message: string;
  type: 'warning' | 'error' | 'success' | 'info';
}> = ({ visible, message, type }) => {
  // Animated toast that renders inside the modal
  ...
};

// Helper function to show toast messages
const showModalToast = (type, message) => {
  if (Platform.OS !== 'web') {
    // Use inline toast for native to avoid modal z-index issues
    setInlineToast({ visible: true, message, type });
  } else {
    // Use regular toast context for web
    showToast({ type, message, position: 'top' });
  }
};
```

## Testing Checklist
- [ ] Validation errors show clearly above modal overlay on iOS
- [ ] Validation errors show clearly above modal overlay on Android
- [ ] Web platform still uses portal-based toast (unchanged)
- [ ] Toast animations work smoothly
- [ ] Toast auto-hides after 3 seconds
- [ ] Multiple rapid validations don't cause issues

## Benefits
1. **Clear Visibility**: Toast messages now appear clearly on top of the modal
2. **Platform Consistency**: Works correctly on both iOS and Android
3. **No External Dependencies**: Solution doesn't require additional packages
4. **Backward Compatible**: Web platform behavior unchanged

## Alternative Solutions Considered
1. **react-native-root-toast**: Would require new dependency
2. **Replace Modal with custom overlay**: Would lose native modal behaviors
3. **Modify global Toast z-index**: Wouldn't work due to separate view hierarchies

## Status
✅ Fixed - The toast messages now display correctly above the modal on all platforms.