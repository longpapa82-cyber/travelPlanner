import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { ProfileStackParamList } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'UserManagement'>;

const PROVIDER_ICONS: Record<string, string> = {
  email: 'email-outline',
  google: 'google',
  apple: 'apple',
  kakao: 'chat',
};

const UserManagementScreen: React.FC<Props> = () => {
  const { t } = useTranslation('admin');
  const { isDark, theme } = useTheme();

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getAdminUserStats();
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async (p = 1, reset = false) => {
    try {
      if (p === 1) setLoading(true);
      const data = await apiService.getAdminUsers({
        page: p, limit: 20, search: search || undefined, provider: provider || undefined,
      });
      setUsers(reset ? data.users : [...users, ...data.users]);
      setTotalPages(data.totalPages);
      setPage(p);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, provider]);

  useEffect(() => { fetchStats(); fetchUsers(1, true); }, [search, provider]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
    fetchUsers(1, true);
  }, [fetchStats, fetchUsers]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('users.never');
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const styles = createStyles(theme, isDark);

  const renderStatCards = () => {
    if (!stats) return null;
    const cards = [
      { label: t('users.totalUsers'), value: stats.totalUsers, color: '#3B82F6' },
      { label: t('users.todaySignups'), value: stats.todaySignups, color: '#10B981' },
      { label: t('users.todayActive'), value: stats.todayActive, color: '#F59E0B' },
      { label: t('users.weeklyActive'), value: stats.weeklyActive, color: '#8B5CF6' },
    ];
    return (
      <View style={styles.statsRow}>
        {cards.map((c) => (
          <View key={c.label} style={[styles.statCard, { backgroundColor: theme.colors.white }]}>
            <Text style={[styles.statValue, { color: c.color }]}>{c.value}{t('users.people')}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{c.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderProviderFilter = () => {
    const filters = ['', 'email', 'google', 'kakao', 'apple'];
    const labels = [t('users.allProviders'), 'Email', 'Google', 'Kakao', 'Apple'];
    return (
      <View style={styles.filterRow}>
        {filters.map((f, i) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, provider === f && { backgroundColor: theme.colors.primary }]}
            onPress={() => setProvider(f)}
          >
            <Text style={[styles.filterText, provider === f && { color: '#fff' }]}>{labels[i]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderUser = ({ item }: { item: any }) => (
    <View style={[styles.userRow, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Icon name={(PROVIDER_ICONS[item.provider] || 'account') as any} size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.userName, { color: theme.colors.text }]}>{item.name}</Text>
        </View>
        <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{item.email}</Text>
      </View>
      <View style={styles.userMeta}>
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {t('users.lastLogin')}: {formatDate(item.lastLoginAt)}
        </Text>
        <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
          {t('users.signupDate')}: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <>
            {renderStatCards()}
            {stats?.providerStats && (
              <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                  {t('users.providerBreakdown')}
                </Text>
                <View style={styles.providerRow}>
                  {stats.providerStats.map((p: any) => (
                    <View key={p.provider} style={styles.providerItem}>
                      <Icon name={(PROVIDER_ICONS[p.provider] || 'account') as any} size={20} color={theme.colors.primary} />
                      <Text style={[styles.providerCount, { color: theme.colors.text }]}>{p.count}</Text>
                      <Text style={[styles.providerLabel, { color: theme.colors.textSecondary }]}>{p.provider}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                {t('users.memberList')}
              </Text>
              <View style={styles.searchBar}>
                <Icon name="magnify" size={18} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder={t('users.searchPlaceholder')}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
              </View>
              {renderProviderFilter()}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ padding: 40 }} color={theme.colors.primary} />
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textSecondary }}>{t('users.noUsers')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          page < totalPages ? (
            <TouchableOpacity
              style={[styles.loadMore, { borderColor: theme.colors.border }]}
              onPress={() => fetchUsers(page + 1)}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{t('users.loadMore')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
    statCard: {
      flex: 1, minWidth: '45%', padding: 14, borderRadius: 12, alignItems: 'center',
      ...theme.shadows.sm,
    },
    statValue: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 11, marginTop: 2 },
    section: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, ...theme.shadows.sm },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    providerRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
    providerItem: { alignItems: 'center', gap: 4 },
    providerCount: { fontSize: 18, fontWeight: '700' },
    providerLabel: { fontSize: 11, textTransform: 'capitalize' },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    },
    searchInput: { flex: 1, fontSize: 14, padding: 0 },
    filterRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
    filterChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
    },
    filterText: { fontSize: 12, fontWeight: '500', color: isDark ? colors.neutral[300] : colors.neutral[600] },
    userRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.white,
    },
    userInfo: { flex: 1, gap: 2 },
    userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    userName: { fontSize: 15, fontWeight: '600' },
    userEmail: { fontSize: 12 },
    userMeta: { alignItems: 'flex-end', gap: 2 },
    metaText: { fontSize: 11 },
    loadMore: {
      alignItems: 'center', padding: 14, margin: 16,
      borderWidth: 1, borderRadius: 12,
    },
  });

export default UserManagementScreen;
