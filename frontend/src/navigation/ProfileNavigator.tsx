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
import HelpScreen from '../screens/main/HelpScreen';
import TermsScreen from '../screens/main/TermsScreen';
import PrivacyPolicyScreen from '../screens/main/PrivacyPolicyScreen';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation('profile');
  const { t: tAdmin } = useTranslation('admin');
  const { t: tLegal } = useTranslation('legal');

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: colors.neutral[0],
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: t('title') }}
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
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
