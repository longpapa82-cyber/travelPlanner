/**
 * Expo Config Plugin: Disable WebView Autofill
 *
 * Purpose: Prevents Chrome password save popups in AdMob ads by disabling
 * autofill for all WebView content within the app.
 *
 * Technical Details:
 * - Adds android:importantForAutofill="no" to <application> tag
 * - Applies to Android API 26+ (Oreo and above)
 * - Does NOT affect AdMob ad functionality
 * - Does NOT reduce ad revenue
 *
 * Background:
 * AdMob ads may render in WebView (especially HTML5/rich media ads).
 * Some advertiser creatives contain login forms with password fields.
 * Chrome's autofill service detects these fields and shows "Save password" popup.
 * This creates a web-like experience that disrupts native app feel.
 *
 * Solution:
 * Set importantForAutofill="no" to tell Android framework that this app's
 * views (including WebViews) should not trigger autofill prompts.
 *
 * Trade-offs:
 * ✅ Eliminates Chrome password popup in ads
 * ✅ Zero impact on ad rendering or revenue
 * ⚠️ May also disable autofill for app's own login forms (acceptable trade-off)
 *
 * References:
 * - https://developer.android.com/reference/android/view/View#attr_android:importantForAutofill
 * - https://android-developers.googleblog.com/2017/11/getting-your-android-app-ready-for.html
 *
 * @module withDisableWebViewAutofill
 * @requires @expo/config-plugins
 */

const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Modifies AndroidManifest.xml to disable autofill for the entire application.
 *
 * This plugin adds the android:importantForAutofill="no" attribute to the
 * <application> tag in AndroidManifest.xml.
 *
 * @param {object} config - Expo config object
 * @returns {object} Modified config object
 */
function withDisableWebViewAutofill(config) {
  return withAndroidManifest(config, async (config) => {
    const { manifest } = config.modResults;

    // Ensure application tag exists
    if (!manifest.application || !Array.isArray(manifest.application)) {
      manifest.application = [{}];
    }

    const application = manifest.application[0];

    // Initialize $ object for attributes if it doesn't exist
    if (!application.$) {
      application.$ = {};
    }

    // Set importantForAutofill to "no"
    // This tells Android that views in this app should not be considered
    // important for autofill, preventing Chrome from showing password save prompts
    application.$['android:importantForAutofill'] = 'no';

    console.log('✅ WebView autofill disabled in AndroidManifest.xml');
    console.log('   android:importantForAutofill="no" added to <application> tag');

    return config;
  });
}

module.exports = withDisableWebViewAutofill;
