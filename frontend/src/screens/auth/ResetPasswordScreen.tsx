/**
 * ResetPasswordScreen - Set New Password
 *
 * Ocean Blue 디자인 시스템 적용:
 * - Card 기반 심플 레이아웃
 * - FadeIn/SlideIn 애니메이션
 * - 다크모드 지원
 * - 비밀번호 강도 표시기
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const STRENGTH_COLORS = {
  strong: '#22C55E',
  medium: '#F59E0B',
  weak: '#EF4444',
} as const;

const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('auth');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getPasswordStrength = (pass: string): 'weak' | 'medium' | 'strong' => {
    if (
      pass.length >= 8 &&
      /[A-Z]/.test(pass) &&
      /[0-9]/.test(pass) &&
      /[^A-Za-z0-9]/.test(pass)
    ) {
      return 'strong';
    }
    if (pass.length >= 6 && (/[A-Z]/.test(pass) || /[0-9]/.test(pass))) {
      return 'medium';
    }
    return 'weak';
  };

  const handleSubmit = async () => {
    if (!newPassword) {
      Alert.alert(
        t('resetPassword.alerts.inputError'),
        t('resetPassword.alerts.passwordRequired'),
      );
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        t('resetPassword.alerts.passwordError'),
        t('resetPassword.alerts.passwordMinLength'),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('resetPassword.alerts.passwordError'),
        t('resetPassword.alerts.passwordMismatch'),
      );
      return;
    }

    setIsLoading(true);
    try {
      await apiService.resetPassword(token, newPassword);
      Alert.alert(
        t('resetPassword.alerts.successTitle'),
        t('resetPassword.alerts.successMessage'),
        [
          {
            text: t('resetPassword.alerts.goToLogin'),
            onPress: () => navigation.navigate('Login'),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        t('resetPassword.alerts.resetFailed'),
        error.response?.data?.message || t('resetPassword.alerts.networkError'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthColor = STRENGTH_COLORS[passwordStrength];
  const styles = createStyles(theme, isDark);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
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
            accessibilityLabel={t('resetPassword.back', 'Go back')}
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
            <FadeIn duration={400}>
              <View style={styles.iconContainer}>
                <Icon name="shield-lock-outline" size={48} color={colors.primary[500]} />
              </View>
            </FadeIn>

            <Text style={styles.title}>{t('resetPassword.title')}</Text>
            <Text style={styles.subtitle}>{t('resetPassword.subtitle')}</Text>

            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <Icon
                name="lock-outline"
                size={20}
                color={colors.primary[400]}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('resetPassword.newPasswordPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel={t('resetPassword.newPassword')}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={
                  showPassword
                    ? t('resetPassword.hidePassword', 'Hide password')
                    : t('resetPassword.showPassword', 'Show password')
                }
                accessibilityRole="button"
              >
                <Icon
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {newPassword.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width:
                          passwordStrength === 'strong'
                            ? '100%'
                            : passwordStrength === 'medium'
                            ? '66%'
                            : '33%',
                        backgroundColor: strengthColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strengthColor }]}>
                  {passwordStrength === 'strong'
                    ? t('resetPassword.passwordStrength.strong')
                    : passwordStrength === 'medium'
                    ? t('resetPassword.passwordStrength.medium')
                    : t('resetPassword.passwordStrength.weak')}
                </Text>
              </View>
            )}

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Icon
                name="lock-check-outline"
                size={20}
                color={colors.primary[400]}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel={t('resetPassword.confirmPassword')}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={
                  showConfirmPassword
                    ? t('resetPassword.hidePassword', 'Hide password')
                    : t('resetPassword.showPassword', 'Show password')
                }
                accessibilityRole="button"
              >
                <Icon
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
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
              {t('resetPassword.submit')}
            </Button>
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
    eyeIcon: {
      padding: theme.spacing.sm,
    },

    // Password Strength
    passwordStrengthContainer: {
      marginBottom: theme.spacing.lg,
      marginTop: -theme.spacing.sm,
    },
    strengthBar: {
      height: 4,
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200],
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: theme.spacing.xs,
    },
    strengthFill: {
      height: '100%',
      borderRadius: 2,
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // Submit Button
    submitButton: {
      marginTop: theme.spacing.sm,
    },
  });

export default ResetPasswordScreen;
