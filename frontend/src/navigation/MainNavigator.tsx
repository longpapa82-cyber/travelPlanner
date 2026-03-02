import React, { useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MainTabParamList } from '../types';
import HomeScreen from '../screens/main/HomeScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import TripsNavigator from './TripsNavigator';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ProfileNavigator from './ProfileNavigator';
import ErrorBoundary from '../components/ErrorBoundary';
import AnnouncementBellIcon from '../components/AnnouncementBellIcon';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { colors, darkColors } from '../constants/theme';
import apiService from '../services/api';

/** Wrap a screen component with ErrorBoundary so crashes are isolated per-tab */
const withErrorBoundary = <P extends object>(Component: React.ComponentType<P>) => {
  const Wrapped = (props: P) => (
    <ErrorBoundary>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `WithErrorBoundary(${Component.displayName || Component.name})`;
  return Wrapped;
};

const SafeHomeScreen = withErrorBoundary(HomeScreen);
const SafeDiscoverScreen = withErrorBoundary(DiscoverScreen);
const SafeTripsNavigator = withErrorBoundary(TripsNavigator);
const SafeNotificationsScreen = withErrorBoundary(NotificationsScreen);
const SafeProfileNavigator = withErrorBoundary(ProfileNavigator);

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator = () => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('common');
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchUnread = async () => {
        try {
          const data = await apiService.getUnreadNotificationCount();
          setUnreadCount(data.count);
        } catch {
          // silent
        }
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 60000);
      return () => clearInterval(interval);
    }, []),
  );

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
        component={SafeHomeScreen}
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
          headerRight: () => <AnnouncementBellIcon />,
        }}
      />
      <Tab.Screen
        name="Discover"
        component={SafeDiscoverScreen}
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Trips"
        component={SafeTripsNavigator}
        options={{
          title: t('tabs.trips'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon name="bag-suitcase" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={SafeNotificationsScreen}
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="bell-outline" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        }}
        listeners={{
          focus: () => {
            // Refresh badge when navigating to notifications
            apiService.getUnreadNotificationCount()
              .then(data => setUnreadCount(data.count))
              .catch(() => {});
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={SafeProfileNavigator}
        options={{
          title: t('tabs.profile'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
