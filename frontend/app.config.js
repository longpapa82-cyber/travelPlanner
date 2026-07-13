export default ({ config }) => ({
  ...config,
  name: 'MyTravel',
  slug: 'travel-planner',
  version: '1.4.4',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'travelplanner',
  // NOTE: Top-level splash intentionally omitted.
  // iOS splash is controlled via ['expo-splash-screen', props] in plugins[] below
  // so getIosSplashConfig.js takes the `if (props)` branch — enabling imageWidth control.
  // Android splash is set in android.splash below (separate block required for Android).
  // Web has no splash (WebAppRedirectScreen renders immediately).
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.longpapa82.travelplanner',
    buildNumber: '87',
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
      // canOpenURL() returns false for any scheme not listed here (iOS 9+),
      // so TripMapView's "구글맵으로 열기" silently failed even when the app
      // was installed. Declare the map schemes we probe so the app-open path
      // (comgooglemaps / Apple Maps) works instead of falling through.
      LSApplicationQueriesSchemes: ['comgooglemaps', 'maps'],
      NSPhotoLibraryUsageDescription:
        'MyTravel needs access to your photo library to add photos to your trips.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#4A90D9',
    },
    // Android splash backgroundColor: #4A90D9 so native splash bg → app icon visible.
    // hideAsync() fires at JS mount (~2.5s after launch) so native splash shows for ~2.5s.
    // After hideAsync(), !appReady white+spinner screen shows briefly (~3s, i18n loading).
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#4A90D9',
      imageWidth: 288,
    },
    // edgeToEdgeEnabled: false — EdgeToEdgePackage.onCreate()이 즉시 enableEdgeToEdge()를
    // 호출해 navigationBar 색상 변경 → WindowManager inset 재계산 → 파란 배경 깜빡임 유발.
    // withAndroidDeferEdgeToEdge 플러그인으로 지연을 시도했으나 EdgeToEdgePackage 자체를
    // 막지 못해 여전히 즉시 실행됨. StatusBar는 expo-status-bar로 JS에서 제어.
    edgeToEdgeEnabled: false,
    softwareKeyboardLayoutMode: 'pan',
    package: 'com.longpapa82.travelplanner',
    versionCode: config.android?.versionCode ?? 288,
    // V189.1 P0-D: explicit permission whitelist.
    //
    // V189.0 listed READ_MEDIA_IMAGES so the photo picker would work on
    // Android 13+. Play submission failed with: "All developers requesting
    // access to the photo and video permissions are required to tell Google
    // Play about the core functionality of their app" — Play's Photo &
    // Video Permissions Declaration would have to be filled out manually.
    //
    // Better fix: remove the permission entirely. expo-image-picker on
    // Android 13+ uses the system Photo Picker (PhotoPickerActivity) which
    // does NOT require READ_MEDIA_IMAGES — the user picks the photo in a
    // system dialog and the app receives a content:// URI scoped to that
    // single asset. Photo Picker is the Google-recommended path for any
    // app that just needs the user to choose a photo (vs apps that index
    // the whole library, which still need the permission + declaration).
    //
    // Net effect: same UX, no permission dialog, no Play declaration
    // required, privacy.html stays accurate (no broad photo-library access).
    permissions: [
      'INTERNET',
      'VIBRATE',
      'POST_NOTIFICATIONS',
      'com.google.android.gms.permission.AD_ID',
    ],
    blockedPermissions: [
      'RECORD_AUDIO',
      'SYSTEM_ALERT_WINDOW',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES', // V189.1: system Photo Picker doesn't need it
      'READ_MEDIA_VIDEO',
      'READ_MEDIA_VISUAL_USER_SELECTED',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        data: [{ scheme: 'travelplanner' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'mytravel-planner.com', pathPrefix: '/auth' },
          { scheme: 'https', host: 'mytravel-planner.com', pathPrefix: '/app' },
          { scheme: 'https', host: 'mytravel-planner.com', pathPrefix: '/share' },
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
    './plugins/withDisableWebViewAutofill',
    './plugins/withAndroidMapQueries',
    './plugins/withAndroidSplashImageWidth',
    './plugins/withAndroidSplashAnimationDuration',
    './plugins/withAndroidWindowBackground',
    // withAndroidDeferEdgeToEdge 제거 — edgeToEdgeEnabled:false로 EdgeToEdgePackage 비활성화했으므로 불필요
    './plugins/withFixSplashScreenRaceCondition',
    // iOS splash: use plugin form so getIosSplashConfig takes the `if (props)` branch.
    // enableFullScreenImage_legacy: false → uses SplashScreenLogo (imageWidth respected).
    // imageWidth: 85 matches the JS loading screen icon size in App.tsx for a seamless transition.
    [
      'expo-splash-screen',
      {
        image: './assets/icon_transparent.png',
        backgroundColor: '#4A90D9',
        resizeMode: 'contain',
        enableFullScreenImage_legacy: false,
        imageWidth: 200,
      },
    ],
    // expo-tracking-transparency plugin must be present even though ATT is not used.
    // The package is in package.json (react-native-google-mobile-ads links ATTrackingManager),
    // so the native module must be initialized via this plugin or UIManager crashes (SIGSEGV).
    // userTrackingPermission: false prevents NSUserTrackingUsageDescription from being
    // injected into Info.plist — App Store won't require a tracking data declaration.
    ['expo-tracking-transparency', { userTrackingPermission: false }],
    // Double-guard: remove NSUserTrackingUsageDescription even if injected by any plugin.
    './plugins/withRemoveATTDescription',
    'expo-web-browser',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      {
        // iOS: registers the reversed client ID as a URL scheme so the
        // Google Sign-In SDK can redirect back to the app after auth.
        // Without this, iOS crashes after account selection (no callback URL scheme).
        iosUrlScheme: 'com.googleusercontent.apps.48805541090-9gh3sp9asspe3d1et4er2pqpihm2bg47',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#3B82F6',
      },
    ],
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-7330738950092177~5475101490',
        // iosAppId is required by the native Google Mobile Ads SDK (GADApplicationIdentifier).
        // Removing it causes an immediate crash on launch. AdMob ads are disabled on iOS at
        // runtime via Platform.OS === 'ios' checks in initAds.native.ts and useGDPRConsent.ts.
        // UMP consent form is also skipped on iOS in those same files.
        iosAppId: process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-7330738950092177~7468498577',
        delayAppMeasurementInit: true,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          extraProguardRules: '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
          mainActivityLaunchMode: 'singleTask',
        },
        ios: {
          // AdMob 계열 Google pod(AppCheckCore, GoogleUtilities, RecaptchaInterop)이
          // Swift로 전환되면서 static 라이브러리 통합 불가 에러 발생
          // ("cannot yet be integrated as static libraries"). useFrameworks:'static'은
          // 이 pod들을 정적 프레임워크로 링크해 문제를 해소한다. Hermes/RN 0.81과 호환.
          useFrameworks: 'static',
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
        ios: process.env.ADMOB_IOS_BANNER_ID || 'ca-app-pub-7330738950092177/8971179051',
        android: process.env.ADMOB_ANDROID_BANNER_ID || 'ca-app-pub-7330738950092177/6507205462',
      },
      interstitialAdUnitId: {
        ios: process.env.ADMOB_IOS_INTERSTITIAL_ID || 'ca-app-pub-7330738950092177/5357413279',
        android: process.env.ADMOB_ANDROID_INTERSTITIAL_ID || 'ca-app-pub-7330738950092177/1039256361',
      },
      appOpenAdUnitId: {
        ios: process.env.ADMOB_IOS_APP_OPEN_ID || 'ca-app-pub-7330738950092177/6478923255',
        android: process.env.ADMOB_ANDROID_APP_OPEN_ID || 'ca-app-pub-7330738950092177/4051173331',
      },
      rewardedAdUnitId: {
        ios: process.env.ADMOB_IOS_REWARDED_ID || 'ca-app-pub-7330738950092177/9960827090',
        android: process.env.ADMOB_ANDROID_REWARDED_ID || 'ca-app-pub-7330738950092177/9032037274',
      },
    },
    revenueCatIosKey: process.env.REVENUECAT_IOS_KEY || '',
    revenueCatAndroidKey: process.env.REVENUECAT_ANDROID_KEY || '',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '6834aeb3-58dd-4d9d-a3a3-19824beb9e62',
    },
  },
});
