import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, AppStateStatus, Platform, View, Text, StyleSheet } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { ConsentProvider } from './src/contexts/ConsentContext';
import { PremiumProvider } from './src/contexts/PremiumContext';
import { ToastProvider } from './src/components/feedback/Toast/ToastContext';
import { ConfirmDialogProvider } from './src/components/feedback/ConfirmDialog';
import { NotificationProvider } from './src/contexts/NotificationContext';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

import { PWAInstallPrompt } from './src/components/PWAInstallPrompt';
import { initI18n } from './src/i18n';
import { offlineCache } from './src/services/offlineCache';
import { initWebVitals } from './src/common/web-vitals';
import { API_URL, STORAGE_KEYS } from './src/constants/config';
import { secureStorage } from './src/utils/storage';
import { useAppOpenAd } from './src/components/ads/useAppOpenAd';
import { initializeAds } from './src/utils/initAds';
import { logTestDeviceInfo } from './src/utils/testDeviceHelper';
import PaywallModal from './src/components/PaywallModal';
import { TutorialProvider } from './src/contexts/TutorialContext';
import WelcomeModal from './src/components/tutorial/WelcomeModal';
import GDPRConsentBanner from './src/components/GDPRConsentBanner';
import apiService from './src/services/api';
import WebAppRedirectScreen from './src/screens/web/WebAppRedirectScreen';

// Hold the splash screen visible until app is fully ready.
// Android: fade:false — immediate hide prevents the Android 12+ OS icon exit
// animation gap where the icon disappears while the background lingers.
// iOS: fade:true — smooth crossfade over the cached app snapshot on cold launch.
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  SplashScreen.setOptions({
    fade: Platform.OS !== 'android',
    duration: Platform.OS !== 'android' ? 500 : 0,
  });
}

initWebVitals();

// Global error handlers — report uncaught errors to admin error log
let _isReportingGlobal = false;
function reportGlobalError(errorMessage: string, stack?: string) {
  if (_isReportingGlobal) return;
  _isReportingGlobal = true;
  apiService.reportError({
    errorMessage,
    stackTrace: stack,
    screen: 'GlobalHandler',
    severity: 'error',
    deviceOS: Platform.OS,
    appVersion: Constants.expoConfig?.version,
  }).catch(() => {}).finally(() => { _isReportingGlobal = false; });
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const prevOnError = window.onerror;
  window.onerror = (_msg, _source, _line, _col, error) => {
    if (error) {
      reportGlobalError(
        `[Uncaught] ${error.name}: ${error.message}`,
        error.stack,
      );
    }
    if (typeof prevOnError === 'function') {
      return (prevOnError as Function).call(window, _msg, _source, _line, _col, error);
    }
    return false;
  };
  const prevOnRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error
      ? `${reason.name}: ${reason.message}`
      : String(reason);
    reportGlobalError(`[UnhandledRejection] ${msg}`, reason?.stack);
    if (typeof prevOnRejection === 'function') {
      prevOnRejection.call(window, event);
    }
  };
} else {
  // React Native global error handler
  const { ErrorUtils } = global as any;
  if (ErrorUtils) {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      reportGlobalError(
        `[${isFatal ? 'Fatal' : 'Uncaught'}] ${error.name}: ${error.message}`,
        error.stack,
      );
      originalHandler?.(error, isFatal);
    });
  }
}

// Register service worker for PWA (web only)
if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  // Listen for SW update notifications — reload to pick up new cached assets
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}

// React Query online manager: pause mutations when offline, resume when back online
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  onlineManager.setEventListener((setOnline) => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  });
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

/**
 * Web OAuth callback handler.
 * After Google/Apple/Kakao OAuth redirect lands at /auth/callback?code=xxx,
 * this component exchanges the temp code for JWT tokens and redirects to root.
 */
