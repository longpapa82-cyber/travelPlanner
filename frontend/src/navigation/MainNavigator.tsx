import React, { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { notificationEvents } from '../utils/notificationEvents';
import { useNotifications } from '../contexts/NotificationContext';

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
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigation = useNavigation<any>();
  const { lastNotificationResponse } = useNotifications();

  const fetchUnread = useCallback(async () => {
    try {
      const data = await apiService.getUnreadNotificationCount();
      setUnreadCount(data.count);
    } catch {
      // silent
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnread();
      const interval = setInterval(fetchUnread, 60000);
      return () => clearInterval(interval);
    }, [fetchUnread]),
  );

  // Listen for notification count updates
  useEffect(() => {
    const unsubscribe = notificationEvents.onCountUpdate(() => {
      fetchUnread();
    });
    return unsubscribe;
  }, [fetchUnread]);

  // Handle notification tap to navigate
  useEffect(() => {
    if (!lastNotificationResponse) return;

    const data = lastNotificationResponse.notification.request.content.data;
    console.log('[MainNavigator] Handling notification response:', data);

    // Small delay to ensure navigation is ready
    setTimeout(() => {
      // Handle trip invitations or trip-related notifications
      if (data?.tripId) {
        console.log('[MainNavigator] Navigating to trip:', data.tripId);
        // Navigate to the Trips tab, then to TripDetail
        navigation.navigate('Trips', {
          screen: 'TripDetail',
          params: { tripId: data.tripId },
          initial: false,
        });
      } else if (data?.type === 'invitation' || data?.type === 'COLLABORATOR_INVITE') {
        // Handle invitation notifications - if we have a tripId, go directly to the trip
        if (data?.tripId) {
          console.log('[MainNavigator] Invitation with tripId, navigating to trip:', data.tripId);
          navigation.navigate('Trips', {
            screen: 'TripDetail',
            params: { tripId: data.tripId },
            initial: false,
          });
        } else {
          // Otherwise go to notifications screen
          console.log('[MainNavigator] Invitation without tripId, going to notifications');
          navigation.navigate('Notifications');
        }
      } else if (data?.type === 'daily' || data?.type === 'dayBefore' || data?.type === 'tripStart') {
        // Handle trip reminder notifications
        if (data?.tripId) {
          console.log('[MainNavigator] Trip reminder, navigating to trip:', data.tripId);
          navigation.navigate('Trips', {
            screen: 'TripDetail',
            params: { tripId: data.tripId },
            initial: false,
          });
        }
      }
    }, 100);
  }, [lastNotificationResponse, navigation]);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? darkColors.background.secondary : colors.neutral[0],
          borderTopWidth: 1,
          borderTopColor: isDark ? darkColors.border.light : colors.neutral[200],
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 5) : 5,
          height: 60 + (Platform.OS === 'android' ? Math.max(insets.bottom, 0) : 0),
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
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Trips', { screen: 'TripList' });
          },
        })}
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
