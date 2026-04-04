import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { NavigationContainer, LinkingOptions, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTrackingTransparency } from '../hooks/useTrackingTransparency';
import { RootStackParamList } from '../types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import SharedTripViewScreen from '../screens/trips/SharedTripViewScreen';
import AnnouncementListScreen from '../screens/main/AnnouncementListScreen';
import AnnouncementDetailScreen from '../screens/main/AnnouncementDetailScreen';
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
      VerifyEmail: 'verify-email',
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
          ResetPassword: 'reset-password',
        },
      },
    },
  },
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const { shouldShowPrePermission, sessionCount, requestTracking } = useTrackingTransparency();

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

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
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
