import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { ProfileStackParamList } from '../../types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AdminDashboard'>;

const MENU_ITEMS = [
  { key: 'users', icon: 'account-group', screen: 'UserManagement' as const, color: '#3B82F6' },
  { key: 'errorLogs', icon: 'bug-outline', screen: 'ErrorLog' as const, color: '#EF4444' },
  { key: 'revenue', icon: 'chart-line', screen: 'RevenueDashboard' as const, color: '#10B981' },
] as const;

const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation('admin');
  const { isDark, theme } = useTheme();
  const styles = createStyles(theme, isDark);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="shield-crown-outline" size={36} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('title')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {t('dashboard.subtitle')}
        </Text>
      </View>

      <View style={styles.menuGrid}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuCard, { backgroundColor: theme.colors.white }]}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t(`menu.${item.key}`)}
          >
            <View style={[styles.iconCircle, { backgroundColor: item.color + '15' }]}>
              <Icon name={item.icon as any} size={28} color={item.color} />
            </View>
            <Text style={[styles.menuLabel, { color: theme.colors.text }]}>
              {t(`menu.${item.key}`)}
            </Text>
            <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const createStyles = (theme: any, _isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      backgroundColor: theme.colors.white,
      alignItems: 'center',
      paddingVertical: 28,
      gap: 6,
      ...theme.shadows.sm,
    },
    title: { fontSize: 22, fontWeight: '700', marginTop: 4 },
    subtitle: { fontSize: 14 },
    menuGrid: { padding: 16, gap: 12 },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      borderRadius: 14,
      gap: 14,
      ...theme.shadows.sm,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  });

export default AdminDashboardScreen;
