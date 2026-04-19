import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer, LinkingOptions, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
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
      // Small delay to let the main screen render first
      const timer = setTimeout(() => {
        triggerPrePermission();
      }, 1200);
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

  // Show loading while checking auth or consent
  if (isLoading || (isAuthenticated && isCheckingConsent)) {
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
