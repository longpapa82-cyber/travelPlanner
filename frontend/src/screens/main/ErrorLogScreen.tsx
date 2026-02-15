import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { ProfileStackParamList } from '../../types';
import apiService from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ErrorLog'>;

const SEVERITY_COLORS: Record<string, string> = {
  error: '#EF4444',
  warning: '#F59E0B',
  fatal: '#DC2626',
};

const ErrorLogScreen: React.FC<Props> = () => {
  const { t } = useTranslation('admin');
  const { isDark, theme } = useTheme();

  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severity, setSeverity] = useState('');
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiService.getAdminErrorLogStats();
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchLogs = useCallback(async (p = 1, reset = false) => {
    try {
      if (p === 1) setLoading(true);
      const data = await apiService.getAdminErrorLogs({
        page: p, limit: 20,
        severity: severity || undefined,
        resolved: unresolvedOnly ? false : undefined,
      });
      setLogs(reset ? data.logs : [...logs, ...data.logs]);
      setTotalPages(data.totalPages);
      setPage(p);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severity, unresolvedOnly]);

  useEffect(() => { fetchStats(); fetchLogs(1, true); }, [severity, unresolvedOnly]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
    fetchLogs(1, true);
  }, [fetchStats, fetchLogs]);

  const handleResolve = async (id: string) => {
    try {
      await apiService.resolveErrorLog(id);
      setLogs(logs.map((l) => (l.id === id ? { ...l, isResolved: true } : l)));
      fetchStats();
    } catch { /* ignore */ }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const styles = createStyles(theme, isDark);

  const renderStatCards = () => {
    if (!stats) return null;
    const cards = [
      { label: t('errors.todayErrors'), value: stats.todayErrors, color: '#EF4444' },
      { label: t('errors.weeklyErrors'), value: stats.weeklyErrors, color: '#F59E0B' },
      { label: t('errors.unresolved'), value: stats.unresolvedErrors, color: '#DC2626' },
      { label: t('errors.affectedUsers'), value: `${stats.affectedUsers}${t('errors.people')}`, color: '#8B5CF6' },
    ];
    return (
      <View style={styles.statsRow}>
        {cards.map((c) => (
          <View key={c.label} style={[styles.statCard, { backgroundColor: theme.colors.white }]}>
            <Text style={[styles.statValue, { color: c.color }]}>{c.value}{typeof c.value === 'number' ? t('errors.count') : ''}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{c.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderFilters = () => {
    const severities = ['', 'error', 'warning', 'fatal'];
    const labels = [t('errors.allSeverity'), t('errors.error'), t('errors.warning'), t('errors.fatal')];
    return (
      <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
        <View style={styles.filterRow}>
          {severities.map((s, i) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, severity === s && { backgroundColor: SEVERITY_COLORS[s] || theme.colors.primary }]}
              onPress={() => setSeverity(s)}
            >
              <Text style={[styles.filterText, severity === s && { color: '#fff' }]}>{labels[i]}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.filterChip, unresolvedOnly && { backgroundColor: theme.colors.primary }]}
            onPress={() => setUnresolvedOnly(!unresolvedOnly)}
          >
            <Text style={[styles.filterText, unresolvedOnly && { color: '#fff' }]}>{t('errors.unresolvedOnly')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTopErrors = () => {
    if (!stats?.topErrors?.length) return null;
    return (
      <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
          {t('errors.topErrors')}
        </Text>
        {stats.topErrors.slice(0, 5).map((err: any, i: number) => (
          <View key={i} style={[styles.topErrorRow, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.topErrorInfo}>
              <Text style={[styles.topErrorMsg, { color: theme.colors.text }]} numberOfLines={1}>
                {err.message}
              </Text>
              {err.screen && (
                <Text style={[styles.topErrorScreen, { color: theme.colors.textSecondary }]}>
                  {err.screen}
                </Text>
              )}
            </View>
            <Text style={[styles.topErrorCount, { color: '#EF4444' }]}>
              {err.count}{t('errors.occurrences')}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderLog = ({ item }: { item: any }) => {
    const isExpanded = expandedLog === item.id;
    return (
      <TouchableOpacity
        style={[styles.logRow, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.white }]}
        onPress={() => setExpandedLog(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.logHeader}>
          <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[item.severity] || '#EF4444' }]}>
            <Text style={styles.severityText}>{item.severity}</Text>
          </View>
          <Text style={[styles.logMessage, { color: theme.colors.text }]} numberOfLines={isExpanded ? undefined : 1}>
            {item.errorMessage}
          </Text>
        </View>
        <View style={styles.logMeta}>
          {item.screen && (
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              {t('errors.screen')}: {item.screen}
            </Text>
          )}
          <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
        {isExpanded && (
          <View style={styles.logDetail}>
            {item.stackTrace && (
              <Text style={[styles.stackTrace, { color: theme.colors.textSecondary }]} numberOfLines={8}>
                {item.stackTrace}
              </Text>
            )}
            <View style={styles.logDetailRow}>
              {item.userEmail && <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{item.userEmail}</Text>}
              {item.deviceOS && <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{t('errors.device')}: {item.deviceOS}</Text>}
              {item.appVersion && <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{t('errors.version')}: {item.appVersion}</Text>}
            </View>
            {!item.isResolved && (
              <TouchableOpacity
                style={[styles.resolveButton, { backgroundColor: '#10B981' }]}
                onPress={() => handleResolve(item.id)}
              >
                <Icon name="check" size={16} color="#fff" />
                <Text style={styles.resolveText}>{t('errors.resolve')}</Text>
              </TouchableOpacity>
            )}
            {item.isResolved && (
              <View style={styles.resolvedBadge}>
                <Icon name="check-circle" size={16} color="#10B981" />
                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>{t('errors.resolved')}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLog}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <>
            {renderStatCards()}
            {renderTopErrors()}
            {renderFilters()}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ padding: 40 }} color={theme.colors.primary} />
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Icon name="check-circle-outline" size={40} color="#10B981" />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>{t('errors.noErrors')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          page < totalPages ? (
            <TouchableOpacity
              style={[styles.loadMore, { borderColor: theme.colors.border }]}
              onPress={() => fetchLogs(page + 1)}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{t('errors.loadMore')}</Text>
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
    statValue: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 11, marginTop: 2 },
    section: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, ...theme.shadows.sm },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
    filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    filterChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100],
    },
    filterText: { fontSize: 12, fontWeight: '500', color: isDark ? colors.neutral[300] : colors.neutral[600] },
    topErrorRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topErrorInfo: { flex: 1, gap: 2 },
    topErrorMsg: { fontSize: 13, fontWeight: '500' },
    topErrorScreen: { fontSize: 11 },
    topErrorCount: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
    logRow: {
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    logHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    severityText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    logMessage: { flex: 1, fontSize: 14, fontWeight: '500' },
    logMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    metaText: { fontSize: 11 },
    logDetail: { marginTop: 10, gap: 8 },
    stackTrace: {
      fontSize: 11, fontFamily: 'monospace', lineHeight: 16,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      padding: 10, borderRadius: 8,
    },
    logDetailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    resolveButton: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6,
    },
    resolveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    resolvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    loadMore: {
      alignItems: 'center', padding: 14, margin: 16,
      borderWidth: 1, borderRadius: 12,
    },
  });

export default ErrorLogScreen;
