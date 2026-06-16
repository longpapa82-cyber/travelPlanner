import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProfileStackParamList } from '../types';
import ProfileScreen from '../screens/main/ProfileScreen';
import TwoFactorSettingsScreen from '../screens/main/TwoFactorSettingsScreen';
import RevenueDashboardScreen from '../screens/main/RevenueDashboardScreen';
import AdminDashboardScreen from '../screens/main/AdminDashboardScreen';
import UserManagementScreen from '../screens/main/UserManagementScreen';
import ErrorLogScreen from '../screens/main/ErrorLogScreen';
import AnnouncementManagementScreen from '../screens/main/AnnouncementManagementScreen';
import AnnouncementFormScreen from '../screens/main/AnnouncementFormScreen';
import ApiUsageDashboardScreen from '../screens/main/ApiUsageDashboardScreen';
import AdDebugScreen from '../screens/debug/AdDebugScreen';
import HelpScreen from '../screens/main/HelpScreen';
import TermsScreen from '../screens/main/TermsScreen';
import PrivacyPolicyScreen from '../screens/main/PrivacyPolicyScreen';
import LicensesScreen from '../screens/main/LicensesScreen';
import UserProfileScreen from '../screens/main/UserProfileScreen';
import SubscriptionScreen from '../screens/main/SubscriptionScreen';
import { useTheme } from '../contexts/ThemeContext';
import { makeStackScreenOptions } from './sharedHeaderOptions';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation('profile');
  const { t: tPremium } = useTranslation('premium');
  const { t: tAdmin } = useTranslation('admin');
  const { t: tLegal } = useTranslation('legal');
  const { t: tSocial } = useTranslation('social');

  return (
    <Stack.Navigator
      screenOptions={{
        ...makeStackScreenOptions(theme.colors.primary),
        // DIAGNOSTIC: temporarily paint the scene content area red to confirm
        // whether the grey gap below admin ScrollViews is the native-stack
        // contentStyle background. Revert to theme bg / white once confirmed.
        contentStyle: { backgroundColor: 'red' },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TwoFactorSettings"
        component={TwoFactorSettingsScreen}
        options={{ title: t('menu.twoFactor') }}
      />
      <Stack.Screen
        name="RevenueDashboard"
        component={RevenueDashboardScreen}
        options={{ title: t('menu.revenue') }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: tPremium('menu.subscription') }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: tAdmin('title') }}
      />
      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
        options={{ title: tAdmin('menu.users') }}
      />
      <Stack.Screen
        name="ErrorLog"
        component={ErrorLogScreen}
        options={{ title: tAdmin('menu.errorLogs') }}
      />
      <Stack.Screen
        name="AnnouncementManagement"
        component={AnnouncementManagementScreen}
        options={{ title: tAdmin('menu.announcements') }}
      />
      <Stack.Screen
        name="ApiUsageDashboard"
        component={ApiUsageDashboardScreen}
        options={{ title: tAdmin('menu.apiUsage') }}
      />
      <Stack.Screen
        name="AnnouncementForm"
        component={AnnouncementFormScreen}
        options={({ route }) => ({
          title: (route.params as any)?.announcementId
            ? tAdmin('announcements.editTitle')
            : tAdmin('announcements.createTitle'),
        })}
      />
      <Stack.Screen
        name="AdDebug"
        component={AdDebugScreen}
        options={{ title: 'Ad Debug' }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: tLegal('help.title') }}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{ title: tLegal('terms.title') }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: tLegal('privacy.title') }}
      />
      <Stack.Screen
        name="Licenses"
        component={LicensesScreen}
        options={{ title: tLegal('licenses.title') }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: tSocial('profile.publicTrips') }}
      />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
