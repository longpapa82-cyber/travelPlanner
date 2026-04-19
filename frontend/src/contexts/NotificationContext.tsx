import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { type EventSubscription } from 'expo-modules-core';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types';
import i18next from 'i18next';
import apiService from '../services/api';
import { setPushRegistrationCallback } from './AuthContext';
import { useConsent } from './ConsentContext';
import PrePermissionNotificationModal from '../components/PrePermissionNotificationModal';

const NOTIFICATION_PREPERM_KEY = '@travelplanner:notification_preperm_shown';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

interface NotificationContextValue {
  scheduleTripReminders: (trip: Trip) => Promise<void>;
  cancelTripReminders: (tripId: string) => Promise<void>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  registerForPushNotifications: () => Promise<string | null>;
  unregisterPushToken: () => Promise<void>;
  expoPushToken: string | null;
  lastNotificationResponse: Notifications.NotificationResponse | null;
  showPrePermissionModal: boolean;
  onPrePermissionDismiss: () => void;
  triggerPrePermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  scheduleTripReminders: async () => {},
  cancelTripReminders: async () => {},
  hasPermission: false,
  requestPermission: async () => false,
  registerForPushNotifications: async () => null,
  unregisterPushToken: async () => {},
  expoPushToken: null,
  lastNotificationResponse: null,
  showPrePermissionModal: false,
  onPrePermissionDismiss: () => {},
  triggerPrePermission: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

const NOTIFICATION_LABELS: Record<string, Record<string, string>> = {
  ko: {
    dayBefore: '내일 출발!',
    dayBeforeBody: '{{destination}} 여행이 내일 시작됩니다. 짐 다 챙기셨나요?',
    tripStart: '여행 시작!',
    tripStartBody: '{{destination}} 여행이 오늘 시작됩니다. 즐거운 여행 되세요!',
    morningReminder: '오늘의 일정',
    morningReminderBody: '{{destination}} Day {{day}} - 오늘의 일정을 확인해보세요!',
  },
  en: {
    dayBefore: 'Departing tomorrow!',
    dayBeforeBody: 'Your trip to {{destination}} starts tomorrow. Are you all packed?',
    tripStart: 'Trip starts today!',
    tripStartBody: 'Your trip to {{destination}} begins today. Have a great journey!',
    morningReminder: "Today's itinerary",
    morningReminderBody: '{{destination}} Day {{day}} - Check out your activities for today!',
  },
  ja: {
    dayBefore: '明日出発!',
    dayBeforeBody: '{{destination}}旅行が明日始まります。荷物の準備はできましたか?',
    tripStart: '旅行開始!',
    tripStartBody: '{{destination}}旅行が今日始まります。楽しい旅を!',
    morningReminder: '今日の予定',
    morningReminderBody: '{{destination}} Day {{day}} - 今日のアクティビティを確認しましょう!',
  },
};

function getLabel(key: string, vars?: Record<string, string | number>): string {
  const lang = i18next.language?.substring(0, 2) || 'ko';
  const labels = NOTIFICATION_LABELS[lang] || NOTIFICATION_LABELS.ko;
  let text = labels[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, String(v));
    }
  }
  return text;
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { needsConsentScreen, isCheckingConsent } = useConsent();
  const [hasPermission, setHasPermission] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotificationResponse, setLastNotificationResponse] =
    useState<Notifications.NotificationResponse | null>(null);
  const [showPrePermissionModal, setShowPrePermissionModal] = useState(false);
  const [pendingPrePermission, setPendingPrePermission] = useState(false);
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);

  useEffect(() => {
    checkPermission();

    if (Platform.OS !== 'web') {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        // notification received while app is open — no-op for now
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        setLastNotificationResponse(response);
      });
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'web') {
      const perm = typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false;
      setHasPermission(perm);
      return;
    }
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const requestPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      if (typeof Notification === 'undefined') return false;
      const result = await Notification.requestPermission();
      const granted = result === 'granted';
      setHasPermission(granted);
      return granted;
    }
    if (!Device.isDevice) return false;
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    return granted;
  };

  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'web') return null;
    if (!Device.isDevice) return null;

    let perm = hasPermission;
    if (!perm) {
      perm = await requestPermission();
      if (!perm) return null;
    }

    try {
      // Android needs notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'MyTravel',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Uses EAS projectId from app.config.js extra
      });
      const token = tokenData.data;

      // Register with backend
      await apiService.registerPushToken(token);
      setExpoPushToken(token);
      return token;
    } catch (error) {
      return null;
    }
  }, [hasPermission]);

  const unregisterPushToken = useCallback(async () => {
    try {
      await apiService.removePushToken();
      setExpoPushToken(null);
    } catch (error) {
      // Silent fail — best-effort removal
    }
  }, []);

  const onPrePermissionDismiss = useCallback(() => {
    setShowPrePermissionModal(false);
  }, []);

  /**
   * Direct trigger for the pre-permission notification modal.
   *
   * V141 fix: The pushRegistrationCallback bridge has a race condition —
   * AuthContext.checkAuthStatus() calls registerPushAfterLogin() during
   * mount before NotificationProvider's useEffect registers the callback.
   * This function provides a reliable, direct path that callers (e.g.
   * ConsentScreen onComplete, or RootNavigator after consent dismissal)
   * can invoke when the user has finished all blocking flows.
   */
  const triggerPrePermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      await registerForPushNotifications();
      return;
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await registerForPushNotifications();
      return;
    }
    if (status === 'undetermined') {
      setShowPrePermissionModal(true);
      return;
    }
    const shown = await AsyncStorage.getItem(NOTIFICATION_PREPERM_KEY);
    if (shown === 'true') return;
    setShowPrePermissionModal(true);
  }, [registerForPushNotifications]);

  // Bridge: AuthContext calls this after successful login
  // Instead of auto-requesting, show pre-permission modal (once)
  // Always defer to pendingPrePermission — the useEffect below will
  // show the modal after consent check completes.
  useEffect(() => {
    setPushRegistrationCallback(async () => {
      if (Platform.OS === 'web') {
        registerForPushNotifications();
        return;
      }
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        registerForPushNotifications();
        return;
      }
      const shown = await AsyncStorage.getItem(NOTIFICATION_PREPERM_KEY);
      if (shown === 'true') return;
      // Always set pending — the useEffect below will wait for
      // consent check to finish before showing the modal.
      setPendingPrePermission(true);
    });
    return () => {
      setPushRegistrationCallback(null);
    };
  }, [registerForPushNotifications]);

  // Show pending notification modal after consent check completes
  // and ConsentScreen is either not needed or already dismissed.
  // Wait for isCheckingConsent=false to avoid the race where
  // needsConsentScreen is still false because the check hasn't finished.
  useEffect(() => {
    if (pendingPrePermission && !isCheckingConsent && !needsConsentScreen) {
      const timer = setTimeout(() => {
        setPendingPrePermission(false);
        setShowPrePermissionModal(true);
      }, 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [pendingPrePermission, isCheckingConsent, needsConsentScreen]);

  const scheduleTripReminders = async (trip: Trip) => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    // Cancel existing reminders for this trip first
    await cancelTripReminders(trip.id);

    const startDate = new Date(trip.startDate);
    const now = new Date();

    // 1. Day-before reminder (9 AM, day before trip)
    const dayBefore = new Date(startDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(9, 0, 0, 0);

    if (dayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: getLabel('dayBefore'),
          body: getLabel('dayBeforeBody', { destination: trip.destination }),
          data: { tripId: trip.id, type: 'dayBefore' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
        identifier: `trip-${trip.id}-dayBefore`,
      });
    }

    // 2. Trip start morning reminder (8 AM on start day)
    const tripMorning = new Date(startDate);
    tripMorning.setHours(8, 0, 0, 0);

    if (tripMorning > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: getLabel('tripStart'),
          body: getLabel('tripStartBody', { destination: trip.destination }),
          data: { tripId: trip.id, type: 'tripStart' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tripMorning },
        identifier: `trip-${trip.id}-start`,
      });
    }

    // 3. Daily morning reminders for each day of the trip (8 AM)
    const endDate = new Date(trip.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let day = 2; day <= Math.min(totalDays, 14); day++) {
      const reminderDate = new Date(startDate);
      reminderDate.setDate(reminderDate.getDate() + day - 1);
      reminderDate.setHours(8, 0, 0, 0);

      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: getLabel('morningReminder'),
            body: getLabel('morningReminderBody', { destination: trip.destination, day }),
            data: { tripId: trip.id, type: 'daily', day },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
          identifier: `trip-${trip.id}-day${day}`,
        });
      }
    }
  };

  const cancelTripReminders = async (tripId: string) => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.identifier.startsWith(`trip-${tripId}-`)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        scheduleTripReminders,
        cancelTripReminders,
        hasPermission,
        requestPermission,
        registerForPushNotifications,
        unregisterPushToken,
        expoPushToken,
        lastNotificationResponse,
        showPrePermissionModal,
        onPrePermissionDismiss,
        triggerPrePermission,
      }}
    >
      {children}
      <PrePermissionNotificationModal
        visible={showPrePermissionModal}
        onRequestPermission={async () => {
          const granted = await requestPermission();
          if (granted) await registerForPushNotifications();
          return granted;
        }}
        onDismiss={onPrePermissionDismiss}
      />
    </NotificationContext.Provider>
  );
};
