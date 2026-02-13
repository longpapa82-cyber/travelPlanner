import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants/theme';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const { t } = useTranslation('common');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useState(() => new Animated.Value(100))[0];

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    // Don't show if already installed or user dismissed
    if (window.matchMedia?.('(display-mode: standalone)').matches) return undefined;
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return undefined;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }).start();
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [slideAnim]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
      localStorage.setItem('pwa-install-dismissed', '1');
    });
  }, [slideAnim]);

  if (Platform.OS !== 'web' || !deferredPrompt || dismissed) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.content}>
        <Icon name="cellphone-arrow-down" size={24} color={colors.primary[500]} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{t('pwa.installTitle')}</Text>
          <Text style={styles.subtitle}>{t('pwa.installMessage')}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>{t('close')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleInstall} style={styles.installButton}>
          <Icon name="download" size={16} color="#fff" />
          <Text style={styles.installText}>{t('pwa.install')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary[500],
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  installText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
