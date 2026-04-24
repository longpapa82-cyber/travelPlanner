import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

/** Threshold in ms — API calls slower than this get a Sentry breadcrumb */
const SLOW_API_THRESHOLD_MS = 10_000;

let _sentryInitialized = false;

export function isSentryInitialized(): boolean {
  return _sentryInitialized;
}

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
    enableNativeCrashHandling: true,
    enableCaptureFailedRequests: true,
    maxBreadcrumbs: 100,
    debug: false,
  });

  _sentryInitialized = true;

  // Capture memory warnings on native platforms
  if (Platform.OS !== 'web') {
    AppState.addEventListener('memoryWarning', () => {
      Sentry.captureMessage('OS Memory Warning received', 'warning');
      Sentry.addBreadcrumb({
        category: 'device',
        message: 'Memory warning from OS',
        level: 'warning',
      });
    });
  }
}

/**
 * V169 (F5): Generic breadcrumb helper for subscription state transitions.
 * No-ops when Sentry is not initialized so we can sprinkle call sites
 * without guarding at every invocation.
 */
export function addBreadcrumb(args: {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  if (!_sentryInitialized) return;
  Sentry.addBreadcrumb({
    category: args.category,
    message: args.message,
    level: args.level || 'info',
    data: args.data,
  });
}

/**
 * Record a Sentry breadcrumb when an API call exceeds SLOW_API_THRESHOLD_MS.
 * Call this from the API service response interceptor.
 */
export function recordSlowApiCall(
  url: string,
  method: string,
  durationMs: number,
  statusCode?: number,
): void {
  if (!_sentryInitialized) return;
  if (durationMs < SLOW_API_THRESHOLD_MS) return;

  Sentry.addBreadcrumb({
    category: 'http.slow',
    message: `Slow API: ${method.toUpperCase()} ${url} took ${durationMs}ms`,
    level: 'warning',
    data: {
      url,
      method,
      durationMs,
      statusCode,
    },
  });
}
