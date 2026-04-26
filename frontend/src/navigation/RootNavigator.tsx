import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  NavigationContainer,
  LinkingOptions,
  DefaultTheme,
  DarkTheme,
  NavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useConsent } from '../contexts/ConsentContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTrackingTransparency } from '../hooks/useTrackingTransparency';
import { RootStackParamList } from '../types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import SharedTripViewScreen from '../screens/trips/SharedTripViewScreen';
import AnnouncementListScreen from '../screens/main/AnnouncementListScreen';
import AnnouncementDetailScreen from '../screens/main/AnnouncementDetailScreen';
import ConsentScreen from '../screens/consent/ConsentScreen';
import EmailVerificationCodeScreen from '../screens/auth/EmailVerificationCodeScreen';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import PrePermissionATTModal, { shouldShowATTPrePermission } from '../components/PrePermissionATTModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * V189 P0-C (5차 chronic regression — V184 A4 → V185 → V186 #5 → V187 P0-F):
 * NavigationContainer state persistence.
 *
 * The 4 prior fixes (silentRefresh timeout, useFocusEffect guard,
 * cross-context lock, setUser shallow compare) all guarded JS-layer
 * race conditions. They could not address the actual cause: when
 * Android LMK kills the host process during background and the user
 * returns, React Native cold-starts and NavigationContainer mounts
 * fresh — the stack history is gone forever, so the user lands on
 * the initial route (home) regardless of where they were.
 *
 * Persist the navigation state to AsyncStorage with a 60-minute TTL
 * so a cold-start within an hour restores the prior screen. Beyond
 * 60 minutes, drop the state — too long and stale params (e.g. a
 * deleted trip id) cause confusing 404s.
 *
 * Route param whitelist: we strip everything except the route name
 * and a small allowlist of stable params (tripId, shareToken,
 * announcementId). Sensitive params (auth tokens, password reset
 * tokens, OAuth state) MUST never land in AsyncStorage.
 */
const NAV_STATE_KEY = '__navigation_state_v1';
const NAV_STATE_TTL_MS = 60 * 60 * 1000;
const SAFE_PARAM_KEYS = new Set(['tripId', 'shareToken', 'announcementId']);

const sanitizeNavState = (state: NavigationState | undefined): unknown => {
  if (!state) return undefined;
  return {
    ...state,
    routes: state.routes.map((route) => {
      const params = route.params as Record<string, unknown> | undefined;
      const safeParams = params
        ? Object.fromEntries(
            Object.entries(params).filter(([k]) => SAFE_PARAM_KEYS.has(k)),
          )
        : undefined;
      const child = (route as { state?: NavigationState }).state;
      return {
        ...route,
        params: safeParams && Object.keys(safeParams).length > 0 ? safeParams : undefined,
        state: child ? sanitizeNavState(child) : undefined,
      };
    }),
  };
};

const persistNavState = async (state: NavigationState | undefined): Promise<void> => {
  try {
    if (!state) {
      await AsyncStorage.removeItem(NAV_STATE_KEY);
      return;
    }
    await AsyncStorage.setItem(
      NAV_STATE_KEY,
      JSON.stringify({ savedAt: Date.now(), state: sanitizeNavState(state) }),
    );
  } catch {
    // Storage failure must not crash navigation.
  }
};

const loadPersistedNavState = async (): Promise<unknown | undefined> => {
  try {
    const raw = await AsyncStorage.getItem(NAV_STATE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > NAV_STATE_TTL_MS) {
      await AsyncStorage.removeItem(NAV_STATE_KEY);
      return undefined;
    }
    return parsed.state;
  } catch {
    return undefined;
  }
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'travelplanner://',
    'https://mytravel-planner.com',
  ],
  config: {
    screens: {
      SharedTrip: {
        path: 'share/:shareToken',
      },
      AnnouncementDetail: {
        path: 'announcements/:announcementId',
      },
      AnnouncementList: 'announcements',
      // V115 (V114-1 fix): App Links path. Backend V115 emits /app/verify
      // as the email verification link. Legacy /verify-email emails may
      // still be in user inboxes during the rollout but the email template
      // change is safe — old URLs simply 404 and the user can request a
      // new verification code from inside the app.
      VerifyEmail: 'app/verify',
      Main: {
        screens: {
          Home: 'home',
          Trips: {
            screens: {
              TripList: 'trips',
              TripDetail: 'trips/:tripId',
              CreateTrip: 'trips/create',
              EditTrip: 'trips/:tripId/edit',
            },
          },
          Profile: 'profile',
        },
      },
      Auth: {
        screens: {
          Login: 'login',
          Onboarding: 'onboarding',
          ForgotPassword: 'forgot-password',
          // V115 (V114-1 fix): App Links path. See note on VerifyEmail above.
          ResetPassword: 'app/reset',
        },
      },
    },
  },
};

