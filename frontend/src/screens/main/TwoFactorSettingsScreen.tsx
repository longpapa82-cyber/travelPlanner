import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Clipboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import Button from '../../components/core/Button';
import apiService from '../../services/api';
import { trackEvent } from '../../services/eventTracker';

type Step = 'status' | 'setup' | 'verify' | 'backup' | 'disable' | 'regenerate';

const TwoFactorSettingsScreen = ({ navigation }: any) => {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { user, refreshUser } = useAuth();
  const { isDark, theme } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('status');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const is2FAEnabled = user?.isTwoFactorEnabled;

  const handleSetup = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.setupTwoFactor();
      setQrCode(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep('setup');
    } catch {
      showToast({ type: 'error', message: t('twoFactor.alerts.setupFailed'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.enableTwoFactor(code);
      setBackupCodes(data.backupCodes);
      setStep('backup');
      setCode('');
      trackEvent('2fa_enabled');
      refreshUser?.();
      showToast({ type: 'success', message: t('twoFactor.alerts.enableSuccess'), position: 'top' });
    } catch {
      showToast({ type: 'error', message: t('twoFactor.alerts.invalidCode'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    try {
      setIsLoading(true);
      await apiService.disableTwoFactor(code);
      setStep('status');
      setCode('');
      trackEvent('2fa_disabled');
      refreshUser?.();
      showToast({ type: 'success', message: t('twoFactor.alerts.disableSuccess'), position: 'top' });
    } catch {
      showToast({ type: 'error', message: t('twoFactor.alerts.invalidCode'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.regenerateBackupCodes(code);
      setBackupCodes(data.backupCodes);
      setStep('backup');
      setCode('');
      trackEvent('2fa_backup_regenerated');
      showToast({ type: 'success', message: t('twoFactor.settings.regenerateSuccess'), position: 'top' });
    } catch {
      showToast({ type: 'error', message: t('twoFactor.alerts.invalidCode'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(text);
    } else {
      Clipboard?.setString?.(text);
    }
    showToast({ type: 'success', message: t('twoFactor.setup.backupCodesCopied'), position: 'top' });
  };

  const styles = createStyles(theme, isDark);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status View */}
      {step === 'status' && (
        <View style={styles.section}>
          {/* Status Badge */}
          <View style={[styles.statusCard, is2FAEnabled ? styles.statusEnabled : styles.statusDisabled]}>
            <Icon
              name={is2FAEnabled ? 'shield-check' : 'shield-off-outline'}
              size={40}
              color={is2FAEnabled ? colors.success.main : colors.neutral[400]}
            />
            <Text style={[styles.statusText, { color: is2FAEnabled ? colors.success.main : theme.colors.textSecondary }]}>
              {is2FAEnabled
                ? t('twoFactor.settings.statusEnabled')
                : t('twoFactor.settings.statusDisabled')}
            </Text>
          </View>

          {/* Security Tip */}
          <View style={styles.tipCard}>
            <Icon name="lightbulb-outline" size={20} color={colors.warning.main} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.tipTitle, { color: theme.colors.text }]}>
                {t('twoFactor.settings.securityTip')}
              </Text>
              <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>
                {t('twoFactor.settings.securityTipText')}
              </Text>
            </View>
          </View>

          {/* Actions */}
          {is2FAEnabled ? (
            <View style={styles.actions}>
              <Button
                variant="secondary"
                fullWidth
                onPress={() => { setCode(''); setStep('regenerate'); }}
              >
                {t('twoFactor.settings.regenerateBackupCodes')}
              </Button>
              <Button
                variant="danger"
                fullWidth
                onPress={() => { setCode(''); setStep('disable'); }}
              >
                {t('twoFactor.settings.disableButton')}
              </Button>
            </View>
          ) : (
            <Button variant="primary" fullWidth loading={isLoading} onPress={handleSetup}>
              {t('twoFactor.settings.setupButton')}
            </Button>
          )}
        </View>
      )}

      {/* Setup: QR Code */}
      {step === 'setup' && (
        <View style={styles.section}>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('twoFactor.setup.description')}
          </Text>
          {qrCode ? (
            <View style={styles.qrContainer}>
              <Image source={{ uri: qrCode }} style={styles.qrImage} />
            </View>
          ) : null}
          <View style={styles.secretBox}>
            <Text style={[styles.secretLabel, { color: theme.colors.textSecondary }]}>
              {t('twoFactor.setup.manualEntry')}
            </Text>
            <Text style={[styles.secretValue, { color: theme.colors.text }]}>
              {secret}
            </Text>
          </View>
          <Button variant="primary" fullWidth onPress={() => setStep('verify')}>
            {tCommon('next')}
          </Button>
        </View>
      )}

      {/* Verify: Enter TOTP code */}
      {step === 'verify' && (
        <View style={styles.section}>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('twoFactor.setup.enterCode')}
          </Text>
          <TextInput
            style={[styles.codeInput, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
            placeholder={t('twoFactor.codePlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            accessibilityLabel={t('twoFactor.codePlaceholder')}
          />
          <Button variant="primary" fullWidth loading={isLoading} onPress={handleEnable}>
            {t('twoFactor.setup.enable')}
          </Button>
        </View>
      )}

      {/* Backup Codes Display */}
      {step === 'backup' && (
        <View style={styles.section}>
          <View style={styles.backupHeader}>
            <Icon name="key-variant" size={24} color={theme.colors.primary} />
            <Text style={[styles.backupTitle, { color: theme.colors.text }]}>
              {t('twoFactor.setup.backupCodesTitle')}
            </Text>
          </View>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('twoFactor.setup.backupCodesDescription')}
          </Text>
          <View style={styles.codesGrid}>
            {backupCodes.map((c, i) => (
              <View key={i} style={styles.codeItem}>
                <Text style={[styles.codeNumber, { color: theme.colors.textSecondary }]}>
                  {i + 1}.
                </Text>
                <Text style={[styles.codeValue, { color: theme.colors.text }]}>
                  {c}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.copyButton} onPress={copyBackupCodes}>
            <Icon name="content-copy" size={18} color={theme.colors.primary} />
            <Text style={[styles.copyText, { color: theme.colors.primary }]}>
              {tCommon('copy')}
            </Text>
          </TouchableOpacity>
          <Button variant="primary" fullWidth onPress={() => { setStep('status'); navigation.goBack(); }}>
            {t('twoFactor.setup.done')}
          </Button>
        </View>
      )}

      {/* Disable: Enter code to confirm */}
      {step === 'disable' && (
        <View style={styles.section}>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('twoFactor.disable.description')}
          </Text>
          <TextInput
            style={[styles.codeInput, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
            placeholder={t('twoFactor.codePlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            accessibilityLabel={t('twoFactor.codePlaceholder')}
          />
          <Button variant="danger" fullWidth loading={isLoading} onPress={handleDisable}>
            {t('twoFactor.disable.confirm')}
          </Button>
        </View>
      )}

      {/* Regenerate Backup Codes */}
      {step === 'regenerate' && (
        <View style={styles.section}>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {t('twoFactor.settings.enterCodeToRegenerate')}
          </Text>
          <View style={styles.warningBox}>
            <Icon name="alert-outline" size={18} color={colors.warning.dark} />
            <Text style={styles.warningText}>
              {t('twoFactor.settings.regenerateDescription')}
            </Text>
          </View>
          <TextInput
            style={[styles.codeInput, { color: theme.colors.text, borderColor: isDark ? colors.neutral[600] : colors.neutral[300] }]}
            placeholder={t('twoFactor.codePlaceholder')}
            placeholderTextColor={theme.colors.textSecondary}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            accessibilityLabel={t('twoFactor.codePlaceholder')}
          />
          <Button variant="primary" fullWidth loading={isLoading} onPress={handleRegenerate}>
            {t('twoFactor.settings.regenerateConfirm')}
          </Button>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 20,
    },
    section: {
      gap: 16,
    },
    statusCard: {
      alignItems: 'center',
      padding: 24,
      borderRadius: 16,
      gap: 12,
    },
    statusEnabled: {
      backgroundColor: isDark ? 'rgba(72,187,120,0.1)' : 'rgba(72,187,120,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(72,187,120,0.3)' : 'rgba(72,187,120,0.2)',
    },
    statusDisabled: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    tipCard: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(246,173,85,0.1)' : '#FEF3C7',
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    tipText: {
      fontSize: 13,
      lineHeight: 18,
    },
    actions: {
      gap: 12,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    qrContainer: {
      alignItems: 'center',
      padding: 16,
    },
    qrImage: {
      width: 200,
      height: 200,
      borderRadius: 8,
    },
    secretBox: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
      borderRadius: 8,
      padding: 12,
    },
    secretLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    secretValue: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    codeInput: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      fontSize: 24,
      textAlign: 'center',
      letterSpacing: 8,
      fontWeight: '700',
    },
    backupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center',
    },
    backupTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    codesGrid: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderRadius: 12,
      padding: 16,
      gap: 8,
    },
    codeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    codeNumber: {
      fontSize: 13,
      width: 20,
      textAlign: 'right',
    },
    codeValue: {
      fontSize: 16,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontWeight: '600',
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 8,
    },
    copyText: {
      fontSize: 14,
      fontWeight: '600',
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(246,173,85,0.1)' : '#FEF3C7',
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      color: colors.warning.dark,
      lineHeight: 18,
    },
  });

export default TwoFactorSettingsScreen;
