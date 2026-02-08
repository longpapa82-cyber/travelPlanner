export default ({ config }) => ({
  ...config,
  name: 'TravelPlanner',
  slug: 'travel-planner',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.travelplanner.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    package: 'com.travelplanner.app',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: ['expo-web-browser'],
  extra: {
    apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
    affiliateIds: {
      booking: process.env.AFFILIATE_BOOKING_ID || '',
      expedia: process.env.AFFILIATE_EXPEDIA_ID || '',
      hotels: process.env.AFFILIATE_HOTELS_ID || '',
      airbnb: process.env.AFFILIATE_AIRBNB_ID || '',
      viator: process.env.AFFILIATE_VIATOR_ID || '',
      klook: process.env.AFFILIATE_KLOOK_ID || '',
    },
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '',
    },
  },
});
