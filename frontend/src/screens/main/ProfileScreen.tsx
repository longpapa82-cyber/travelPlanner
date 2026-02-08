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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import Button from '../../components/core/Button';
import apiService from '../../services/api';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const { showToast } = useToast();

  // Modal states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
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
        { text: '취소', style: 'cancel' },
        { text: '확인', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleLogout = () => {
    confirm('로그아웃', '정말 로그아웃 하시겠습니까?', logout);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showToast({ type: 'warning', message: '이름을 입력해주세요.', position: 'top' });
      return;
    }
    setIsSaving(true);
    try {
      await apiService.updateProfile({ name: editName.trim() });
      showToast({ type: 'success', message: '프로필이 수정되었습니다.', position: 'top' });
      setShowEditProfile(false);
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || '수정에 실패했습니다.', position: 'top' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast({ type: 'warning', message: '모든 필드를 입력해주세요.', position: 'top' });
      return;
    }
    if (newPassword.length < 8) {
      showToast({ type: 'warning', message: '새 비밀번호는 8자 이상이어야 합니다.', position: 'top' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ type: 'warning', message: '새 비밀번호가 일치하지 않습니다.', position: 'top' });
      return;
    }
    setIsSaving(true);
    try {
      await apiService.changePassword(currentPassword, newPassword);
      showToast({ type: 'success', message: '비밀번호가 변경되었습니다.', position: 'top' });
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showToast({ type: 'error', message: error.response?.data?.message || '비밀번호 변경에 실패했습니다.', position: 'top' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    confirm('계정 삭제', '정말 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.', async () => {
      try {
        await apiService.deleteAccount();
        await logout();
        showToast({ type: 'success', message: '계정이 삭제되었습니다.', position: 'top' });
      } catch (error: any) {
        showToast({ type: 'error', message: '계정 삭제에 실패했습니다.', position: 'top' });
      }
    });
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      showToast({ type: 'error', message: '링크를 열 수 없습니다.', position: 'top' });
    });
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
        <Text style={styles.sectionTitle}>계정 정보</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => { setEditName(user?.name || ''); setShowEditProfile(true); }}>
          <Icon name="account-edit-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>프로필 수정</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {!isSocialAccount && (
          <TouchableOpacity style={styles.menuItem} onPress={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowChangePassword(true); }}>
            <Icon name="lock-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={styles.menuText}>비밀번호 변경</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 설정</Text>

        <View style={styles.menuItem}>
          <Icon name="theme-light-dark" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>다크 모드</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={isDark ? theme.colors.white : theme.colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>지원</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('mailto:support@travelplanner.app')}>
          <Icon name="help-circle-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>도움말</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('https://travelplanner.app/terms')}>
          <Icon name="file-document-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>이용약관</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => openUrl('https://travelplanner.app/privacy')}>
          <Icon name="shield-check-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>개인정보 처리방침</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: theme.spacing.xl }}>
        <Button
          variant="danger"
          icon="logout"
          fullWidth
          onPress={handleLogout}
          accessibilityLabel="로그아웃"
          accessibilityHint="앱에서 로그아웃합니다"
        >
          로그아웃
        </Button>
      </View>

      <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountText}>계정 삭제</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[0] }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>프로필 수정</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>이름</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="이름을 입력하세요"
                placeholderTextColor={theme.colors.textSecondary}
              />
              <Button variant="primary" fullWidth onPress={handleSaveProfile} loading={isSaving} disabled={isSaving}>
                저장
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
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>비밀번호 변경</Text>
              <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                <Icon name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>현재 비밀번호</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="현재 비밀번호"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>새 비밀번호</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="새 비밀번호 (8자 이상)"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>새 비밀번호 확인</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50] }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="새 비밀번호 확인"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
              />
              <Button variant="primary" fullWidth onPress={handleChangePassword} loading={isSaving} disabled={isSaving}>
                변경하기
              </Button>
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
});

export default ProfileScreen;
