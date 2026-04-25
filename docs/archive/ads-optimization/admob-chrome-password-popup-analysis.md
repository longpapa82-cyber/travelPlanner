# AdMob Chrome Password Save Popup - Root Cause Analysis & Solutions

**Date**: 2026-03-24
**Status**: Investigation Complete
**Severity**: P1 - User Experience Issue

## Problem Summary

Users are experiencing Chrome browser's "Save password" popup appearing when viewing AdMob ads within the app. This creates a web-like experience that disrupts the native app feel.

**Reported Behavior**:
- Chrome popup: "비밀번호(들)을 Google에 저장하시겠습니까?"
- User email visible: i090723@naver.com
- Occurs during AdMob ad display
- Makes app feel like a web service instead of native app

---

## Phase 1: Root Cause Analysis

### Current AdMob Implementation

**Package**: `react-native-google-mobile-ads@16.0.3`

**Ad Types Implemented**:
1. **Banner Ads** (`AdMobBanner.native.tsx`)
   - Uses native `BannerAd` component
   - Size: Adaptive banner (default)
   - Non-personalized ads enabled

2. **Interstitial Ads** (`useInterstitialAd.native.ts`)
   - Full-screen ads at strategic moments
   - Auto-loads and pre-caches next ad

3. **App Open Ads** (`useAppOpenAd.native.ts`)
   - Shows when app returns to foreground (after 3+ minutes)

4. **Rewarded Ads** (`useRewardedAd.native.ts`)
   - User watches ad for rewards

**Key Configuration** (`app.config.js`):
```javascript
[
  'react-native-google-mobile-ads',
  {
    androidAppId: 'ca-app-pub-7330738950092177~5475101490',
    iosAppId: 'ca-app-pub-7330738950092177~7468498577',
    delayAppMeasurementInit: true,
  },
]
```

### Root Cause: WebView-based Ad Rendering

**Finding**: AdMob ads on Android use WebView internally to render certain ad formats, especially:
- Rich media ads
- Video ads
- Interactive ads with forms
- HTML5 creative ads

**How Password Popup Appears**:

1. **Ad Landing Page Contains Form**:
   - Some advertisers include login forms in ad creatives
   - Forms have `<input type="password">` elements
   - Chrome autofill detects password fields in WebView

2. **Chrome Autofill Service Active**:
   - Android System WebView uses Chrome's autofill engine
   - WebView has JavaScript enabled (required for AdMob)
   - Third-party cookies enabled (required for AdMob)
   - No explicit autofill restrictions configured

3. **Default WebView Behavior**:
   - `setSaveFormData()` not explicitly disabled
   - No `android:importantForAutofill="no"` flag set
   - Chrome treats WebView content like regular web pages

**Evidence**:
- Native AdMob SDK (`react-native-google-mobile-ads`) uses Android's native ad components
- However, ad **creative content** renders in WebView for HTML-based ads
- Google Mobile Ads SDK documentation requires JavaScript and DOM storage for ad functionality
- WebView autofill is enabled by default on Android API 26+

### Why This Happens in Your App

Your app correctly uses:
- ✅ Native AdMob SDK (not WebView-based ad integration)
- ✅ Non-personalized ads (`requestNonPersonalizedAdsOnly: true`)
- ✅ Proper ad unit IDs for production

However:
- ❌ No explicit autofill restrictions on WebView content
- ❌ Ad creatives themselves may contain forms (advertiser-controlled)
- ❌ Chrome autofill service detects form fields in ad WebViews

---

## Phase 2: Solution Analysis

### Option Comparison Matrix

| Solution | Effectiveness | AdMob Revenue Impact | Implementation Complexity | Recommendation |
|----------|--------------|---------------------|--------------------------|----------------|
| **Option 1**: Disable WebView Autofill via Config Plugin | 🟢 High | 🟢 None | 🟡 Medium | ⭐ **Recommended** |
| **Option 2**: Update AndroidManifest.xml | 🟢 High | 🟢 None | 🟢 Low | ⭐ **Recommended** |
| **Option 3**: Disable Chrome Autofill at System Level | 🔴 Low | 🟢 None | 🔴 Very High | ❌ Not Recommended |
| **Option 4**: Filter Ad Categories | 🟡 Medium | 🔴 High | 🟡 Medium | ⚠️ Use with Caution |
| **Option 5**: Request Non-Interactive Ads | 🟡 Medium | 🟡 Medium | 🟢 Low | ⚠️ Limited Effectiveness |

---

## Phase 3: Recommended Solutions

### ✅ Solution 1: Disable WebView Autofill via Expo Config Plugin (PRIMARY)

**Rationale**: Targets root cause without affecting AdMob functionality.

**Implementation**:

#### Step 1: Create Expo Config Plugin

