import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Modal,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { changeLanguage, getCurrentLanguage, LANGUAGE_FLAGS, LANGUAGE_LABELS, SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { useConfirm } from '../../components/feedback/ConfirmDialog';
import Button from '../../components/core/Button';
import EmailVerificationBanner from '../../components/feedback/EmailVerificationBanner';
import PremiumBadge from '../../components/PremiumBadge';
import { usePremium } from '../../contexts/PremiumContext';
import { PREMIUM_ENABLED } from '../../constants/config';
import apiService from '../../services/api';
import { useTutorial } from '../../contexts/TutorialContext';
import * as Notifications from 'expo-notifications';
import { ensureAbsoluteUrl } from '../../utils/images';

const ProfileScreen = ({ navigation }: any) => {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');
  const { user, logout, refreshUser } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { isPremium, isServiceAdmin, showPaywall, aiTripsRemaining, aiTripsLimit, aiTripsUsed, markLoggingOut } = usePremium();
  const { t: tPremium } = useTranslation('premium');
  const { t: tTutorial } = useTranslation('tutorial');
  const { resetTutorial } = useTutorial();

  // Modal states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Photo upload state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Analytics states
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await apiService.getUserStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), refreshUser()]);
    setIsRefreshing(false);
  }, [fetchStats, refreshUser]);

  const handleLogout = async () => {
    const ok = await confirm({
      title: t('logout.title'),
      message: t('logout.message'),
      confirmText: tCommon('confirm'),
      cancelText: tCommon('cancel'),
    });
    if (ok) {
      markLoggingOut(); // Suppress ads during logout transition
      logout();
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showToast({ type: 'warning', message: t('editProfile.alerts.nameRequired'), position: 'top' });
      return;
    }
    setIsSaving(true);
    try {
      await apiService.updateProfile({ name: editName.trim() });
      await refreshUser();
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

  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (user?.provider === 'email') {
      setDeletePassword('');
      setShowDeleteConfirm(true);
      return;
    }
    // OAuth users — no password needed, just confirm
    const ok = await confirm({
      title: t('deleteAccount.title'),
      message: t('deleteAccount.message'),
      confirmText: tCommon('confirm'),
      cancelText: tCommon('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiService.deleteAccount();
      markLoggingOut();
      await logout();
      showToast({ type: 'success', message: t('deleteAccount.alerts.success'), position: 'top' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('deleteAccount.alerts.failed'), position: 'top' });
    }
  };

  const handleConfirmDelete = async () => {
    Keyboard.dismiss();
    if (!deletePassword.trim()) {
      showToast({ type: 'warning', message: t('deleteAccount.alerts.passwordRequired'), position: 'top' });
      return;
    }
    setIsDeleting(true);
    try {
      await apiService.deleteAccount(deletePassword);
      setShowDeleteConfirm(false);
      markLoggingOut();
      await logout();
      showToast({ type: 'success', message: t('deleteAccount.alerts.success'), position: 'top' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('deleteAccount.alerts.failed'), position: 'top' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await apiService.exportMyData();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mytravel-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const { shareAsync } = await import('expo-sharing');
        // eslint-disable-next-line import/no-unresolved
        const { writeAsStringAsync, documentDirectory } = await import('expo-file-system');
        const filePath = `${documentDirectory}mytravel-data-${new Date().toISOString().split('T')[0]}.json`;
        await writeAsStringAsync(filePath, JSON.stringify(data, null, 2));
        await shareAsync(filePath, { mimeType: 'application/json' });
      }
      showToast({ type: 'success', message: t('exportData.success'), position: 'top' });
    } catch (error: any) {
      showToast({ type: 'error', message: error?.response?.data?.message || t('exportData.failed'), position: 'top' });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePickProfilePhoto = async () => {
    if (isUploadingPhoto) return;
    try {
      if (Platform.OS === 'android') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            t('editProfile.photoPermission.title', '사진 접근 권한'),
            t('editProfile.photoPermission.message', '프로필 사진 변경을 위해 사진 라이브러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.'),
            [
              { text: tCommon('cancel', '취소'), style: 'cancel' },
              { text: t('editProfile.photoPermission.openSettings', '설정 열기'), onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      // Upload immediately — Android Activity lifecycle can destroy component state
      // between picker return and modal display, causing the preview modal to auto-close
      setIsUploadingPhoto(true);
      showToast({ type: 'info', message: t('editProfile.alerts.photoUploading', '프로필 사진을 업로드 중입니다...'), position: 'top' });
      await apiService.uploadProfilePhoto(result.assets[0].uri);
      await refreshUser();
      showToast({ type: 'success', message: t('editProfile.alerts.photoSuccess'), position: 'top' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('editProfile.alerts.photoFailed'), position: 'top' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleConfirmProfilePhoto = async () => {
    if (!selectedImageUri || isUploadingPhoto) return;

    try {
      setIsUploadingPhoto(true);
      const uploaded = await apiService.uploadProfilePhoto(selectedImageUri);
      // No need to call updateProfile separately, the backend already updates it
      await refreshUser();
      showToast({ type: 'success', message: t('editProfile.alerts.photoSuccess'), position: 'top' });
      setShowImagePreview(false);
      setSelectedImageUri(null);
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || t('editProfile.alerts.photoFailed'), position: 'top' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCancelProfilePhoto = () => {
    setShowImagePreview(false);
    setSelectedImageUri(null);
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

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* 이메일 인증 배너 비활성화 — 추후 필요 시 복원
      <EmailVerificationBanner />
      */}
      <View style={styles.profileHeader}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickProfilePhoto}
          disabled={isUploadingPhoto}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('editProfile.changePhoto')}
        >
          {user?.profileImage ? (
            <Image source={{ uri: ensureAbsoluteUrl(user.profileImage) }} style={styles.avatarImage} />
          ) : (
            <Icon name="account-circle" size={100} color={theme.colors.primary} />
          )}
          <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary }]}>
            {isUploadingPhoto ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="camera" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.name} testID="profile-name">{user?.name}</Text>
        <Text style={styles.email} testID="profile-email">{user?.email}</Text>
      </View>

      {/* Analytics Dashboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('analytics.title')}</Text>
        {statsLoading ? (
          <View style={{ padding: 16, gap: 16 }}>
            {/* Trip counts skeleton */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100], borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 32, height: 28, borderRadius: 6, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }} />
                  <View style={{ width: 48, height: 12, borderRadius: 4, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }} />
                </View>
              ))}
            </View>
            {/* Key stats skeleton */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100], borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }} />
                  <View style={{ width: 36, height: 18, borderRadius: 4, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }} />
                  <View style={{ width: 48, height: 12, borderRadius: 4, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] }} />
                </View>
              ))}
            </View>
          </View>
        ) : stats && stats.totalTrips > 0 ? (
          <View style={{ padding: 16, gap: 16 }}>
            {/* Trip counts row */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: t('analytics.completedTrips'), value: stats.completedTrips, color: colors.success?.main || '#22C55E' },
                { label: t('analytics.ongoingTrips'), value: stats.ongoingTrips, color: colors.primary?.[500] || '#3B82F6' },
                { label: t('analytics.upcomingTrips'), value: stats.upcomingTrips, color: colors.warning?.main || '#F59E0B' },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50], borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: item.color }}>{item.value}</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Key stats row */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { icon: 'calendar-range' as const, label: t('analytics.totalDays'), value: `${stats.totalDays}${t('analytics.days')}` },
                { icon: 'earth' as const, label: t('analytics.countriesVisited'), value: `${stats.countriesVisited}${t('analytics.countries')}` },
                { icon: 'clock-outline' as const, label: t('analytics.avgDuration'), value: `${stats.avgDuration}${t('analytics.days')}` },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50], borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Icon name={item.icon} size={20} color={theme.colors.primary} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text, marginTop: 4 }}>{item.value}</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Budget info */}
            {stats.totalSpent > 0 && (
              <View style={{ backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50], borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{t('analytics.totalSpent')}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>
                    ${stats.totalSpent.toLocaleString()}
                  </Text>
                </View>
                {stats.totalBudget > 0 && (
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{t('analytics.totalBudget')}</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>
                      ${stats.totalBudget.toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Top destinations */}
            {stats.topDestinations?.length > 0 && (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 }}>{t('analytics.topDestinations')}</Text>
                {stats.topDestinations.map((dest: any) => (
                  <View key={dest.destination} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                    <Icon name="map-marker" size={16} color={theme.colors.primary} />
                    <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text }}>{dest.destination}</Text>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>{dest.count}{t('analytics.times')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Activities completion */}
            {stats.totalActivities > 0 && (
              <View style={{ backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50], borderRadius: 12, padding: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 }}>{t('analytics.activities')}</Text>
                <View style={{ height: 6, backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200], borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, backgroundColor: colors.success?.main || '#22C55E', borderRadius: 3, width: `${(stats.completedActivities / stats.totalActivities) * 100}%` }} />
                </View>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 6 }}>
                  {t('analytics.completedOf', { completed: stats.completedActivities, total: stats.totalActivities })}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Icon name="chart-line" size={40} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 8 }}>{t('analytics.noData')}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.account')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => { setEditName(user?.name || ''); setShowEditProfile(true); }} accessibilityRole="button" accessibilityLabel={t('menu.editProfile')}>
          <Icon name="account-edit-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.editProfile')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {!isSocialAccount && (
          <TouchableOpacity style={styles.menuItem} onPress={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowChangePassword(true); }} accessibilityRole="button" accessibilityLabel={t('menu.changePassword')}>
            <Icon name="lock-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.menuText}>{t('menu.changePassword')}</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* 2단계 인증 — 추후 제공 예정
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('TwoFactorSettings')}
          accessibilityRole="button"
          accessibilityLabel={t('menu.twoFactor')}
        >
          <Icon name="shield-lock-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.twoFactor')}</Text>
          <Text style={[styles.menuValue, { color: user?.isTwoFactorEnabled ? colors.success.main : theme.colors.textSecondary }]}>
            {user?.isTwoFactorEnabled ? t('menu.twoFactorEnabled') : t('menu.twoFactorDisabled')}
          </Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        */}

        {PREMIUM_ENABLED && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => isPremium ? navigation.navigate('Subscription') : showPaywall('general')}
            accessibilityRole="button"
            accessibilityLabel={tPremium('menu.subscription')}
          >
            <Icon name="crown" size={24} color="#F59E0B" />
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text style={[styles.menuText, { marginLeft: 0 }]}>{tPremium('menu.subscription')}</Text>
              {!isPremium && (
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                  {tPremium('menu.aiRemaining', {
                    remaining: aiTripsRemaining >= 0 ? aiTripsRemaining : '\u221E',
                    total: aiTripsLimit > 0 ? aiTripsLimit : 3,
                  })}
                </Text>
              )}
            </View>
            {isPremium ? (
              <PremiumBadge size="small" />
            ) : (
              <View style={styles.upgradeBadge}>
                <Text style={styles.upgradeBadgeText}>Upgrade</Text>
              </View>
            )}
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.settings')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguageSelector(true)} accessibilityRole="button" accessibilityLabel={t('menu.language')}>
          <Icon name="translate" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.language')}</Text>
          <Text style={styles.menuValue}>{LANGUAGE_FLAGS[getCurrentLanguage()]} {LANGUAGE_LABELS[getCurrentLanguage()]}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={async () => {
            await resetTutorial();
            showToast({ type: 'success', message: tTutorial('settings.resetTutorial'), position: 'top' });
          }}
          accessibilityRole="button"
          accessibilityLabel={tTutorial('settings.resetTutorial')}
        >
          <Icon name="school-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{tTutorial('settings.resetTutorial')}</Text>
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
            accessibilityLabel={t('menu.darkMode')}
            accessibilityRole="switch"
          />
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={async () => {
            if (Platform.OS === 'web') return;
            Alert.alert(
              t('settings.notifications.title', '알림 설정'),
              t('settings.notifications.manageInSettings', '알림 설정은 시스템 설정에서 관리할 수 있습니다.'),
              [
                { text: tCommon('ok', '확인'), style: 'cancel' },
                { text: t('settings.notifications.openSettings', '설정 열기'), onPress: () => Linking.openSettings() },
              ],
            );
          }}
          accessibilityRole="button"
        >
          <Icon name="bell-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('settings.notifications.title', '알림 설정')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={async () => {
            const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
            if (status === 'granted') {
              Alert.alert(
                t('settings.photos.title', '사진 접근 설정'),
                t('settings.photos.alreadyEnabled', '사진 접근이 이미 허용되어 있습니다. 시스템 설정에서 변경할 수 있습니다.'),
                [
                  { text: tCommon('ok', '확인'), style: 'cancel' },
                  { text: t('settings.photos.openSettings', '설정 열기'), onPress: () => Linking.openSettings() },
                ],
              );
            } else {
              const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (newStatus === 'granted') {
                showToast({ type: 'success', message: t('settings.photos.enabled', '사진 접근이 허용되었습니다'), position: 'top' });
              } else {
                Alert.alert(
                  t('settings.photos.title', '사진 접근 설정'),
                  t('settings.photos.denied', '사진 접근 권한이 거부되었습니다. 시스템 설정에서 허용해주세요.'),
                  [
                    { text: tCommon('ok', '확인'), style: 'cancel' },
                    { text: t('settings.photos.openSettings', '설정 열기'), onPress: () => Linking.openSettings() },
                  ],
                );
              }
            }
          }}
          accessibilityRole="button"
        >
          <Icon name="image-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('settings.photos.title', '사진 접근 설정')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isServiceAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sections.admin')}</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AdminDashboard')} accessibilityRole="button" accessibilityLabel={t('menu.admin')}>
            <Icon name="shield-crown-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.menuText}>{t('menu.admin')}</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.support')}</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Help')} accessibilityRole="button" accessibilityLabel={t('menu.help')}>
          <Icon name="help-circle-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.help')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Terms')} accessibilityRole="button" accessibilityLabel={t('menu.terms')}>
          <Icon name="file-document-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.terms')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PrivacyPolicy')} accessibilityRole="button" accessibilityLabel={t('menu.privacy')}>
          <Icon name="shield-check-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.privacy')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('https://mytravel-planner.com/licenses')} accessibilityRole="button" accessibilityLabel={t('menu.licenses')}>
          <Icon name="code-tags" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('menu.licenses')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Data & Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('sections.dataPrivacy')}</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleExportData}
          disabled={isExporting}
          accessibilityRole="button"
          accessibilityLabel={t('exportData.button')}
        >
          <Icon name="download-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>{t('exportData.button')}</Text>
          {isExporting ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount} accessibilityRole="button" accessibilityLabel={t('deleteAccount.button')}>
          <Icon name="delete-outline" size={24} color={colors.error.main} />
          <Text style={[styles.menuText, { color: colors.error.main }]}>{t('deleteAccount.button')}</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: theme.spacing.xl }}>
        <Button
          variant="outline"
          icon="logout"
          fullWidth
          onPress={handleLogout}
          accessibilityLabel={t('logout.button')}
          accessibilityHint={t('logout.message')}
        >
          {t('logout.button')}
        </Button>
      </View>

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
                autoComplete="off"
                importantForAutofill="no"
                autoCapitalize="none"
              />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('changePassword.new')}</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('changePassword.newPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                autoComplete="off"
                importantForAutofill="no"
                autoCapitalize="none"
              />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('changePassword.confirm')}</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('changePassword.confirmPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                autoComplete="off"
                importantForAutofill="no"
                autoCapitalize="none"
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
                      {LANGUAGE_FLAGS[lang]}  {LANGUAGE_LABELS[lang]}
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

      {/* Delete Account (회원 탈퇴) Password Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="slide" onRequestClose={() => setShowDeleteConfirm(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalOverlay}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.error.main }]}>{t('deleteAccount.title')}</Text>
                <TouchableOpacity onPress={() => setShowDeleteConfirm(false)}>
                  <Icon name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{t('deleteAccount.passwordConfirm')}</Text>
                <TextInput
                  style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder={t('deleteAccount.passwordPlaceholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoComplete="off"
                  importantForAutofill="no"
                  autoCapitalize="none"
                  editable={!isDeleting}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmDelete}
                />
                <Button variant="primary" fullWidth onPress={handleConfirmDelete} loading={isDeleting} disabled={isDeleting}
                  style={{ backgroundColor: colors.error.main }}>
                  {t('deleteAccount.button')}
                </Button>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile Photo Preview Modal */}
      <Modal visible={showImagePreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t('editProfile.previewTitle', { defaultValue: '프로필 사진 설정' })}</Text>
              <TouchableOpacity onPress={handleCancelProfilePhoto} disabled={isUploadingPhoto}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {selectedImageUri && (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: selectedImageUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.previewHint, { color: theme.colors.textSecondary }]}>
                    {t('editProfile.previewHint', { defaultValue: '선택한 사진을 프로필 사진으로 설정하시겠습니까?' })}
                  </Text>
                </View>
              )}
              <View style={styles.buttonRow}>
                <Button
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={handleCancelProfilePhoto}
                  disabled={isUploadingPhoto}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="primary"
                  style={{ flex: 1 }}
                  onPress={handleConfirmProfilePhoto}
                  loading={isUploadingPhoto}
                  disabled={isUploadingPhoto}
                >
                  {t('editProfile.confirmPhoto', { defaultValue: '저장' })}
                </Button>
              </View>
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
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
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
  upgradeBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 4,
  },
  upgradeBadgeText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
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
    color: colors.neutral[400],
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
  // V115 (V114-3 fix): 기존 minHeight 400 + justifyContent 'space-between'
  // 조합이 내용이 짧은 팝업(계정 삭제 확인 등)에서 400px 박스 중앙에 큰
  // 흰 공백을 만들었음. 내용 크기에 맞춰 자동 축소하도록 변경.
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '90%',
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
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    flex: 1,
    justifyContent: 'center',
  },
  previewImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  previewHint: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
    gap: 12,
  },
});

export default ProfileScreen;
