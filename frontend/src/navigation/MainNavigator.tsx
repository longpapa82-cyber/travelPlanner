import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { MainTabParamList } from '../types';
import HomeScreen from '../screens/main/HomeScreen';
import TripsNavigator from './TripsNavigator';
import ProfileScreen from '../screens/main/ProfileScreen';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { colors, darkColors } from '../constants/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator = () => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('common');

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? darkColors.background.secondary : colors.neutral[0],
          borderTopWidth: 1,
          borderTopColor: isDark ? darkColors.border.light : colors.neutral[200],
          paddingBottom: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: colors.neutral[0],
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Trips"
        component={TripsNavigator}
        options={{
          title: t('tabs.trips'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon name="bag-suitcase" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