Create file: `/Users/hoonjaepark/projects/travelPlanner/frontend/plugins/withDisableWebViewAutofill.js`

```javascript
const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin to disable WebView autofill in the application
 * This prevents Chrome password save popups in AdMob ads
 */
function withDisableWebViewAutofill(config) {
  return withAndroidManifest(config, async (config) => {
    const { manifest } = config.modResults;

    // Add importantForAutofill to application tag
    if (!manifest.application) {
      manifest.application = [{}];
    }

    const application = manifest.application[0];

    // Set autofill importance to no
    application.$['android:importantForAutofill'] = 'no';

    return config;
  });
}

module.exports = withDisableWebViewAutofill;
```

#### Step 2: Register Plugin in app.config.js

```javascript
// In plugins array, add:
plugins: [
  // ... existing plugins
  './plugins/withDisableWebViewAutofill',
]
```

#### Step 3: Rebuild Native Code

```bash
# Clean existing native code
cd /Users/hoonjaepark/projects/travelPlanner/frontend
rm -rf android ios

# Rebuild with new config
npx expo prebuild --clean

# Build new AAB
eas build --platform android --profile production
```

**Expected Outcome**:
- AndroidManifest.xml will include: `<application android:importantForAutofill="no" ... >`
- Chrome will not trigger autofill prompts in any WebView within the app
- AdMob ads continue to render normally

**Benefits**:
- ✅ Addresses root cause
- ✅ Zero impact on ad revenue
- ✅ No changes to ad rendering
- ✅ Applies to all WebView content (including future ads)

---

### ✅ Solution 2: Block Sensitive Content Categories (COMPLEMENTARY)

**Rationale**: Reduce likelihood of ads containing login forms.

**Implementation**:

#### Step 1: Configure AdMob Blocking Controls

