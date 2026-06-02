// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(),
}));

// Mock @react-native-google-signin/google-signin
// 네이티브 TurboModule(RNGoogleSignin)이 jest 환경엔 없어 import만으로
// "Invariant Violation: RNGoogleSignin could not be found"가 발생한다.
// 사용 메서드(configure/hasPlayServices/signIn/signOut)만 mock한다.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ data: { idToken: null } })),
    signOut: jest.fn(() => Promise.resolve()),
  },
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  init: jest.fn(),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'ko' }]),
}));

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const MockIcon = 'Icon';
  return {
    MaterialCommunityIcons: MockIcon,
    Ionicons: MockIcon,
    FontAwesome: MockIcon,
    FontAwesome5: MockIcon,
    MaterialIcons: MockIcon,
    Feather: MockIcon,
    AntDesign: MockIcon,
    Entypo: MockIcon,
  };
});
