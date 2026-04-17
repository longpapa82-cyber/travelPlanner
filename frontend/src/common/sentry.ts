import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export function initSentry() {
  const dsn = Constants.expoConfig?.extra?.sentryDsn;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
    attachScreenshot: !__DEV__,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 5,
    debug: false,
  });
}
