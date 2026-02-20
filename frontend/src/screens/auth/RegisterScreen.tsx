/**
 * RegisterScreen v2.0 - Ocean Blue Design
 *
 * 2025 디자인 시스템 적용:
 * - Ocean Blue 색상 팔레트
 * - Card, Button 컴포넌트 사용
 * - FadeIn/SlideIn 애니메이션
 * - 다크모드 지원
 * - 폼 검증 (이메일, 비밀번호 강도)
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
  ImageBackground,
} from 'react-native';
import AuthLegalModal from '../../components/legal/AuthLegalModal';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { FadeIn } from '../../components/animation/FadeIn';
import { SlideIn } from '../../components/animation/SlideIn';
import Button from '../../components/core/Button';
import { Card } from '../../components/core/Card';
import { getHeroImageUrl } from '../../utils/images';
import { useToast } from '../../components/feedback/Toast/ToastContext';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('auth');
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    if (password.length < 8) return 'weak';
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) return 'weak';
    if (password.length < 12) return 'medium';
    return 'strong';
  };

  const handleRegister = async () => {
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      showToast({ type: 'warning', message: t('register.alerts.nameRequired'), position: 'top' });
      return;
    }

    if (!validateEmail(email)) {
      showToast({ type: 'warning', message: t('register.alerts.emailInvalid'), position: 'top' });
      return;
    }

    if (password !== confirmPassword) {
      showToast({ type: 'warning', message: t('register.alerts.passwordMismatch'), position: 'top' });
      return;
    }

    if (password.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      showToast({ type: 'warning', message: t('register.alerts.passwordMinLength'), position: 'top' });
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, name);
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('register.alerts.networkError'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthColor =
    passwordStrength === 'strong'
      ? colors.success.main
      : passwordStrength === 'medium'
      ? colors.warning.main
      : colors.error.main;

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
        {/* Hero Header */}
        <FadeIn duration={800}>
          <ImageBackground
            source={{ uri: getHeroImageUrl('register', { width: 800 }) }}
            style={styles.heroBackground}
            imageStyle={styles.heroImage}
          >
            <LinearGradient
              colors={[
                isDark ? 'rgba(0,0,0,0.7)' : 'rgba(59,130,246,0.85)',
                isDark ? 'rgba(0,0,0,0.9)' : 'rgba(37,99,235,0.95)',
              ]}
              style={styles.heroGradient}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                disabled={isLoading}
                accessibilityLabel={t('register.backAccessibility', 'Go back')}
                accessibilityRole="button"
              >
                <Icon name="arrow-left" size={24} color={colors.neutral[0]} />
              </TouchableOpacity>
              <Icon name="account-plus-outline" size={56} color={colors.neutral[0]} />
              <Text style={styles.appName}>{t('register.subtitle')}</Text>
              <Text style={styles.tagline}>{t('register.description')}</Text>
            </LinearGradient>
          </ImageBackground>
        </FadeIn>

        {/* Register Form Card */}
        <SlideIn direction="bottom" duration={600} delay={200}>
          <Card elevation="lg" padding="xl" style={styles.formCard}>
            <Text style={styles.formTitle}>{t('register.title')}</Text>
            <Text style={styles.formSubtitle}>{t('register.description')}</Text>

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Icon name="account-outline" size={20} color={colors.primary[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('register.namePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isLoading}
                accessibilityLabel={t('register.name')}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Icon name="email-outline" size={20} color={colors.primary[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('register.emailPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                accessibilityLabel={t('register.email')}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Icon name="lock-outline" size={20} color={colors.primary[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('register.passwordPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel={t('register.password')}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={showPassword ? t('register.hidePassword', 'Hide password') : t('register.showPassword', 'Show password')}
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
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: passwordStrength === 'strong' ? '100%' : passwordStrength === 'medium' ? '66%' : '33%',
                        backgroundColor: strengthColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strengthColor }]}>
                  {passwordStrength === 'strong'
                    ? t('register.passwordStrength.strong')
                    : passwordStrength === 'medium'
                    ? t('register.passwordStrength.medium')
                    : t('register.passwordStrength.weak')}
                </Text>
              </View>
            )}

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Icon name="lock-check-outline" size={20} color={colors.primary[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('register.confirmPasswordPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel={t('register.confirmPassword')}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={showConfirmPassword ? t('register.hidePassword', 'Hide password') : t('register.showPassword', 'Show password')}
                accessibilityRole="button"
              >
                <Icon
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Register Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleRegister}
              disabled={isLoading}
              loading={isLoading}
              style={styles.registerButton}
            >
              {t('register.submit')}
            </Button>

            {/* Legal Agreement Text */}
            <Text style={styles.legalText}>
              {t('register.agreeBySignup')}{' '}
              <Text
                style={styles.legalLink}
                onPress={() => setLegalModal('terms')}
                accessibilityRole="link"
              >
                {t('register.termsOfService')}
              </Text>
              {' '}{t('register.and')}{' '}
              <Text
                style={styles.legalLink}
                onPress={() => setLegalModal('privacy')}
                accessibilityRole="link"
              >
                {t('register.privacyPolicy')}
              </Text>
              {t('register.agreeToTerms')}
            </Text>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t('register.haveAccount')} </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                disabled={isLoading}
                accessibilityLabel={t('register.login')}
                accessibilityRole="link"
              >
                <Text style={styles.loginLink}>{t('register.login')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </SlideIn>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      <AuthLegalModal
        visible={legalModal !== null}
        onClose={() => setLegalModal(null)}
        type={legalModal ?? 'terms'}
      />
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero Section
  heroBackground: {
    width: '100%',
    height: 260,
    marginBottom: -40,
  },
  heroImage: {
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    position: 'absolute',
    top: theme.spacing.xl + 10,
    left: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.neutral[0],
    marginTop: theme.spacing.md,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  tagline: {
    fontSize: 15,
    color: colors.neutral[100],
    marginTop: theme.spacing.xs,
  },

  // Form Card
  formCard: {
    marginHorizontal: theme.spacing.lg,
    marginTop: 0,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  formSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
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

  // Register Button
  registerButton: {
    marginTop: theme.spacing.sm,
  },

  // Legal Agreement
  legalText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    lineHeight: 20,
  },
  legalLink: {
    color: colors.primary[500],
    textDecorationLine: 'underline' as const,
    fontWeight: '500' as const,
  },

  // Login Link
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
  },
  loginText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  loginLink: {
    fontSize: 15,
    color: colors.primary[500],
    fontWeight: '700',
  },
});

export default RegisterScreen;
