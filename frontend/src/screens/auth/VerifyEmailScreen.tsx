/**
 * VerifyEmailScreen - Email Verification
 *
 * Ocean Blue 디자인 시스템 적용:
 * - 최소한의 센터 레이아웃
 * - FadeIn 애니메이션 상태 전환
 * - 다크모드 지원
 * - 자동 토큰 검증
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../constants/theme';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { FadeIn } from '../../components/animation/FadeIn';
import Button from '../../components/core/Button';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

type VerifyState = 'verifying' | 'success' | 'error';

const VerifyEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { token } = route.params;
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation('auth');
  const [state, setState] = useState<VerifyState>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      try {
        await apiService.verifyEmail(token);
        setState('success');
      } catch (error: any) {
        setState('error');
        setErrorMessage(
          error.response?.data?.message || t('verifyEmail.errorMessage'),
        );
      }
    };

    verifyToken();
  }, [token]);

  const styles = createStyles(theme, isDark);

  const renderContent = () => {
    switch (state) {
      case 'verifying':
        return (
          <FadeIn duration={400}>
            <View style={styles.stateContainer}>
              <ActivityIndicator
                size="large"
                color={colors.primary[500]}
                style={styles.spinner}
              />
              <Text style={styles.stateTitle}>{t('verifyEmail.verifying')}</Text>
              <Text style={styles.stateMessage}>
                {t('verifyEmail.verifyingMessage')}
              </Text>
            </View>
          </FadeIn>
        );

      case 'success':
        return (
          <FadeIn duration={600}>
            <View style={styles.stateContainer}>
              <View style={[styles.iconCircle, styles.successCircle]}>
                <Icon name="check-bold" size={48} color={colors.success.main} />
              </View>
              <Text style={styles.stateTitle}>{t('verifyEmail.success')}</Text>
              <Text style={styles.stateMessage}>
                {t('verifyEmail.successMessage')}
              </Text>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  if (isAuthenticated) {
                    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
                  } else {
                    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                  }
                }}
                style={styles.actionButton}
              >
                {isAuthenticated ? t('verifyEmail.goToHome', { defaultValue: t('verifyEmail.goToLogin') }) : t('verifyEmail.goToLogin')}
              </Button>
            </View>
          </FadeIn>
        );

      case 'error':
        return (
          <FadeIn duration={600}>
            <View style={styles.stateContainer}>
              <View style={[styles.iconCircle, styles.errorCircle]}>
                <Icon name="close-thick" size={48} color={colors.error.main} />
              </View>
              <Text style={styles.stateTitle}>{t('verifyEmail.errorTitle')}</Text>
              <Text style={styles.stateMessage}>{errorMessage}</Text>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  if (isAuthenticated) {
                    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
                  } else {
                    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
                  }
                }}
                style={styles.actionButton}
              >
                {isAuthenticated ? t('verifyEmail.goToHome', { defaultValue: t('verifyEmail.goToLogin') }) : t('verifyEmail.goToLogin')}
              </Button>
            </View>
          </FadeIn>
        );
    }
  };

  return <View style={styles.container}>{renderContent()}</View>;
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
    },

    // State Container
    stateContainer: {
      alignItems: 'center',
      width: '100%',
    },

    // Spinner
    spinner: {
      marginBottom: theme.spacing.xl,
    },

    // Icon Circles
    iconCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    successCircle: {
      backgroundColor: isDark
        ? 'rgba(72, 187, 120, 0.15)'
        : 'rgba(72, 187, 120, 0.1)',
    },
    errorCircle: {
      backgroundColor: isDark
        ? 'rgba(252, 129, 129, 0.15)'
        : 'rgba(252, 129, 129, 0.1)',
    },

    // Text
    stateTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    stateMessage: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },

    // Action Button
    actionButton: {
      width: '100%',
      marginTop: theme.spacing.sm,
    },
  });

export default VerifyEmailScreen;
