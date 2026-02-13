import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import Button from '../../components/core/Button';
import { FadeIn } from '../../components/animation/FadeIn';

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactorLogin'>;

const TwoFactorLoginScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tempToken } = route.params;
  const { completeTwoFactorLogin } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('auth');
  const [code, setCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setError('');
    setIsLoading(true);
    try {
      await completeTwoFactorLogin(tempToken, code.trim());
      // Auth context will update user state → navigation auto-switches to Main
    } catch (err: any) {
      setError(
        err.response?.data?.message || t('twoFactor.alerts.invalidCode'),
      );
      setCode('');
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBackupMode = () => {
    setIsBackupMode(!isBackupMode);
    setCode('');
    setError('');
  };

  const styles = createStyles(theme, isDark);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FadeIn duration={500}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Icon
              name="shield-lock-outline"
              size={48}
              color={colors.primary[500]}
            />
          </View>
        </View>

        <Text style={styles.title}>{t('twoFactor.title')}</Text>
        <Text style={styles.subtitle}>
          {isBackupMode
            ? t('twoFactor.backupCodePlaceholder')
            : t('twoFactor.subtitle')}
        </Text>

        <TextInput
          ref={inputRef}
          style={[styles.input, error ? styles.inputError : null]}
          placeholder={
            isBackupMode
              ? t('twoFactor.backupCodePlaceholder')
              : t('twoFactor.codePlaceholder')
          }
          placeholderTextColor={theme.colors.textSecondary}
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setError('');
          }}
          keyboardType={isBackupMode ? 'default' : 'number-pad'}
          maxLength={isBackupMode ? 8 : 6}
          autoFocus
          textAlign="center"
          autoComplete="one-time-code"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={
            isLoading ||
            (isBackupMode ? code.length < 8 : code.length < 6)
          }
          onPress={handleVerify}
          style={styles.verifyButton}
        >
          {t('twoFactor.verify')}
        </Button>

        <TouchableOpacity
          onPress={toggleBackupMode}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {isBackupMode
              ? t('twoFactor.subtitle')
              : t('twoFactor.useBackupCode')}
          </Text>
        </TouchableOpacity>
      </FadeIn>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.xl,
      justifyContent: 'center',
    },
    backButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 20,
      left: 0,
      padding: 8,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: isDark
        ? 'rgba(96, 165, 250, 0.12)'
        : colors.primary[50],
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },
    input: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderWidth: 1.5,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      fontSize: 24,
      fontWeight: '600',
      color: theme.colors.text,
      letterSpacing: 8,
    },
    inputError: {
      borderColor: colors.error.main,
    },
    errorText: {
      color: colors.error.main,
      fontSize: 14,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    verifyButton: {
      marginTop: theme.spacing.lg,
    },
    toggleButton: {
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
    },
    toggleText: {
      fontSize: 14,
      color: colors.primary[500],
      fontWeight: '500',
    },
  });

export default TwoFactorLoginScreen;
