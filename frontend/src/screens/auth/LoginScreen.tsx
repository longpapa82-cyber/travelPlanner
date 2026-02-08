/**
 * LoginScreen v2.0 - Ocean Blue Design
 *
 * 2025 디자인 시스템 적용:
 * - Ocean Blue 색상 팔레트
 * - Card, Button 컴포넌트 사용
 * - FadeIn/SlideIn 애니메이션
 * - 다크모드 지원
 * - SNS 로그인 (Google, Apple, Kakao)
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
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { colors, getColorWithOpacity } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { FadeIn } from '../../components/animation/FadeIn';
import { SlideIn } from '../../components/animation/SlideIn';
import Button from '../../components/core/Button';
import { Card } from '../../components/core/Card';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, loginWithGoogle, loginWithApple, loginWithKakao } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('login.alerts.inputError'), !email ? t('login.alerts.emailRequired') : t('login.alerts.passwordRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert(
        t('login.alerts.loginFailed'),
        error.response?.data?.message || t('login.alerts.invalidCredentials')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      Alert.alert(
        t('login.alerts.googleFailed'),
        error.message || t('login.alerts.networkError')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithApple();
    } catch (error: any) {
      Alert.alert(
        t('login.alerts.appleFailed'),
        error.message || t('login.alerts.networkError')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithKakao();
    } catch (error: any) {
      Alert.alert(
        t('login.alerts.kakaoFailed'),
        error.message || t('login.alerts.networkError')
      );
    } finally {
      setIsLoading(false);
    }
  };

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
        {/* Hero Header with Background */}
        <FadeIn duration={800}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80' }}
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
              <Icon name="airplane-takeoff" size={64} color={colors.neutral[0]} />
              <Text style={styles.appName}>TravelPlanner</Text>
              <Text style={styles.tagline}>{t('login.tagline')}</Text>
            </LinearGradient>
          </ImageBackground>
        </FadeIn>

        {/* Login Form Card */}
        <SlideIn direction="bottom" duration={600} delay={200}>
          <Card elevation="lg" padding="xl" style={styles.formCard}>
            <Text style={styles.formTitle}>{t('login.title')}</Text>
            <Text style={styles.formSubtitle}>{t('login.subtitle')}</Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Icon name="email-outline" size={20} color={colors.primary[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                accessibilityLabel={t('login.email')}
                accessibilityHint={t('login.emailPlaceholder')}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Icon name="lock-outline" size={20} color={colors.primary[400]} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel={t('login.password')}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                accessibilityRole="button"
              >
                <Icon
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleLogin}
              disabled={isLoading}
              loading={isLoading}
              style={styles.loginButton}
            >
              {t('login.submit')}
            </Button>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>{t('login.or')}</Text>
              <View style={styles.divider} />
            </View>

            {/* SNS Login Buttons */}
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                onPress={handleGoogleLogin}
                disabled={isLoading}
                activeOpacity={0.7}
                accessibilityLabel={t('login.socialGoogle')}
                accessibilityRole="button"
              >
                <Icon name="google" size={22} color="#DB4437" />
                <Text style={styles.socialButtonText}>{t('login.socialGoogle')}</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton]}
                  onPress={handleAppleLogin}
                  disabled={isLoading}
                  activeOpacity={0.7}
                  accessibilityLabel={t('login.socialApple')}
                  accessibilityRole="button"
                >
                  <Icon name="apple" size={22} color="#000000" />
                  <Text style={styles.socialButtonText}>{t('login.socialApple')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.socialButton, styles.kakaoButton]}
                onPress={handleKakaoLogin}
                disabled={isLoading}
                activeOpacity={0.7}
                accessibilityLabel={t('login.socialKakao')}
                accessibilityRole="button"
              >
                <Icon name="chat" size={22} color="#3C1E1E" />
                <Text style={[styles.socialButtonText, styles.kakaoButtonText]}>
                  {t('login.socialKakao')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>{t('login.noAccount')} </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={isLoading}
                accessibilityLabel={t('login.register')}
                accessibilityRole="link"
              >
                <Text style={styles.registerLink}>{t('login.register')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </SlideIn>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
    height: 280,
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
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.neutral[0],
    marginTop: theme.spacing.md,
  },
  tagline: {
    fontSize: 16,
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

  // Login Button
  loginButton: {
    marginTop: theme.spacing.sm,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300],
  },
  dividerText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.md,
    fontWeight: '500',
  },

  // Social Buttons
  socialButtons: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    gap: theme.spacing.sm,
  },
  googleButton: {
    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
  },
  appleButton: {
    backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
    borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
    borderColor: '#FEE500',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? colors.neutral[100] : colors.neutral[800],
  },
  kakaoButtonText: {
    color: '#3C1E1E',
  },

  // Register Link
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  registerText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  registerLink: {
    fontSize: 15,
    color: colors.primary[500],
    fontWeight: '700',
  },
});

export default LoginScreen;
