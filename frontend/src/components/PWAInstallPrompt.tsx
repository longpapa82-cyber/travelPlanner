import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants/theme';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.longpapa82.travelplanner';

function isMobileWeb(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export const PWAInstallPrompt: React.FC = () => {
  const { t } = useTranslation('common');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showMobileBanner, setShowMobileBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useState(() => new Animated.Value(100))[0];

  const mobile = isMobileWeb();

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      slideAnim.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    // Don't show if already installed as PWA or user dismissed
    if (window.matchMedia?.('(display-mode: standalone)').matches) return undefined;
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return undefined;
    }

    const showBanner = () => {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 50,
        friction: 9,
      }).start();
    };

    // Mobile: show "Get the app" banner (no beforeinstallprompt needed)
    if (mobile) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => {
        setShowMobileBanner(true);
        showBanner();
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Desktop: show PWA install prompt when browser fires beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      showBanner();
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [slideAnim, mobile]);

  const handleInstall = useCallback(async () => {
    if (mobile) {
      // Mobile: open Play Store
      await Linking.openURL(PLAY_STORE_URL);
      setDismissed(true);
      localStorage.setItem('pwa-install-dismissed', '1');
      return;
    }
    // Desktop: trigger PWA install
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  }, [deferredPrompt, mobile]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      setDismissed(true);
      localStorage.setItem('pwa-install-dismissed', '1');
    });
  }, [slideAnim]);

  if (Platform.OS !== 'web' || dismissed) return null;
  // Desktop needs deferredPrompt; mobile needs showMobileBanner
  if (!mobile && !deferredPrompt) return null;
  if (mobile && !showMobileBanner) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.content}>
        <Icon
          name={mobile ? 'google-play' : 'cellphone-arrow-down'}
          size={24}
          color={colors.primary[500]}
        />
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {mobile ? t('pwa.appTitle') : t('pwa.installTitle')}
          </Text>
          <Text style={styles.subtitle}>
            {mobile ? t('pwa.appMessage') : t('pwa.installMessage')}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>{t('close')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleInstall} style={styles.installButton}>
          <Icon
            name={mobile ? 'download' : 'download'}
            size={16}
            color="#fff"
          />
          <Text style={styles.installText}>
            {mobile ? t('pwa.getApp') : t('pwa.install')}
          </Text>
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
