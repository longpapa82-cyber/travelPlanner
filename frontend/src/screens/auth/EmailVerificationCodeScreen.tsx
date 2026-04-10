/**
 * EmailVerificationCodeScreen - 6-digit code input for email verification.
 * Shown after registration for email-based accounts (not social login).
 * Blocks access to main app until verified.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { colors } from '../../constants/theme';
import Button from '../../components/core/Button';
import apiService from '../../services/api';

interface Props {
  onVerified: () => void;
  onLogout: () => void;
  userEmail?: string;
}

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const EmailVerificationCodeScreen: React.FC<Props> = ({ onVerified, onLogout, userEmail }) => {
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation('auth');
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hasSentInitial, setHasSentInitial] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Send initial code on mount
  useEffect(() => {
    if (!hasSentInitial) {
      handleResend();
      setHasSentInitial(true);
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    try {
      await apiService.sendVerificationCode();
      setCooldown(RESEND_COOLDOWN);
      showToast({
        type: 'success',
        message: t('verification.codeSent', { defaultValue: '인증 코드가 발송되었습니다.' }),
        position: 'top',
        duration: 3000,
      });
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('verification.sendFailed', { defaultValue: '코드 발송에 실패했습니다.' });
      showToast({ type: 'error', message: msg, position: 'top' });
    } finally {
      setIsSending(false);
    }
  }, [cooldown, isSending, showToast, t]);

  const handleCodeChange = useCallback((index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setCode((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
  }, [code]);

  const handleVerify = useCallback(async () => {
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) {
      showToast({
        type: 'error',
        message: t('verification.enterCode', { defaultValue: '6자리 인증 코드를 입력해주세요.' }),
        position: 'top',
      });
      return;
    }

    setIsVerifying(true);
    try {
      await apiService.verifyEmailCode(fullCode);
      showToast({
        type: 'success',
        message: t('verification.success', { defaultValue: '이메일이 인증되었습니다!' }),
        position: 'top',
        duration: 2000,
      });
      onVerified();
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('verification.failed', { defaultValue: '인증에 실패했습니다.' });
      showToast({ type: 'error', message: msg, position: 'top' });
      // Clear inputs on failure
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [code, onVerified, showToast, t]);

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (code.every((d) => d !== '') && !isVerifying) {
      handleVerify();
    }
  }, [code]);

  const maskedEmail = userEmail
    ? userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    : '';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 40 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: isDark ? colors.primary[900] : colors.primary[50] }]}>
        <Icon name="email-check-outline" size={48} color={colors.primary[500]} />
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t('verification.title', { defaultValue: '이메일 인증' })}
      </Text>

      {/* Description */}
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
        {t('verification.description', {
          defaultValue: '이메일로 발송된 6자리 인증 코드를 입력해주세요.',
        })}
      </Text>
      {maskedEmail ? (
        <Text style={[styles.email, { color: theme.colors.primary }]}>{maskedEmail}</Text>
      ) : null}

      {/* Code Input */}
      <View style={styles.codeContainer}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <TextInput
            key={i}
            ref={(ref) => { inputRefs.current[i] = ref; }}
            style={[
              styles.codeInput,
              {
                borderColor: code[i]
                  ? colors.primary[500]
                  : isDark ? colors.neutral[600] : colors.neutral[300],
                backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
                color: theme.colors.text,
              },
            ]}
            value={code[i]}
            onChangeText={(val) => handleCodeChange(i, val)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={1}
            textContentType="oneTimeCode"
            autoComplete={i === 0 ? 'sms-otp' : 'off'}
            selectTextOnFocus
            accessibilityLabel={`Code digit ${i + 1}`}
          />
        ))}
      </View>

      {/* Verify Button */}
      <View style={styles.buttonContainer}>
        <Button onPress={handleVerify} loading={isVerifying} disabled={isVerifying || code.some((d) => !d)}>
          {t('verification.verify', { defaultValue: '인증하기' })}
        </Button>
      </View>

      {/* Resend */}
      <View style={styles.resendContainer}>
        {isSending ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Text
            style={[
              styles.resendText,
              { color: cooldown > 0 ? theme.colors.textSecondary : theme.colors.primary },
            ]}
            onPress={cooldown > 0 ? undefined : handleResend}
            accessibilityRole="button"
          >
            {cooldown > 0
              ? t('verification.resendWait', { defaultValue: `재발송 (${cooldown}초)`, seconds: cooldown })
              : t('verification.resend', { defaultValue: '인증 코드 재발송' })}
          </Text>
        )}
      </View>

      {/* Spam notice */}
      <Text style={[styles.spamNotice, { color: theme.colors.textSecondary }]}>
        {t('verification.checkSpam', { defaultValue: '이메일이 오지 않으면 스팸함을 확인해주세요.' })}
      </Text>

      {/* Logout — escape route for users who can't verify */}
      <Text
        style={[styles.logoutText, { color: theme.colors.textSecondary }]}
        onPress={onLogout}
        accessibilityRole="button"
      >
        {t('verification.logout', { defaultValue: '다른 계정으로 로그인' })}
      </Text>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  resendContainer: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  spamNotice: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 32,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});

export default EmailVerificationCodeScreen;
