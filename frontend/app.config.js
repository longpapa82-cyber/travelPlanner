export default ({ config }) => ({
  ...config,
  name: 'TravelPlanner',
  slug: 'travel-planner',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'travelplanner',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.travelplanner.app',
    usesAppleSignIn: true,
    associatedDomains: [
      'applinks:travelplanner.app',
    ],
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ['travelplanner'],
        },
      ],
      NSUserTrackingUsageDescription:
        '맞춤형 여행 광고를 제공하기 위해 활동 추적 권한이 필요합니다. This helps us show you relevant travel deals.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    package: 'com.travelplanner.app',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'travelplanner' },
          { scheme: 'https', host: 'travelplanner.app', pathPrefix: '/auth' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-web-browser',
    'expo-apple-authentication',
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
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
    adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
    adsenseDefaultSlot: process.env.ADSENSE_DEFAULT_SLOT || '',
    affiliateIds: {
      booking: process.env.AFFILIATE_BOOKING_ID || '',
      expedia: process.env.AFFILIATE_EXPEDIA_ID || '',
      hotels: process.env.AFFILIATE_HOTELS_ID || '',
      airbnb: process.env.AFFILIATE_AIRBNB_ID || '',
      viator: process.env.AFFILIATE_VIATOR_ID || '',
      klook: process.env.AFFILIATE_KLOOK_ID || '',
    },
    admob: {
      bannerAdUnitId: {
        ios: process.env.ADMOB_IOS_BANNER_ID || '',
        android: process.env.ADMOB_ANDROID_BANNER_ID || '',
      },
      interstitialAdUnitId: {
        ios: process.env.ADMOB_IOS_INTERSTITIAL_ID || '',
        android: process.env.ADMOB_ANDROID_INTERSTITIAL_ID || '',
      },
      appOpenAdUnitId: {
        ios: process.env.ADMOB_IOS_APP_OPEN_ID || '',
        android: process.env.ADMOB_ANDROID_APP_OPEN_ID || '',
      },
      rewardedAdUnitId: {
        ios: process.env.ADMOB_IOS_REWARDED_ID || '',
        android: process.env.ADMOB_ANDROID_REWARDED_ID || '',
      },
    },
    sentryDsn: process.env.SENTRY_DSN || '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '6834aeb3-58dd-4d9d-a3a3-19824beb9e62',
    },
  },
});
