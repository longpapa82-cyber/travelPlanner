# Profile Image Upload Test Script

## Test Environment
- Backend: https://mytravel-planner.com
- Frontend: React Native app (Android/iOS)

## Prerequisites
1. User account logged in
2. Test image file ready (JPG/PNG)

## Test Steps

### 1. Upload Profile Image
1. Go to Profile tab (bottom navigation)
2. Tap on the camera icon or profile avatar area
3. Expected: Image picker opens

### 2. Select Image
1. Choose "Select from Gallery" option
2. Select a test image
3. Expected: Image editor appears with crop option

### 3. Confirm Upload
1. Adjust crop if needed (1:1 aspect ratio)
2. Tap "Choose" or "Done"
3. Expected:
   - Loading spinner appears on camera badge
   - Toast message "Profile photo updated successfully" appears
   - Profile image updates to the selected photo

### 4. Verify Persistence
1. Navigate away from Profile screen (go to Home tab)
2. Return to Profile tab
3. Expected: Profile image is still displayed

### 5. Verify Display in Other Screens
1. Create a new trip or view existing trips
2. Check if profile image appears in:
   - Trip cards (if public)
   - Discover/Social feed
   - User profile when viewed by others

## Backend Verification

### API Call Flow
1. `POST /api/trips/upload/photo` - Upload image file
   - Request: multipart/form-data with 'photo' field
   - Response: `{ url: "https://mytravel-planner.com/uploads/photos/xxx.webp", thumbnailUrl: "..." }`

2. `PATCH /api/users/me` - Update profile
   - Request: `{ profileImage: "https://mytravel-planner.com/uploads/photos/xxx.webp" }`
   - Response: Updated user object

### Expected Results
- Image is converted to WebP format
- Image is optimized (max 1200px wide, 80% quality)
- Thumbnail is generated (300px)
- Full URL is returned (not relative path)
- Profile updates successfully with new image URL

## Edge Cases to Test
1. **Large Image**: Upload >10MB image → Should show error
2. **Invalid Format**: Upload non-image file → Should show error
3. **Network Error**: Turn off internet during upload → Should show error
4. **Quick Actions**: Rapidly tap upload multiple times → Should handle gracefully
5. **Cancel**: Start upload then cancel → Should revert to previous state

## Success Criteria
- ✅ Image uploads successfully
- ✅ Profile displays new image immediately
- ✅ Image persists after app restart
- ✅ Image appears in all relevant screens
- ✅ Error handling works correctly
- ✅ Loading states display properly