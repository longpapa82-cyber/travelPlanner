# AdMob Chrome Password Popup - Quick Implementation Guide

**Issue**: Chrome password save popup appears in AdMob ads
**Solution**: Disable WebView autofill via Expo config plugin
**Estimated Time**: 30 minutes
**Impact**: Zero revenue impact, improved UX

---

## Step 1: Register Config Plugin (5 minutes)

### Edit `frontend/app.config.js`

Add the plugin to the `plugins` array:

```javascript
plugins: [
  'expo-web-browser',
  'expo-apple-authentication',
  '@react-native-google-signin/google-signin',
  // ... existing plugins ...

  // Add this line at the end of plugins array:
  './plugins/withDisableWebViewAutofill',
],
```

**Full context** (lines 60-79 in app.config.js):
```javascript
plugins: [
  'expo-web-browser',
  'expo-apple-authentication',
  '@react-native-google-signin/google-signin',
  [
    'expo-notifications',
    {
      icon: './assets/icon.png',
      color: '#3B82F6',
    },
  ],
  'expo-tracking-transparency',
  [
    'react-native-google-mobile-ads',
    {
      androidAppId: process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-7330738950092177~5475101490',
      iosAppId: process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-7330738950092177~7468498577',
      delayAppMeasurementInit: true,
    },
  ],
  [
    'expo-build-properties',
    {
      android: {
        extraProguardRules: '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
      },
      ios: {
        privacyManifests: {
          NSPrivacyAccessedAPITypes: [
            // ... (existing iOS privacy config)
          ],
        },
      },
    },
  ],
  // ⬇️ ADD THIS LINE HERE ⬇️
  './plugins/withDisableWebViewAutofill',
],
```

---

## Step 2: Test Plugin Locally (10 minutes)

### Generate AndroidManifest.xml

```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# Clean existing native code
rm -rf android

# Generate new Android project with plugin applied
npx expo prebuild --platform android --no-install
```

### Verify Configuration

Check that the plugin was applied correctly:

```bash
# Search for importantForAutofill in generated manifest
grep -n "importantForAutofill" android/app/src/main/AndroidManifest.xml
```

**Expected output**:
```xml
<application
  android:importantForAutofill="no"
  android:name=".MainApplication"
  ...
>
```

**Success criteria**:
- ✅ Command outputs line number and `android:importantForAutofill="no"`
- ✅ Attribute is inside `<application>` tag
- ✅ No errors during prebuild

**If you see the console log** during prebuild:
```
✅ WebView autofill disabled in AndroidManifest.xml
   android:importantForAutofill="no" added to <application> tag
```
This confirms the plugin ran successfully.

---

## Step 3: Build Production AAB (20-30 minutes)

### Update versionCode

Edit `frontend/app.config.js`:

```javascript
android: {
  // ...
  versionCode: 35, // Increment from current: 34 → 35
},
```

### Build with EAS

```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# Build production Android App Bundle
eas build --platform android --profile production
```

**Expected output**:
```
✔ Build finished
Build ID: [BUILD_ID]
Build details: https://expo.dev/artifacts/...
```

**Time**: ~20-30 minutes (EAS cloud build)

### Download AAB

```bash
# EAS will provide a download URL
# Download AAB from Expo dashboard or use CLI:
eas build:download --id [BUILD_ID]
```

---

## Step 4: Deploy to Alpha Track (10 minutes)

### Upload to Play Console

