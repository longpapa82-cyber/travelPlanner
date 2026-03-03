/**
 * GDPR Cookie Consent Banner (Web Only)
 *
 * Displays a fixed bottom banner asking users for cookie consent
 * for personalized advertising. Stores the choice in localStorage
 * and communicates with useGDPRConsent.web.ts via custom events.
 *
 * - Accept: personalized ads enabled
 * - Reject: non-personalized ads only
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, shadows, typography } from '../constants/theme';
import { setConsent, dispatchConsentChange } from '../hooks/useGDPRConsent.web';

const STORAGE_KEY = 'gdpr_consent';

const GDPRConsentBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on web
    if (Platform.OS !== 'web') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleAccept = useCallback(() => {
    setConsent(true);
    dispatchConsentChange();
    setVisible(false);
  }, []);

  const handleReject = useCallback(() => {
    setConsent(false);
    dispatchConsentChange();
    setVisible(false);
  }, []);

  const handleLearnMore = useCallback(() => {
    Linking.openURL('https://mytravel-planner.com/privacy.html');
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.message}>{t('gdpr.message')}</Text>
        <Pressable onPress={handleLearnMore} accessibilityRole="link">
          <Text style={styles.learnMore}>{t('gdpr.learnMore')}</Text>
        </Pressable>
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
            accessibilityRole="button"
            accessibilityLabel={t('gdpr.reject')}
          >
            <Text style={styles.rejectButtonText}>{t('gdpr.reject')}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
            accessibilityRole="button"
            accessibilityLabel={t('gdpr.accept')}
          >
            <Text style={styles.acceptButtonText}>{t('gdpr.accept')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  container: {
    backgroundColor: colors.neutral[800],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.lg,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  message: {
    color: colors.neutral[100],
    fontSize: typography.body.small.fontSize,
    lineHeight: typography.body.small.lineHeight,
    marginBottom: spacing.xs,
  },
  learnMore: {
    color: colors.primary[300],
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    marginBottom: spacing.md,
    textDecorationLine: 'underline',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.button,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.neutral[500],
  },
  rejectButtonText: {
    color: colors.neutral[300],
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  acceptButton: {
    backgroundColor: colors.primary[500],
  },
  acceptButtonText: {
    color: colors.neutral[0],
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
  },
});

export default GDPRConsentBanner;