const WebOAuthCallbackHandler: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (!code) {
          setErrorMsg('인증 코드가 없습니다');
          setStatus('error');
          return;
        }

        // Exchange the temp code for JWT tokens
        const response = await fetch(`${API_URL}/auth/oauth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.error('OAuth exchange failed:', response.status, errBody);
          setErrorMsg(`서버 응답 오류 (${response.status})`);
          setStatus('error');
          return;
        }

        const json = await response.json();
        // Backend wraps responses in { data, meta } envelope — unwrap it
        const data = json.data ?? json;

        // Bridge tokens via sessionStorage to survive the page reload.
        // secureStorage uses in-memory Map on web (XSS protection),
        // which is cleared on navigation. sessionStorage persists across
        // same-tab reloads and is cleaned up by AuthContext on next load.
        sessionStorage.setItem('__oauth_access_token', data.accessToken);
        sessionStorage.setItem('__oauth_refresh_token', data.refreshToken);

        // Redirect to app root — AuthContext.checkAuthStatus picks up bridge tokens
        window.location.replace('/');
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setErrorMsg(err?.message || '네트워크 오류');
        setStatus('error');
      }
    }
    handleCallback();
  }, []);

  return (
    <View style={callbackStyles.container}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={callbackStyles.text}>로그인 중...</Text>
        </>
      ) : (
        <>
          <Text style={callbackStyles.errorText}>로그인에 실패했습니다</Text>
          {errorMsg ? <Text style={callbackStyles.detail}>{errorMsg}</Text> : null}
          <Text
            style={callbackStyles.link}
            onPress={() => window.location.replace('/')}
          >
            돌아가기
          </Text>
        </>
      )}
    </View>
  );
};

const callbackStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { marginTop: 16, fontSize: 16, color: '#64748B' },
  errorText: { fontSize: 16, color: '#EF4444', marginBottom: 8 },
  detail: { fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  link: { fontSize: 16, color: '#3B82F6', fontWeight: '600' },
});

const AppContent = () => {
  const { isDark } = useTheme();
  useAppOpenAd();

  // Android 시스템 네비게이션 바 색상을 탭 바와 동기화 (흰색/다크 배경)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const bgColor = isDark ? '#1E293B' : '#FFFFFF'; // darkColors.background.secondary / white
    const btnStyle = isDark ? 'light' : 'dark';
    NavigationBar.setBackgroundColorAsync(bgColor).catch(() => {});
    NavigationBar.setButtonStyleAsync(btnStyle).catch(() => {});
  }, [isDark]);

  return (
    <>
      <RootNavigator />
      <PWAInstallPrompt />
      <GDPRConsentBanner />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
};

// Check for OTA updates when app comes to foreground (native only).
// ON_LOAD covers cold starts; this covers warm resumes.
function useOTAUpdate() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // OTA failure is non-fatal — app continues with cached bundle
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);
}

function App() {
  const [appReady, setAppReady] = useState(false);
  const splashHiddenRef = useRef(false);
  useOTAUpdate();

  // On web, detect if we're at the OAuth callback URL.
  const isWebOAuthCallback =
    Platform.OS === 'web' && window.location.pathname === '/auth/callback';

  useEffect(() => {
    // Skip full app init if we're handling the OAuth callback (web only)
    if (isWebOAuthCallback) {
      setAppReady(true);
      return;
    }

    async function prepare() {
      // Log test device info for debugging (especially for Alpha testing)
      if (Platform.OS !== 'web') {
        await logTestDeviceInfo();
      }

      // initializeAds is intentionally excluded from the blocking Promise.all.
      // AdMob SDK initialization takes ~4 seconds on first install (no cache),
      // which delays the JS splash frame and causes a blank blue screen while
      // the native splash is fading out. Ads init runs in the background instead.
      initializeAds().catch(() => {});

      await Promise.all([
        initI18n(),
        offlineCache.clearExpired(),
        Font.loadAsync({
          'material-community': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
          'ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
          'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
          'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
        }),
      ]);
      // Defer setAppReady by two rAF ticks so all pending microtasks and
      // the first JS paint cycle complete before hideAsync is called.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAppReady(true);
        });
      });
    }
    prepare();
  }, [isWebOAuthCallback]);

  // Android: hide native splash at mount so onPreDraw unblocks while appReady=false.
  // The !appReady white+spinner screen is then the first JS frame shown to the user.
  // The !appReady screen does NOT use SafeAreaView insets so the inset race is not
  // an issue here. iOS uses null return so the system handles the fade natively.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleRootLayout = useCallback(() => {}, []);

  if (!appReady) {
    // iOS: SplashScreen fades the entire Window — no gap, keep null.
    if (Platform.OS !== 'android') return null;
    // Android: native splash is already dismissed at mount above.
    // Show white background + spinner while fonts/i18n finish loading.
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  // Android: hide native splash now that the full app is ready (if not already done).
  // This is a no-op for Android (already hidden at mount), but handles the iOS case
  // and any edge case where the above effect didn't run.
  if (Platform.OS !== 'web' && !splashHiddenRef.current) {
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }

  // Render lightweight callback handler instead of full app
  if (isWebOAuthCallback) {
    return <WebOAuthCallbackHandler />;
  }

  /*
   * V115 (V114-1 fix, CRITICAL):
   *
   * Expo web 빌드가 www.mytravel-planner.com에서 서빙되며 React Native Web을
   * 통해 로그인/가입/AI 생성 등 전체 앱 기능을 그대로 사용할 수 있던 것이
   * V112~V114 전체에서 반복된 "웹에서 서비스 이용 가능" CRITICAL 이슈였다.
   *
   * 정책은 "앱에서만 서비스 제공"이므로 웹 빌드는 "앱 다운로드 안내" 한 장으로
   * 전부 대체한다. nginx는 SEO 정적 페이지(/landing.html, /guides/*, /blog/*,
   * /privacy.html, /terms.html 등)를 index.html 이전에 매칭시키므로 이 가드가
   * 랜딩/가이드/약관 트래픽을 잡아먹지 않는다. OAuth 콜백(/auth/callback)은
   * 위 isWebOAuthCallback 분기에서 이미 처리됐다.
   *
   * 결과: 웹에서는 AuthProvider/RootNavigator가 아예 mount되지 않아
   * 토큰 저장·API 호출·로그인 자체가 불가능해진다.
   */
  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <WebAppRedirectScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider onLayout={handleRootLayout}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ConsentProvider>
                <PremiumProvider>
                  <NotificationProvider>
                    <TutorialProvider>
                      <ToastProvider>
                        <ConfirmDialogProvider>
                          <AppContent />
                          <PaywallModal />
                          <WelcomeModal />
                        </ConfirmDialogProvider>
                      </ToastProvider>
                    </TutorialProvider>
                  </NotificationProvider>
                </PremiumProvider>
              </ConsentProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default App;
