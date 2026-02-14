import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProfileStackParamList } from '../types';
import ProfileScreen from '../screens/main/ProfileScreen';
import TwoFactorSettingsScreen from '../screens/main/TwoFactorSettingsScreen';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation('profile');

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
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