1. Go to [Play Console](https://play.google.com/console/)
2. Select **MyTravel** app
3. Navigate to: **Testing** → **Internal testing** or **Closed testing (Alpha)**
4. Click **Create new release**
5. Upload the AAB file
6. Add release notes (all 3 languages):

**Korean**:
```
광고 시청 중 Chrome 비밀번호 저장 팝업 문제 수정
사용자 경험 개선
```

**English**:
```
Fixed Chrome password save popup appearing in ads
Improved user experience
```

**Japanese**:
```
広告表示中のChromeパスワード保存ポップアップ問題を修正
ユーザーエクスペリエンス改善
```

7. Click **Save** → **Review release** → **Start rollout to Alpha**

---

## Step 5: Test with License Testers (30 minutes)

### Test Cases

Ask license testers to perform these tests:

#### Test 1: Banner Ads
1. Open app home screen
2. Scroll to view banner ad
3. Wait for ad to fully load
4. **Check**: Chrome password popup should NOT appear ❌

#### Test 2: Interstitial Ads
1. Create a new trip or perform action that triggers interstitial
2. Wait for ad to display
3. Watch ad and close
4. **Check**: Chrome password popup should NOT appear ❌

#### Test 3: Ad Click-Through
1. Tap on any ad (banner or interstitial)
2. Ad should open in browser
3. **Check**: Ad click works normally ✅

#### Test 4: App Login (Optional)
1. Log out of app
2. Log in with email/password
3. **Check**: Chrome may NOT offer to save password (expected behavior)
   - This is acceptable trade-off for better ad UX
   - Users can still save passwords manually in Chrome settings

### Success Criteria

- ✅ NO Chrome password popup in any ad format
- ✅ Ads load and display correctly
- ✅ Ad clicks open browser/landing page
- ✅ App stability maintained (no crashes)

---

## Step 6: Monitor Ad Revenue (7 days)

### Baseline Metrics (Before Fix)

Collect current metrics from AdMob dashboard:
- eCPM (earnings per 1000 impressions)
- Fill rate
- Click-through rate (CTR)
- Total impressions
- Total revenue

### Post-Deployment Monitoring

Check AdMob dashboard daily for 7 days:

**Day 1-3**: Initial monitoring
- Expected: Minor fluctuations (normal variance)
- Tolerance: ±5% change in eCPM

**Day 4-7**: Trend analysis
- Expected: Metrics stabilize to baseline
- Tolerance: Max 5% decrease acceptable

### Revenue Health Check

| Metric | Baseline | Target Range | Action If Outside Range |
|--------|----------|--------------|-------------------------|
| eCPM | $X.XX | ±5% | Investigate if >5% decrease |
| Fill Rate | XX% | ±3% | Check ad inventory |
| CTR | X.XX% | ±10% | Normal variance |
| Impressions | XXX,XXX | ±5% | Check user engagement |

---

## Rollback Plan (If Needed)

If ad revenue decreases >10% after 7 days:

### Option A: Revert Plugin (Full Rollback)

1. Edit `frontend/app.config.js`:
   ```javascript
   // Comment out the plugin:
   // './plugins/withDisableWebViewAutofill',
   ```

2. Rebuild and redeploy:
   ```bash
   npx expo prebuild --clean --platform android
   eas build --platform android --profile production
   ```

3. Upload new AAB to Play Console

### Option B: Implement Ad Category Blocking

Keep the plugin but reduce ads with forms:

1. Go to [AdMob Console](https://apps.admob.com)
2. Navigate to **Blocking controls** → **Sensitive categories**
3. Block:
   - Dating & Personals
   - Financial Services
   - Social Media
   - Email & Messaging

4. Monitor revenue for 3 more days

---

## Troubleshooting

### Issue: Plugin not applied (importantForAutofill not in manifest)

**Symptoms**:
- `grep` command finds no results
- No console log during prebuild

**Solution**:
1. Check plugin path is correct: `./plugins/withDisableWebViewAutofill`
2. Verify plugin file exists: `/Users/hoonjaepark/projects/travelPlanner/frontend/plugins/withDisableWebViewAutofill.js`
3. Clean and rebuild:
   ```bash
   rm -rf android node_modules/.cache
   npm install
   npx expo prebuild --clean --platform android
   ```

### Issue: Build fails with plugin error

**Symptoms**:
```
Error: Cannot find module './plugins/withDisableWebViewAutofill'
```

**Solution**:
1. Check file exists and has correct name (case-sensitive)
2. Verify file has valid JavaScript syntax
3. Try absolute path instead:
   ```javascript
   require.resolve('./plugins/withDisableWebViewAutofill')
   ```

### Issue: Password popup still appears after deployment

**Possible causes**:
1. Old app version still installed on device
   - Solution: Uninstall and reinstall app

2. Chrome cache not cleared
   - Solution: Clear Chrome app data in Android settings

3. Specific advertiser using overlay/modal instead of form
   - Solution: Report ad via AdMob and block advertiser

---

## Alternative: Manual AndroidManifest Edit (Not Recommended)

If you prefer not to use a config plugin, you can manually edit the manifest after each prebuild:

```bash
# After npx expo prebuild
# Edit: android/app/src/main/AndroidManifest.xml

# Find <application tag and add:
<application
  android:importantForAutofill="no"
  ...
>
```

**Warning**: This change will be overwritten every time you run `npx expo prebuild`. Use the config plugin instead for persistent configuration.

---

## Next Steps After Success

### Optional: Enable AdMob Blocking Controls

If you want additional protection against form-containing ads:

1. Log in to [AdMob Console](https://apps.admob.com)
2. Go to **Blocking controls**
3. Block sensitive categories (see Step 6, Option B above)

### Optional: Add User Feedback

Implement in-app feedback button for ad issues:

```typescript
// In ad component:
<TouchableOpacity onPress={reportAdIssue}>
  <Text>Report Ad Issue</Text>
</TouchableOpacity>

const reportAdIssue = () => {
  // Send to backend or Sentry
  apiService.logError('User reported ad issue', {
    screen: 'HomeScreen',
    adType: 'banner',
  });
};
```

---

## Summary Checklist

Before deploying to production:

- [ ] Config plugin created: `frontend/plugins/withDisableWebViewAutofill.js`
- [ ] Plugin registered in `app.config.js`
- [ ] Local prebuild test passed (importantForAutofill found in manifest)
- [ ] versionCode incremented (34 → 35)
- [ ] Production AAB built with EAS
- [ ] AAB uploaded to Play Console Alpha track
- [ ] Release notes added (ko/en/ja)
- [ ] Alpha release rolled out
- [ ] License testers notified
- [ ] Test cases executed successfully
- [ ] Baseline ad metrics recorded
- [ ] 7-day monitoring plan scheduled

**Estimated Total Time**: 1-2 hours
**Expected Outcome**: ✅ Zero Chrome password popups, maintained ad revenue

---

**Questions or Issues?**
- Review full analysis: `docs/admob-chrome-password-popup-analysis.md`
- Check AdMob documentation: https://developers.google.com/admob
- Check Expo plugins guide: https://docs.expo.dev/config-plugins/introduction/
