const { withAndroidManifest } = require('@expo/config-plugins');

const withDisableWebViewAutofill = (config) => {
  return withAndroidManifest(config, async (config) => {
    const { manifest } = config.modResults;
    const application = manifest.application?.[0];
    
    if (application) {
      application.$['android:importantForAutofill'] = 'no';
      console.log('✅ WebView autofill disabled in AndroidManifest.xml');
    } else {
      console.warn('⚠️ Could not find <application> element in AndroidManifest.xml');
    }
    
    return config;
  });
};

module.exports = withDisableWebViewAutofill;
