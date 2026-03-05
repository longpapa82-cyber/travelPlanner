export default ({ config }) => ({
  ...config,
  name: 'MyTravel',
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
    buildNumber: '1',
    usesAppleSignIn: true,
    associatedDomains: [
      'applinks:mytravel-planner.com',
    ],
    infoPlist: {
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ['travelplanner'],
        },
      ],
      NSUserTrackingUsageDescription:
        'This allows us to show you personalized travel deals and offers.',
      NSPhotoLibraryUsageDescription:
        'MyTravel needs access to your photo library to add photos to your trips.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#4A90D9',
    },
    edgeToEdgeEnabled: true,
    package: 'com.longpapa82.travelplanner',
    versionCode: config.android?.versionCode ?? 10,
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'travelplanner' },
          { scheme: 'https', host: 'mytravel-planner.com', pathPrefix: '/auth' },
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
    [
      'expo-build-properties',
      {
        ios: {
          privacyManifests: {
            NSPrivacyAccessedAPITypes: [
              {
                NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
                NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
              },
            ],
            NSPrivacyCollectedDataTypes: [
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
                NSPrivacyCollectedDataTypeLinked: true,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
                NSPrivacyCollectedDataTypeLinked: true,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
                NSPrivacyCollectedDataTypeLinked: true,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
                NSPrivacyCollectedDataTypeLinked: true,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
                NSPrivacyCollectedDataTypeLinked: true,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
                NSPrivacyCollectedDataTypeLinked: false,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeAdvertisingData',
                NSPrivacyCollectedDataTypeLinked: false,
                NSPrivacyCollectedDataTypeTracking: true,
                NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising'],
              },
            ],
            NSPrivacyTracking: false,
          },
        },
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
    adsenseClientId: process.env.ADSENSE_CLIENT_ID || 'ca-pub-7330738950092177',
    adsenseDefaultSlot: process.env.ADSENSE_DEFAULT_SLOT || '2397004834',
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
        ios: process.env.ADMOB_IOS_BANNER_ID || 'ca-app-pub-7330738950092177/6974109326',
        android: process.env.ADMOB_ANDROID_BANNER_ID || 'ca-app-pub-7330738950092177/6507205462',
      },
      interstitialAdUnitId: {
        ios: process.env.ADMOB_IOS_INTERSTITIAL_ID || 'ca-app-pub-7330738950092177/6010288116',
        android: process.env.ADMOB_ANDROID_INTERSTITIAL_ID || 'ca-app-pub-7330738950092177/1039256361',
      },
      appOpenAdUnitId: {
        ios: process.env.ADMOB_IOS_APP_OPEN_ID || 'ca-app-pub-7330738950092177/6405873931',
        android: process.env.ADMOB_ANDROID_APP_OPEN_ID || 'ca-app-pub-7330738950092177/4051173331',
      },
      rewardedAdUnitId: {
        ios: process.env.ADMOB_IOS_REWARDED_ID || 'ca-app-pub-7330738950092177/7718955609',
        android: process.env.ADMOB_ANDROID_REWARDED_ID || 'ca-app-pub-7330738950092177/9032037274',
      },
    },
    revenueCatIosKey: process.env.REVENUECAT_IOS_KEY || '',
    revenueCatAndroidKey: process.env.REVENUECAT_ANDROID_KEY || '',
    sentryDsn: process.env.SENTRY_DSN || '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '6834aeb3-58dd-4d9d-a3a3-19824beb9e62',
    },
  },
});
