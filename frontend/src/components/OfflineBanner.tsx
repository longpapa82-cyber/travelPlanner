import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants/theme';
import { useOfflineSync } from '../hooks/useOfflineSync';

export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  // Online with no pending — show nothing
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  // Online + syncing
  if (isOnline && isSyncing) {
    return (
      <View style={[styles.container, styles.syncingContainer]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.text}>{t('offlineSyncing')}</Text>
      </View>
    );
  }

  // Online + just synced (pending went to 0)
  if (isOnline && pendingCount === 0) {
    return null;
  }

  // Offline
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={syncNow}
      activeOpacity={0.8}
      disabled={isSyncing}
    >
      <Icon name="wifi-off" size={16} color="#fff" />
      <Text style={styles.text}>
        {pendingCount > 0
          ? t('offlinePending', { count: pendingCount })
          : t('offlineMode')}
      </Text>
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.neutral[700],
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  syncingContainer: {
    backgroundColor: colors.primary[600],
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: colors.error.main,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
