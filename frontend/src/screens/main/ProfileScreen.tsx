import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Button from '../../components/core/Button';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();

  const handleLogout = () => {
    // 웹 환경 확인
    if (typeof window !== 'undefined' && window.confirm) {
      // 웹 환경
      if (window.confirm('정말 로그아웃 하시겠습니까?')) {
        logout();
      }
    } else {
      // 네이티브 환경
      Alert.alert(
        '로그아웃',
        '정말 로그아웃 하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '로그아웃',
            style: 'destructive',
            onPress: logout
          }
        ]
      );
    }
  };

  const styles = createStyles(theme);

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

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="account-edit-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>프로필 수정</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="lock-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>비밀번호 변경</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
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

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="bell-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>알림 설정</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="translate" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>언어 설정</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>지원</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="help-circle-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>도움말</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Icon name="file-document-outline" size={24} color={theme.colors.textSecondary} />
          <Text style={styles.menuText}>이용약관</Text>
          <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
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

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
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
  version: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
});

export default ProfileScreen;
