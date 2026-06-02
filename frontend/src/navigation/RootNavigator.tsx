import React, { useState, useEffect, useRef } from 'react';
import {
  NavigationContainer,
  LinkingOptions,
  DefaultTheme,
  DarkTheme,
  NavigationState,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useConsent } from '../contexts/ConsentContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '../components/OfflineBanner';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Module-level ref so login handlers in AuthContext can navigate to Home
// after the NavigationContainer mounts with a potentially-stale initialState.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
  // SharedTrip must never be persisted — it is a transient deep-link entry
  // point. Restoring it after a cold-start or login would land the user on
  // a potentially-expired share token instead of Home.
  const filteredRoutes = state.routes.filter((r) => r.name !== 'SharedTrip');
  if (filteredRoutes.length === 0) return undefined;
  return {
    ...state,
    routes: filteredRoutes.map((route) => {
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

// V189 P0-D: getInitialURL consumed flag (module-level = survives remounts).
// Problem: NavigationContainer unmounts/remounts during login (isCheckingConsent
// briefly true) → React Navigation's useLinking calls getInitialURL again on
// every remount → iOS returns the original share URL for the entire app process
// lifetime → SharedTrip appears instead of Home after re-login.
// Fix: consume the URL exactly once; every subsequent remount gets null.
let _initialURLConsumed = false;

// Eagerly capture the initial URL once at module load time.
// Must be done before any async gates (AsyncStorage, AuthContext) run.
const _coldStartURLPromise: Promise<string | null> =
  Platform.OS !== 'web'
    ? Linking.getInitialURL().catch(() => null)
    : Promise.resolve(null);

// Resolved value of _coldStartURLPromise — set synchronously once the promise
// settles so the nav-state loading effect can read it without await.
let _coldStartURL: string | null = null;
_coldStartURLPromise.then((url) => { _coldStartURL = url; });

// nav-state ready gate: signals getInitialURL that AsyncStorage restore is done.
let _navStateReadyResolver: (() => void) | null = null;
const _navStateReadyPromise = new Promise<void>((resolve) => {
  _navStateReadyResolver = resolve;
});

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'travelplanner://',
    'https://mytravel-planner.com',
  ],
  getInitialURL: async () => {
    if (_initialURLConsumed) return null;
    _initialURLConsumed = true;
    // No need to await nav-state ready: when _coldStartURL is set the useEffect
    // already clears initialState (undefined), so the URL is the sole source of
    // truth for the initial route. Returning immediately avoids a 3-second delay
    // where the URL could be dropped if NavigationContainer mounts first.
    return _coldStartURLPromise;
  },
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
      // Wait for _coldStartURLPromise to settle first so _coldStartURL is set.
      await _coldStartURLPromise;
      const restored = await loadPersistedNavState();
      if (cancelled) return;
      // If there is a cold-start deep link URL, do NOT restore nav state.
      // React Navigation: when initialState is non-undefined AND getInitialURL
      // returns a URL, initialState wins and the deep link is silently ignored.
      // Clearing initialState here ensures the deep link navigates correctly.
      setInitialNavState(_coldStartURL ? undefined : restored);
      setIsNavStateReady(true);
      // Signal getInitialURL that nav state is ready so cold-start deep links
      // are not dropped before NavigationContainer mounts.
      _navStateReadyResolver?.();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear persisted nav state when user identity changes so a different
  // account never inherits the previous session's navigation stack
  // (e.g. admin ErrorLog screen visible to a non-admin user).
  // On login (null → userId), navigate to Home via the live ref because
  // setInitialNavState(undefined) has no effect on an already-mounted
  // NavigationContainer — initialState is a mount-time-only prop.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prevId = prevUserIdRef.current;
    const currentId = user?.id ?? null;
    if (prevId !== undefined && prevId !== currentId) {
      AsyncStorage.removeItem(NAV_STATE_KEY).catch(() => {});
      if (prevId === null && currentId !== null) {
        // Login transition: reset the entire navigation stack to Home so that
        // any deep-link screen (e.g. SharedTrip) that was open before login is
        // fully removed. Using navigate() would push Home on top of SharedTrip,
        // leaving it reachable via the back gesture — reset() wipes the stack.
        setInitialNavState(undefined);
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        }
      }
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

  // Cold-start deep link is handled entirely by linking.getInitialURL above.
  // React Navigation parses the URL and sets the initial route automatically.
  // No manual navigate() calls needed for the cold-start case.

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

  // Show loading while checking auth, consent, or restoring nav state.
  // V189 P0-C: isNavStateReady gates the NavigationContainer so we never
  // mount with no initialState and then jump to the restored route — the
  // jump would look like a flash to the user.
  if (isLoading || (isAuthenticated && isCheckingConsent) || !isNavStateReady) {
    // White background + spinner: matches the App.tsx !appReady loading screen
    // so the transition is seamless (white→white→app, no blue flash).
    // edgeToEdge inset race is not an issue here since this View has no
    // absolutely-positioned elements that depend on inset values.
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
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

  // OfflineBanner is placed here (after all loading gates) so it never
  // shifts the splash/loading icon position during app startup.
  // Web uses the window online/offline events and doesn't need native banner.
  const offlineBanner = Platform.OS !== 'web' ? <OfflineBanner /> : null;

  // Wrap entire app in GestureHandlerRootView for proper gesture handling
  // This should be the only GestureHandlerRootView in the app
  const NavigationContent = (
    <NavigationContainer
      ref={navigationRef}
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
        <Stack.Screen name="SharedTrip" component={SharedTripViewScreen} options={{ headerShown: false }} />
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

    </NavigationContainer>
  );

  // On web, don't use GestureHandlerRootView as it can interfere with scroll
  if (Platform.OS === 'web') {
    return NavigationContent;
  }

  // On native platforms, wrap with GestureHandlerRootView for proper gesture handling
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {offlineBanner}
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
