import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants/theme';

const PING_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api') + '/health';

export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const [isOffline, setIsOffline] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web: use native online/offline events
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Native: periodic lightweight ping
    const checkNetwork = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch(PING_URL, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    };

    checkNetwork();
    intervalRef.current = setInterval(checkNetwork, 15000);

    // Re-check when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNetwork();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.container}>
      <Icon name="wifi-off" size={16} color="#fff" />
      <Text style={styles.text}>{t('offlineMode')}</Text>
    </View>
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
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
