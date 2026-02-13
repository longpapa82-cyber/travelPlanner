/**
 * EmailVerificationBanner - Email Verification Reminder
 *
 * 이메일 인증이 완료되지 않은 이메일 사용자에게
 * 화면 상단에 표시되는 경고 배너
 * - 재전송 기능
 * - 닫기 기능 (세션 한정)
 * - 다크모드 지원
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiService from '../../services/api';

const EmailVerificationBanner: React.FC = () => {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('common');
  const [dismissed, setDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Do not render if dismissed, not an email user, already verified, or no user
  if (
    dismissed ||
    !user ||
    user.provider !== 'email' ||
    user.isEmailVerified !== false
  ) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      await apiService.resendVerification(user.email);
    } catch (error: any) {
      // Silent fail — banner remains visible for retry
    } finally {
      setIsResending(false);
    }
  };

  const styles = createStyles(theme, isDark);

  return (
    <View style={styles.container}>
      <Icon
        name="alert-circle-outline"
        size={20}
        color={isDark ? colors.warning.main : colors.warning.dark}
        style={styles.warningIcon}
      />

      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {t('emailVerification.banner.title')}
        </Text>
        <Text style={styles.message}>
          {t('emailVerification.banner.message')}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleResend}
          disabled={isResending}
          style={styles.resendButton}
          accessibilityLabel={t('emailVerification.banner.resend')}
          accessibilityRole="button"
        >
          {isResending ? (
            <ActivityIndicator
              size="small"
              color={isDark ? colors.warning.main : colors.warning.dark}
            />
          ) : (
            <Text style={styles.resendText}>
              {t('emailVerification.banner.resend')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setDismissed(true)}
          style={styles.dismissButton}
          accessibilityLabel={t('emailVerification.banner.dismiss', 'Dismiss')}
          accessibilityRole="button"
        >
          <Icon
            name="close"
            size={18}
            color={isDark ? colors.warning.main : colors.warning.dark}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(246, 173, 85, 0.15)' : '#FEF3C7',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark
        ? 'rgba(246, 173, 85, 0.25)'
        : 'rgba(221, 107, 32, 0.2)',
    },

    // Warning Icon
    warningIcon: {
      marginRight: 8,
    },

    // Text
    textContainer: {
      flex: 1,
      marginRight: 8,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? colors.warning.main : colors.warning.dark,
      marginBottom: 2,
    },
    message: {
      fontSize: 13,
      color: isDark ? colors.neutral[300] : colors.neutral[600],
      lineHeight: 18,
    },

    // Actions
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    resendButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      minWidth: 50,
      alignItems: 'center',
    },
    resendText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? colors.warning.main : colors.warning.dark,
    },
    dismissButton: {
      padding: 4,
    },
  });

export default EmailVerificationBanner;
