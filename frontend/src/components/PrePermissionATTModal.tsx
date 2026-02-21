/**
 * Pre-Permission ATT Modal
 *
 * Shown before the system ATT dialog to explain WHY tracking helps.
 * Displayed only when: session >= 3 AND ATT status === 'undetermined'.
 * "Continue" triggers the real system dialog; "Later" dismisses until next session.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import Button from './core/Button';

const DISMISSED_KEY = '@travelplanner:att_preperm_dismissed_session';

interface PrePermissionATTModalProps {
  visible: boolean;
  sessionCount: number;
  onRequestTracking: () => Promise<any>;
  onDismiss: () => void;
}

const PrePermissionATTModal: React.FC<PrePermissionATTModalProps> = ({
  visible,
  sessionCount,
  onRequestTracking,
  onDismiss,
}) => {
  const { t } = useTranslation('common');
  const { theme, isDark } = useTheme();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleContinue = async () => {
    setIsRequesting(true);
    try {
      await onRequestTracking();
    } finally {
      setIsRequesting(false);
      onDismiss();
    }
  };

  const handleLater = async () => {
    // Store current session so we don't show again this session
    await AsyncStorage.setItem(DISMISSED_KEY, String(sessionCount));
    onDismiss();
  };

  if (Platform.OS === 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
          <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.primary[900] : colors.primary[50] }]}>
            <Icon name="shield-check" size={40} color={colors.primary[500]} />
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('att.title')}
          </Text>

          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('att.description')}
          </Text>

          <View style={styles.benefits}>
            {['att.benefit1', 'att.benefit2', 'att.benefit3'].map((key) => (
              <View key={key} style={styles.benefitRow}>
                <Icon name="check-circle" size={18} color={colors.primary[500]} />
                <Text style={[styles.benefitText, { color: theme.colors.text }]}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>

          <Button
            variant="primary"
            fullWidth
            onPress={handleContinue}
            loading={isRequesting}
            disabled={isRequesting}
          >
            {t('att.continue')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onPress={handleLater}
            disabled={isRequesting}
            style={{ marginTop: 8 }}
          >
            {t('att.later')}
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export const shouldShowATTPrePermission = async (sessionCount: number): Promise<boolean> => {
  try {
    const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
    if (dismissed && parseInt(dismissed, 10) >= sessionCount) return false;
    return true;
  } catch {
    return true;
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
    padding: 28,
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
    gap: 10,
    marginBottom: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
});

export default PrePermissionATTModal;
