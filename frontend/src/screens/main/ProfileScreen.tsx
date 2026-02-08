import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Modal,
  Platform,
  Linking,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import Button from '../../components/core/Button';
import apiService from '../../services/api';

const ProfileScreen = () => {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const { showToast } = useToast();

  // Modal states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(message)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: tCommon('cancel'), style: 'cancel' },
        { text: tCommon('confirm'), style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleLogout = () => {
    confirm(t('logout.title'), t('logout.message'), logout);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showToast({ type: 'warning', message: t('editProfile.alerts.nameRequired'), position: 'top' });
      return;
    }
    setIsSaving(true);
    try {
      await apiService.updateProfile({ name: editName.trim() });
      showToast({ type: 'success', message: t('editProfile.alerts.success'), position: 'top' });
      setShowEditProfile(false);
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('editProfile.alerts.failed'), position: 'top' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast({ type: 'warning', message: t('changePassword.alerts.allFieldsRequired'), position: 'top' });
      return;
    }
    if (newPassword.length < 8) {
      showToast({ type: 'warning', message: t('changePassword.alerts.minLength'), position: 'top' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ type: 'warning', message: t('changePassword.alerts.mismatch'), position: 'top' });
      return;
    }
    setIsSaving(true);
    try {
      await apiService.changePassword(currentPassword, newPassword);
      showToast({ type: 'success', message: t('changePassword.alerts.success'), position: 'top' });
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('changePassword.alerts.failed'), position: 'top' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    confirm(t('deleteAccount.title'), t('deleteAccount.message'), async () => {
      try {
        await apiService.deleteAccount();
        await logout();
        showToast({ type: 'success', message: t('deleteAccount.alerts.success'), position: 'top' });
      } catch (error: any) {
        showToast({ type: 'error', message: t('deleteAccount.alerts.failed'), position: 'top' });
      }
    });
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      showToast({ type: 'error', message: tCommon('error'), position: 'top' });
    });
  };

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setShowLanguageSelector(false);
  };

  const isSocialAccount = user?.provider && user.provider !== 'email';

  const styles = createStyles(theme, isDark);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Icon name="account-circle" size={100} color={theme.colors.primary} />
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.account')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => { setEditName(user?.name || ''); setShowEditProfile(true); }}>
          <Icon name="account-edit-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.editProfile')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {!isSocialAccount && (
          <TouchableOpacity style={styles.menuItem} onPress={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowChangePassword(true); }}>
            <Icon name="lock-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.menuText}>{t('menu.changePassword')}</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.settings')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguageSelector(true)}>
          <Icon name="translate" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.language')}</Text>
          <Text style={styles.menuValue}>{LANGUAGE_LABELS[getCurrentLanguage()]}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.menuItem}>
          <Icon name="theme-light-dark" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.darkMode')}</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={isDark ? theme.colors.white : theme.colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.support')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('mailto:support@travelplanner.app')}>
          <Icon name="help-circle-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.help')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('https://travelplanner.app/terms')}>
          <Icon name="file-document-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.terms')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('https://travelplanner.app/privacy')}>
          <Icon name="shield-check-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.privacy')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: theme.spacing.xl }}>
        <Button
          variant="danger"
          icon="logout"
          fullWidth
          onPress={handleLogout}
          accessibilityLabel={t('logout.button')}
          accessibilityHint={t('logout.message')}
        >
          {t('logout.button')}
        </Button>
      </View>

      <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountText}>{t('deleteAccount.button')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('editProfile.title')}</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('editProfile.name')}</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('editProfile.namePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
              />
              <Button variant="primary" fullWidth onPress={handleSaveProfile} loading={isSaving} disabled={isSaving}>
                {t('editProfile.save')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('changePassword.title')}</Text>
              <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('changePassword.current')}</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={t('changePassword.currentPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('changePassword.new')}</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('changePassword.newPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('changePassword.confirm')}</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('changePassword.confirmPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <Button variant="primary" fullWidth onPress={handleChangePassword} loading={isSaving} disabled={isSaving}>
                {t('changePassword.submit')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Selector Modal */}
      <Modal visible={showLanguageSelector} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('languageSelector.title')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageSelector(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.languageDescription, { color: theme.colors.textSecondary }]}>
                {t('languageSelector.description')}
              </Text>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = getCurrentLanguage() === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.languageOption,
                      { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                      isSelected && { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] },
                    ]}
                    onPress={() => handleLanguageChange(lang)}
                  >
                    <Text style={[styles.languageLabel, { color: theme.colors.text }]}>
                      {LANGUAGE_LABELS[lang]}
                    </Text>
                    {isSelected && (
                      <Icon name="check-circle" size={22} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  profileHeader: {
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    padding: theme.spacing.xl,
    ...theme.shadows.sm,
  },
  avatarContainer: {
    marginBottom: theme.spacing.md,
  },
  name: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  email: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  section: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuText: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  menuValue: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  logoutText: {
    ...theme.typography.button,
    color: theme.colors.error,
    marginLeft: theme.spacing.sm,
  },
  deleteAccount: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  deleteAccountText: {
    ...theme.typography.caption,
    color: theme.colors.error || colors.error?.main || '#EF4444',
    textDecorationLine: 'underline',
  },
  version: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  modalInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  languageDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ProfileScreen;
