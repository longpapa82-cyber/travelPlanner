import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { AppNotification } from '../../types';
import apiService from '../../services/api';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { useConfirm } from '../../components/feedback/ConfirmDialog';

const NOTIFICATION_ICONS: Record<string, string> = {
  trip_started: 'airplane-takeoff',
  trip_completed: 'check-circle',
  trip_departure: 'calendar-clock',
  collaborator_invite: 'account-plus',
  collaborator_joined: 'account-check',
  trip_updated: 'pencil',
  activity_reminder: 'bell-ring',
  new_follower: 'account-plus',
  trip_liked: 'heart',
};

const NOTIFICATION_COLORS: Record<string, string> = {
  trip_started: colors.success.main,
  trip_completed: colors.neutral[500],
  trip_departure: colors.travel.ocean,
  collaborator_invite: colors.primary[500],
  collaborator_joined: colors.success.main,
  trip_updated: colors.warning.main,
  activity_reminder: colors.primary[500],
  new_follower: colors.primary[500],
  trip_liked: colors.error.main,
};

const NotificationsScreen = () => {
  const { t } = useTranslation('common');
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigation = useNavigation<any>();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    try {
      const data = await apiService.getNotifications(pageNum, 20);
      if (append) {
        setNotifications(prev => [...prev, ...data.notifications]);
      } else {
        setNotifications(data.notifications);
      }
      setTotal(data.total);
      setPage(pageNum);
    } catch {
      if (!append) {
        showToast({ type: 'error', message: t('notifications.fetchError'), position: 'top' });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [showToast, t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchNotifications(1);
    }, [fetchNotifications]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications(1);
  };

  const loadMore = () => {
    if (isLoadingMore || notifications.length >= total) return;
    setIsLoadingMore(true);
    fetchNotifications(page + 1, true);
  };

  const handleMarkAsRead = async (notification: AppNotification) => {
    if (notification.isRead) return;
    try {
      await apiService.markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n),
      );
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      showToast({ type: 'success', message: t('notifications.allMarkedRead'), position: 'top' });
    } catch {
      showToast({ type: 'error', message: t('notifications.error'), position: 'top' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => prev - 1);
    } catch {
      showToast({ type: 'error', message: t('notifications.error'), position: 'top' });
    }
  };

  const handleDeleteAll = async () => {
    const ok = await confirm({
      title: t('notifications.deleteAllTitle'),
      message: t('notifications.deleteAllConfirm'),
      confirmText: t('notifications.delete'),
      cancelText: t('notifications.cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiService.deleteAllNotifications();
      setNotifications([]);
      setTotal(0);
      showToast({ type: 'success', message: t('notifications.allDeleted'), position: 'top' });
    } catch {
      showToast({ type: 'error', message: t('notifications.error'), position: 'top' });
    }
  };

  const handleNotificationPress = (item: AppNotification) => {
    handleMarkAsRead(item);

    const tripTypes = [
      'collaborator_invite',
      'collaborator_joined',
      'trip_updated',
      'trip_started',
      'trip_completed',
      'trip_departure',
      'activity_reminder',
      'trip_liked',
    ];

    if (tripTypes.includes(item.type) && item.data?.tripId) {
      navigation.navigate('Trips', {
        screen: 'TripDetail',
        params: { tripId: item.data.tripId },
      });
    } else if (item.type === 'new_follower' && item.data?.userId) {
      navigation.navigate('Profile', {
        screen: 'UserProfile',
        params: { userId: item.data.userId },
      });
    }
  };

  const getTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('notifications.justNow');
    if (mins < 60) return t('notifications.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('notifications.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('notifications.daysAgo', { count: days });
    return new Date(dateStr).toLocaleDateString();
  };

  const styles = createStyles(theme, isDark);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const iconName = NOTIFICATION_ICONS[item.type] || 'bell';
    const iconColor = NOTIFICATION_COLORS[item.type] || theme.colors.primary;

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.unreadItem,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${iconColor}15` }]}>
          <Icon name={iconName as any} size={22} color={iconColor} />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={[
                styles.notificationTitle,
                { color: theme.colors.text },
                !item.isRead && styles.unreadText,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
          </View>
          <Text
            style={[styles.notificationBody, { color: theme.colors.textSecondary }]}
            numberOfLines={2}
          >
            {item.body}
          </Text>
          <Text style={[styles.notificationTime, { color: theme.colors.textSecondary }]}>
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const hasUnread = notifications.some(n => !n.isRead);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      {notifications.length > 0 && (
        <View style={styles.headerActions}>
          {hasUnread && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleMarkAllRead}>
              <Icon name="check-all" size={18} color={theme.colors.primary} />
              <Text style={[styles.headerBtnText, { color: theme.colors.primary }]}>
                {t('notifications.markAllRead')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={handleDeleteAll}>
            <Icon name="delete-sweep" size={18} color={colors.error.main} />
            <Text style={[styles.headerBtnText, { color: colors.error.main }]}>
              {t('notifications.deleteAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator style={{ padding: 16 }} color={theme.colors.primary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.primary[50] }]}>
              <Icon name="bell-off-outline" size={60} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {t('notifications.emptyTitle')}
            </Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              {t('notifications.emptyMessage')}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 12,
    },
    unreadItem: {
      backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationContent: {
      flex: 1,
      gap: 4,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    notificationTitle: {
      fontSize: 15,
      fontWeight: '500',
      flex: 1,
    },
    unreadText: {
      fontWeight: '700',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    notificationBody: {
      fontSize: 14,
      lineHeight: 20,
    },
    notificationTime: {
      fontSize: 12,
      marginTop: 2,
    },
    deleteBtn: {
      padding: 4,
      marginTop: 2,
    },
    emptyContainer: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingVertical: 80,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default NotificationsScreen;