const RootNavigator = () => {
  const {
    isAuthenticated,
    isLoading,
    user,
    refreshUser,
    logout,
    pendingVerification,
    clearPendingVerification,
  } = useAuth();
  const { needsConsentScreen, isCheckingConsent, markConsentComplete } = useConsent();
  const { triggerPrePermission } = useNotifications();
  const { theme, isDark } = useTheme();
  const { shouldShowPrePermission, sessionCount, requestTracking } = useTrackingTransparency();

  // V189 P0-C: load persisted nav state on cold-start so users return to
  // the screen they were on before Android LMK killed the process.
  // `isStateReady` blocks NavigationContainer mount until we know
  // whether to use a restored state or start fresh — otherwise the
  // container mounts at home, then jumps to the restored route, which
  // looks like a flash.
  const [initialNavState, setInitialNavState] = useState<unknown | undefined>(undefined);
  const [isNavStateReady, setIsNavStateReady] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web persistence is handled by the URL itself; skip AsyncStorage.
      setIsNavStateReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const restored = await loadPersistedNavState();
      if (cancelled) return;
      setInitialNavState(restored);
      setIsNavStateReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // V141 fix: When the user is authenticated and doesn't need consent,
  // the pushRegistrationCallback bridge may have been missed (race condition
  // during mount). Trigger pre-permission directly once the user lands on
  // the main screen. The triggerPrePermission function is idempotent —
  // it checks permission status and AsyncStorage before showing the modal.
  const hasTriggeredPrePermRef = useRef(false);
  useEffect(() => {
    if (
      isAuthenticated &&
      !isLoading &&
      !isCheckingConsent &&
      !needsConsentScreen &&
      !pendingVerification &&
      !hasTriggeredPrePermRef.current
    ) {
      hasTriggeredPrePermRef.current = true;
      const timer = setTimeout(() => {
        triggerPrePermission();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAuthenticated, isLoading, isCheckingConsent, needsConsentScreen, pendingVerification, triggerPrePermission]);

  // ATT pre-permission modal state
  const [showATTModal, setShowATTModal] = useState(false);

  useEffect(() => {
    if (!shouldShowPrePermission) return;
    shouldShowATTPrePermission(sessionCount).then((show) => {
      if (show) setShowATTModal(true);
    });
  }, [shouldShowPrePermission, sessionCount]);

  const handleATTDismiss = useCallback(() => {
    setShowATTModal(false);
  }, []);

  // Show loading while checking auth, consent, or restoring nav state.
  // V189 P0-C: isNavStateReady gates the NavigationContainer so we never
  // mount with no initialState and then jump to the restored route — the
  // jump would look like a flash to the user.
  if (isLoading || (isAuthenticated && isCheckingConsent) || !isNavStateReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // V112 Wave 5: resume-token path — user registered or tried to log in
  // while unverified, backend gave us a scope-restricted resumeToken, and
  // we have no full session yet. Show the verification screen before
  // anything else.
  if (pendingVerification) {
    return (
      <EmailVerificationCodeScreen
        onVerified={refreshUser}
        onLogout={() => {
          clearPendingVerification();
          logout();
        }}
        userEmail={pendingVerification.user.email}
        resumeToken={pendingVerification.resumeToken}
      />
    );
  }

  // Legacy path: full session exists but email is not yet verified.
  // (Kept for backwards compatibility with staged rollouts; new V112
  // backend routes unverified users through pendingVerification above.)
  const needsEmailVerification =
    isAuthenticated &&
    user &&
    user.provider === 'email' &&
    user.isEmailVerified === false;

  if (needsEmailVerification) {
    return (
      <EmailVerificationCodeScreen
        onVerified={refreshUser}
        onLogout={logout}
        userEmail={user.email}
      />
    );
  }

  // Show ConsentScreen AFTER email verification is complete
  if (isAuthenticated && needsConsentScreen) {
    return <ConsentScreen onComplete={markConsentComplete} />;
  }

  // Wrap entire app in GestureHandlerRootView for proper gesture handling
  // This should be the only GestureHandlerRootView in the app
  const NavigationContent = (
    <NavigationContainer
      linking={linking}
      // V189 P0-C: cold-start restoration. initialState is set once on
      // mount; subsequent updates flow through onStateChange → AsyncStorage.
      initialState={initialNavState as Parameters<typeof NavigationContainer>[0]['initialState']}
      onStateChange={(state) => {
        // Fire-and-forget; AsyncStorage write is fast and non-critical.
        persistNavState(state);
      }}
      theme={{
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
          ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          primary: theme.colors.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="SharedTrip" component={SharedTripViewScreen} />
        <Stack.Screen
          name="AnnouncementList"
          component={AnnouncementListScreen}
          options={{ headerShown: true, title: '' }}
        />
        <Stack.Screen
          name="AnnouncementDetail"
          component={AnnouncementDetailScreen}
          options={{ headerShown: true, title: '' }}
        />
      </Stack.Navigator>

      <PrePermissionATTModal
        visible={showATTModal}
        sessionCount={sessionCount}
        onRequestTracking={requestTracking}
        onDismiss={handleATTDismiss}
      />
    </NavigationContainer>
  );

  // On web, don't use GestureHandlerRootView as it can interfere with scroll
  if (Platform.OS === 'web') {
    return NavigationContent;
  }

  // On native platforms, wrap with GestureHandlerRootView for proper gesture handling
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {NavigationContent}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RootNavigator;