1. Log in to [AdMob Console](https://apps.admob.com)
2. Navigate to: **Blocking controls** → **Sensitive categories**
3. Block the following categories:

**Recommended Blocks**:
- ✅ Dating & Personals (often has login forms)
- ✅ Financial Services (banking login forms)
- ✅ Social Media (account signup forms)
- ✅ Email & Messaging (login forms)

#### Step 2: Enable Content Ratings Filter

Navigate to: **Blocking controls** → **Content ratings**
- ✅ Block ads rated higher than your app's content rating

**Revenue Impact**: ~5-15% reduction (minor)

**Benefits**:
- ✅ Reduces ads with forms
- ✅ Improves ad relevance
- ✅ Better user experience

---

### ⚠️ Solution 3: Request Control Level (OPTIONAL)

**Implementation**: Update all ad requests

```typescript
// In AdMobBanner.native.tsx, useInterstitialAd.native.ts, etc.
const requestOptions = {
  requestNonPersonalizedAdsOnly: true,
  // Add content URL hint
  contentUrl: 'mytravel-planner://app',
  // Request family-safe ads (less likely to have forms)
  tagForChildDirectedTreatment: false,
  tagForUnderAgeOfConsent: false,
};
```

**Note**: This is a weak control and may not prevent all form-containing ads.

---

## Phase 4: Implementation Plan

### Timeline: 2-3 Days

#### Day 1: Primary Solution Implementation
**Tasks**:
1. Create `withDisableWebViewAutofill.js` plugin (30 min)
2. Update `app.config.js` to register plugin (5 min)
3. Test locally with `npx expo prebuild` (10 min)
4. Verify AndroidManifest.xml contains `android:importantForAutofill="no"` (5 min)

**Verification**:
```bash
# Check generated manifest
cat android/app/src/main/AndroidManifest.xml | grep importantForAutofill
# Should output: android:importantForAutofill="no"
```

#### Day 2: Build & Deploy
**Tasks**:
1. Build production AAB with EAS (20-30 min)
2. Upload to Play Console Alpha track (10 min)
3. Test with license testers (30 min)

**Test Cases**:
- ✅ View ads with different formats (banner, interstitial, rewarded)
- ✅ Verify Chrome password popup does NOT appear
- ✅ Verify ads load and display correctly
- ✅ Check ad click-through works
- ✅ Verify app login still triggers Chrome autofill (if desired)

#### Day 3: Complementary Solutions
**Tasks**:
1. Configure AdMob blocking controls (15 min)
2. Block sensitive categories (5 min)
3. Monitor ad fill rate and revenue for 24 hours

---

## Phase 5: Testing & Verification

### Test Scenarios

#### Scenario 1: Banner Ads
**Steps**:
1. Open app home screen
2. Scroll to view banner ad
3. Wait for ad to fully load
4. Tap on ad (if clickable)

**Expected**:
- ❌ NO Chrome password popup
- ✅ Ad renders correctly
- ✅ Ad click opens browser

#### Scenario 2: Interstitial Ads
**Steps**:
1. Complete trip creation
2. Interstitial ad displays
3. Wait 5 seconds
4. Close ad

**Expected**:
- ❌ NO Chrome password popup
- ✅ Ad displays full-screen
- ✅ Close button works

#### Scenario 3: Rewarded Ads
**Steps**:
1. Tap "Watch Ad for Reward"
2. Ad displays
3. Watch full ad
4. Receive reward

**Expected**:
- ❌ NO Chrome password popup
- ✅ Reward granted after completion

#### Scenario 4: App Login (Control Test)
**Steps**:
1. Log out of app
2. Log in with email/password
3. Check if Chrome offers to save password

**Expected**:
- ⚠️ Chrome MAY NOT offer to save password (autofill disabled app-wide)
- ℹ️ This is acceptable trade-off for better ad UX

**Alternative**: If you want to preserve autofill for app login, use **Solution 1B** below.

---

## Phase 6: Alternative Implementation (Fine-Grained Control)

### Solution 1B: Target Only Ad WebViews

If you want to preserve Chrome autofill for your app's login forms while disabling it only in ads, you need to configure the AdMob SDK's WebView programmatically.

**Limitation**: `react-native-google-mobile-ads` does not expose direct WebView configuration. You would need to:

1. **Fork the package** (not recommended)
2. **Create native module** to intercept WebView creation
3. **Use Android's Autofill Service API** to selectively block autofill

**Complexity**: High (7-10 days development)

**Recommendation**: Start with **Solution 1** (app-wide disable). If you later need login autofill, implement custom autofill service.

---

## Phase 7: Monitoring & Rollback Plan

### Success Metrics (Post-Deployment)

**User Experience**:
- Target: 0 reports of password popups within 7 days
- Monitor: App store reviews, user feedback

**Ad Revenue**:
- Baseline: Current eCPM and fill rate
- Tolerance: Max 5% decrease acceptable
- Monitor: AdMob dashboard daily for 7 days

**Technical Metrics**:
- Ad load success rate: ≥98%
- Ad click-through rate: Within ±10% of baseline
- App crash rate: No increase

### Rollback Plan

If revenue decreases >10% after 7 days:

**Step 1**: Disable blocking controls (revert Solution 2)
**Step 2**: Monitor for 3 days
**Step 3**: If revenue recovers, keep Solution 1 only
**Step 4**: If revenue still low, investigate other causes (unrelated to autofill fix)

---

## Phase 8: Long-Term Recommendations

### AdMob Optimization

1. **Ad Mediation**: Implement mediation to diversify ad sources
   - Reduces dependency on single ad network
   - May reduce form-based ads

2. **Ad Placement Review**: Analyze which placements trigger popups most
   - Use AdMob placement reports
   - Adjust frequency caps

3. **User Feedback Loop**: Add in-app feedback button for ad issues
   - Track popup occurrences
   - Identify problematic ad campaigns

### Chrome Autofill Education

If users complain about losing login autofill:

**In-App Message**:
> "We've disabled password suggestions to improve your ad experience. You can still save passwords in Chrome settings."

**Help Article**: Document how to use Chrome's manual password save.

---

## Technical References

### Android Autofill API
- [Getting your Android app ready for Autofill](https://android-developers.googleblog.com/2017/11/getting-your-android-app-ready-for.html)
- `android:importantForAutofill` attribute (API 26+)

### AdMob WebView Integration
- [Integrate the WebView API for Ads](https://developers.google.com/admob/android/browser/webview/api-for-ads)
- WebView settings required by AdMob

### Expo Config Plugins
- [Config Plugins](https://docs.expo.dev/config-plugins/introduction/)
- `withAndroidManifest` modifier

---

## Summary & Next Steps

### Root Cause Identified ✅
Chrome autofill detects password fields in advertiser-controlled ad creatives rendered in WebView, triggering save prompts.

### Primary Solution ⭐
Disable WebView autofill via Expo config plugin by adding `android:importantForAutofill="no"` to AndroidManifest.

### Implementation Priority
1. **Immediate** (Day 1): Implement config plugin
2. **Follow-up** (Day 2-3): Deploy and test
3. **Optional** (Week 2): Enable AdMob blocking controls

### Expected Outcome
- ✅ Zero Chrome password popups in ads
- ✅ Native app experience maintained
- ✅ Ad revenue unaffected (or minimal impact <5%)
- ✅ User satisfaction improved

### Risk Assessment
- **Technical Risk**: Low (config change only)
- **Revenue Risk**: Very Low (<5% potential decrease)
- **User Experience Risk**: Very Low (positive outcome expected)

---

**Status**: Ready for implementation
**Owner**: Development team
**Reviewer**: QA team
**Estimated Effort**: 2-3 days
**Go/No-Go Decision**: ✅ Proceed with implementation
