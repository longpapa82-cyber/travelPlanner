/**
 * ForgotPasswordScreen - Password Recovery
 *
 * Ocean Blue 디자인 시스템 적용:
 * - Card 기반 심플 레이아웃
 * - FadeIn/SlideIn 애니메이션
 * - 다크모드 지원
 * - 이메일 검증 후 전송
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { FadeIn } from '../../components/animation/FadeIn';
import { SlideIn } from '../../components/animation/SlideIn';
import Button from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import apiService from '../../services/api';
import { useToast } from '../../components/feedback/Toast/ToastContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('auth');
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async () => {
    if (!email) {
      showToast({ type: 'warning', message: t('forgotPassword.alerts.emailRequired'), position: 'top' });
      return;
    }

    if (!validateEmail(email)) {
      showToast({ type: 'warning', message: t('forgotPassword.alerts.emailInvalid'), position: 'top' });
      return;
    }

    setIsLoading(true);
    try {
      await apiService.forgotPassword(email);
      setIsSent(true);
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('forgotPassword.alerts.networkError'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(theme, isDark);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <FadeIn duration={600}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
            accessibilityLabel={t('forgotPassword.back', 'Go back')}
            accessibilityRole="button"
          >
            <Icon
              name="arrow-left"
              size={24}
              color={isDark ? colors.neutral[100] : colors.neutral[800]}
            />
          </TouchableOpacity>
        </FadeIn>

        {/* Form Card */}
        <SlideIn direction="bottom" duration={600} delay={200}>
          <Card elevation="lg" padding="xl" style={styles.formCard}>
            {!isSent ? (
              <>
                {/* Form State */}
                <FadeIn duration={400}>
                  <View style={styles.iconContainer}>
                    <Icon name="lock-reset" size={48} color={colors.primary[500]} />
                  </View>
                </FadeIn>

                <Text style={styles.title}>{t('forgotPassword.title')}</Text>
                <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>

                {/* Email Input */}
                <View style={styles.inputContainer}>
                  <Icon
                    name="email-outline"
                    size={20}
                    color={colors.primary[400]}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!isLoading}
                    accessibilityLabel={t('forgotPassword.email')}
                    accessibilityHint={t('forgotPassword.emailPlaceholder')}
                  />
                </View>

                {/* Submit Button */}
                <Button
                  variant="primary"
                  size="lg"
                  onPress={handleSubmit}
                  disabled={isLoading}
                  loading={isLoading}
                  style={styles.submitButton}
                >
                  {t('forgotPassword.submit')}
                </Button>
              </>
            ) : (
              /* Sent State */
              <FadeIn duration={600}>
                <View style={styles.sentContainer}>
                  <View style={styles.sentIconContainer}>
                    <Icon name="email-check-outline" size={64} color={colors.success.main} />
                  </View>
                  <Text style={styles.sentTitle}>{t('forgotPassword.sentTitle')}</Text>
                  <Text style={styles.sentMessage}>{t('forgotPassword.sentMessage')}</Text>

                  <Button
                    variant="primary"
                    size="lg"
                    onPress={() => navigation.navigate('Login')}
                    style={styles.backToLoginButton}
                  >
                    {t('forgotPassword.backToLogin')}
                  </Button>
                </View>
              </FadeIn>
            )}
          </Card>
        </SlideIn>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: theme.spacing.xl,
    },

    // Back Button
    backButton: {
      marginLeft: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Form Card
    formCard: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.xl,
    },

    // Icon
    iconContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },

    // Title
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },

    // Input Fields
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1.5,
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    inputIcon: {
      marginRight: theme.spacing.sm,
    },
    input: {
      flex: 1,
      height: 52,
      fontSize: 16,
      color: theme.colors.text,
    },

    // Submit Button
    submitButton: {
      marginTop: theme.spacing.sm,
    },

    // Sent State
    sentContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
    },
    sentIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: isDark ? 'rgba(72, 187, 120, 0.15)' : 'rgba(72, 187, 120, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    sentTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    sentMessage: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },
    backToLoginButton: {
      width: '100%',
    },
  });

export default ForgotPasswordScreen;
