import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View, Text, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Font from 'expo-font';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/components/feedback/Toast/ToastContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { PWAInstallPrompt } from './src/components/PWAInstallPrompt';
import { initI18n } from './src/i18n';
import { offlineCache } from './src/services/offlineCache';
import { initSentry } from './src/common/sentry';
import { initWebVitals } from './src/common/web-vitals';
import { API_URL, STORAGE_KEYS } from './src/constants/config';
import { secureStorage } from './src/utils/storage';

// Initialize Sentry before app renders
initSentry();
initWebVitals();

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

        const data = await response.json();
        await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);

        // Redirect to app root — AuthProvider will pick up the stored token
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

  return (
    <>
      <OfflineBanner />
      <RootNavigator />
      <PWAInstallPrompt />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
};

function App() {
  const [appReady, setAppReady] = useState(false);

  // On web, detect if we're at the OAuth callback URL.
  const isWebOAuthCallback =
    Platform.OS === 'web' && window.location.pathname === '/auth/callback';

  useEffect(() => {
    // Skip full app init if we're handling the OAuth callback
    if (isWebOAuthCallback) {
      setAppReady(true);
      return;
    }

    async function prepare() {
      await Promise.all([
        initI18n(),
        offlineCache.clearExpired(),
        Font.loadAsync({
          'material-community': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
          'ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
          'MaterialCommunityIcons': require('react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
          'Ionicons': require('react-native-vector-icons/Fonts/Ionicons.ttf'),
        }),
      ]);
      setAppReady(true);
    }
    prepare();
  }, [isWebOAuthCallback]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Render lightweight callback handler instead of full app
  if (isWebOAuthCallback) {
    return <WebOAuthCallbackHandler />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <ToastProvider>
                <AppContent />
              </ToastProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(App);
