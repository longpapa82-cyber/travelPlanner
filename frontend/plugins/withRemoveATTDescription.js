const { withInfoPlist } = require('@expo/config-plugins');

// expo-tracking-transparency plugin automatically injects NSUserTrackingUsageDescription
// into Info.plist. We don't request ATT permission, but we need the plugin present
// so the native ATTrackingManager framework is properly linked (removing it causes
// UIManager::setAnimationDelegate SIGSEGV crash). This plugin runs after
// expo-tracking-transparency and removes the key from Info.plist so App Store
// won't require a tracking data declaration.
const withRemoveATTDescription = (config) => {
  return withInfoPlist(config, (config) => {
    delete config.modResults['NSUserTrackingUsageDescription'];
    console.log('✅ NSUserTrackingUsageDescription removed from Info.plist');
    return config;
  });
};

module.exports = withRemoveATTDescription;
