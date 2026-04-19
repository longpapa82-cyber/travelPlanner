/**
 * Pre-Permission Notification Modal
 *
 * Shown once before the system push notification dialog.
 * Explains benefits: trip reminders, departure alerts, weather changes.
 * "Enable" triggers requestPermissionsAsync; "Later" dismisses permanently.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import Button from './core/Button';

const SHOWN_KEY = '@travelplanner:notification_preperm_shown';

interface PrePermissionNotificationModalProps {
  visible: boolean;
  onRequestPermission: () => Promise<boolean>;
  onDismiss: () => void;
}

const PrePermissionNotificationModal: React.FC<PrePermissionNotificationModalProps> = ({
  visible,
  onRequestPermission,
  onDismiss,
}) => {
  const { t } = useTranslation('common');
  const { theme, isDark } = useTheme();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      await AsyncStorage.setItem(SHOWN_KEY, 'true');
      await onRequestPermission();
    } finally {
      setIsRequesting(false);
      onDismiss();
    }
  };

  const handleLater = async () => {
    await AsyncStorage.setItem(SHOWN_KEY, 'true');
    onDismiss();
  };

  if (Platform.OS === 'web') return null;

  const benefits = [
    { icon: 'bell-ring' as const, key: 'notifications.prePermission.benefit1' },
    { icon: 'airplane-clock' as const, key: 'notifications.prePermission.benefit2' },
    { icon: 'weather-partly-cloudy' as const, key: 'notifications.prePermission.benefit3' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
          <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.primary[900] : colors.primary[50] }]}>
            <Icon name="bell-outline" size={40} color={colors.primary[500]} />
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('notifications.prePermission.title')}
          </Text>

          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('notifications.prePermission.description')}
          </Text>

          <View style={styles.benefits}>
            {benefits.map(({ icon, key }) => (
              <View key={key} style={styles.benefitRow}>
                <Icon name={icon} size={22} color={colors.primary[500]} />
                <Text style={[styles.benefitText, { color: theme.colors.text }]}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>

          <Button
            variant="primary"
            fullWidth
            onPress={handleEnable}
            loading={isRequesting}
            disabled={isRequesting}
          >
            {t('notifications.prePermission.enable')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onPress={handleLater}
            disabled={isRequesting}
            style={{ marginTop: 8 }}
          >
            {t('notifications.prePermission.later')}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export const hasSeenNotificationPrePermission = async (): Promise<boolean> => {
  try {
    const shown = await AsyncStorage.getItem(SHOWN_KEY);
    return shown === 'true';
  } catch {
    return false;
  }
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  benefits: {
    width: '100%',
    gap: 14,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  benefitText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
});

export default PrePermissionNotificationModal;
