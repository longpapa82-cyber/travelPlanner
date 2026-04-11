/**
 * ExpensesScreen v1.0 - Expense Splitting Feature
 *
 * Full-featured expense list with:
 * - Two tabs: Expenses list and Balances/Settlements view
 * - Summary card with total spent, my share, balance overview
 * - Swipe-to-delete / long-press delete for expenses
 * - Pull-to-refresh, loading skeleton, FAB for adding
 * - Dark mode support
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { TripsStackParamList, Expense, Balance, Settlement } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import { useConfirm } from '../../components/feedback/ConfirmDialog';
import apiService from '../../services/api';
import BalanceCard from '../../components/BalanceCard';
import SettlementSummary from '../../components/SettlementSummary';

type ExpensesScreenNavigationProp = NativeStackNavigationProp<TripsStackParamList, 'Expenses'>;
type ExpensesScreenRouteProp = RouteProp<TripsStackParamList, 'Expenses'>;

interface Props {
  navigation: ExpensesScreenNavigationProp;
  route: ExpensesScreenRouteProp;
}

const CATEGORY_ICONS: Record<string, string> = {
  food: 'silverware-fork-knife',
  transport: 'bus',
  accommodation: 'bed',
  activity: 'star',
  shopping: 'shopping',
  other: 'dots-horizontal',
};

const CATEGORY_COLORS: Record<string, string> = {
  food: '#F59E0B',
  transport: '#6366F1',
  accommodation: '#EF4444',
  activity: '#8B5CF6',
  shopping: '#EC4899',
  other: '#6B7280',
};

const formatCurrency = (amount: number | string, currency: string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const symbol =
    currency === 'KRW' ? '\u20A9' : currency === 'JPY' ? '\u00A5' : currency === 'EUR' ? '\u20AC' : '$';
  const decimals = currency === 'KRW' || currency === 'JPY' ? 0 : 2;
  const formatted = num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formatted}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ExpensesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tripId } = route.params;
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useTranslation('trips');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');

  // Fetch current user profile to get userId
  useEffect(() => {
    apiService
      .getProfile()
      .then((profile: { id: string }) => {
        setCurrentUserId(profile.id);
      })
      .catch(() => {});
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
      const data = await apiService.getExpenses(tripId);
      setExpenses(data);
    } catch {
      showToast({ type: 'error', message: t('detail.expenses.alerts.createFailed'), position: 'top' });
    }
  }, [tripId, showToast, t]);

  const fetchBalances = useCallback(async () => {
    try {
      const [balanceData, settlementData] = await Promise.all([
        apiService.getExpenseBalances(tripId),
        apiService.getExpenseSettlements(tripId),
      ]);
      setBalances(balanceData);
      setSettlements(settlementData);
    } catch {
      // Silently fail on balance fetch -- not critical
    }
  }, [tripId]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchExpenses(), fetchBalances()]);
  }, [fetchExpenses, fetchBalances]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchAll();
      setIsLoading(false);
    };
    load();
  }, [fetchAll]);

  // Refetch when screen regains focus (e.g., returning from AddExpense)
  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        fetchAll();
      }
    }, [fetchAll, isLoading]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  }, [fetchAll]);

  // Computed summary values
  const summary = useMemo(() => {
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    // 내가 결제한 총액
    const myPaid = expenses
      .filter((e) => e.paidByUserId === currentUserId)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    // 내가 부담해야 할 금액 (모든 경비에서 내 분할 합계)
    const myShare = expenses.reduce((sum, e) => {
      const mySplit = e.splits.find((s) => s.userId === currentUserId);
      return sum + (mySplit ? Number(mySplit.amount) : 0);
    }, 0);

    const myBalance = balances.find((b) => b.userId === currentUserId);
    const balanceAmount = myBalance ? Number(myBalance.balance) : 0;

    const settledCount = expenses.reduce((sum, e) => {
      const allSettled = e.splits.every((s) => s.isSettled);
      return sum + (allSettled ? 1 : 0);
    }, 0);

    const currency = expenses.length > 0 ? expenses[0].currency : 'USD';

    return { totalSpent, myPaid, myShare, balanceAmount, settledCount, totalExpenses: expenses.length, currency };
  }, [expenses, balances, currentUserId]);

  // Delete expense handler
  const handleDeleteExpense = useCallback(
    async (expenseId: string) => {
      const ok = await confirm({
        title: t('detail.expenses.alerts.deleteTitle'),
        message: t('detail.expenses.alerts.deleteMessage'),
        confirmText: t('detail.alerts.delete'),
        cancelText: t('detail.alerts.cancel'),
        destructive: true,
      });
      if (!ok) return;
      try {
        await apiService.deleteExpense(tripId, expenseId);
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
        fetchBalances();
        showToast({ type: 'success', message: t('detail.expenses.settledMark'), position: 'top', duration: 2000 });
      } catch {
        showToast({ type: 'error', message: t('detail.expenses.alerts.deleteFailed'), position: 'top' });
      }
    },
    [tripId, showToast, t, fetchBalances, confirm],
  );

  // Settle handler — settles splits for a specific from→to user pair
  const handleSettle = useCallback(
    async (fromUserId: string, toUserId: string) => {
      // Filter expenses where fromUser has unsettled splits AND toUser is the payer
      const expensesToSettle = expenses.filter((e) =>
        e.paidByUserId === toUserId &&
        e.splits.some((s) => s.userId === fromUserId && !s.isSettled),
      );

      if (expensesToSettle.length === 0) return;

      try {
        const results = await Promise.allSettled(
          expensesToSettle.map((e) => apiService.settleExpense(tripId, e.id, fromUserId)),
        );
        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        await fetchAll();
        if (succeeded > 0) {
          showToast({ type: 'success', message: t('detail.expenses.settledMark'), position: 'top', duration: 2000 });
        } else {
          showToast({ type: 'error', message: t('detail.expenses.alerts.settleFailed'), position: 'top' });
        }
      } catch {
        showToast({ type: 'error', message: t('detail.expenses.alerts.settleFailed'), position: 'top' });
      }
    },
    [expenses, tripId, fetchAll, showToast, t],
  );

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  // Loading skeleton
  if (isLoading) {
    const skelBg = isDark ? colors.neutral[700] : colors.neutral[200];
    const skelBase = isDark ? colors.neutral[800] : colors.neutral[100];
    return (
      <View style={styles.container}>
        {/* Header skeleton */}
        <View style={styles.header}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: skelBg }} />
          <View style={{ width: '50%', height: 20, borderRadius: 6, backgroundColor: skelBg }} />
          <View style={{ width: 36 }} />
        </View>
        {/* Summary skeleton */}
        <View style={[styles.summaryCard, { gap: 12 }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ flex: 1, minWidth: '40%', gap: 4 }}>
                <View style={{ width: '60%', height: 12, borderRadius: 4, backgroundColor: skelBg }} />
                <View style={{ width: '80%', height: 20, borderRadius: 4, backgroundColor: skelBg }} />
              </View>
            ))}
          </View>
        </View>
        {/* List skeleton */}
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              backgroundColor: skelBase,
              borderRadius: 12,
              padding: 14,
              marginHorizontal: 16,
              marginTop: 8,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: skelBg }} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ width: '60%', height: 14, borderRadius: 4, backgroundColor: skelBg }} />
                <View style={{ width: '35%', height: 12, borderRadius: 4, backgroundColor: skelBg }} />
              </View>
              <View style={{ width: 60, height: 18, borderRadius: 4, backgroundColor: skelBg }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Render expense item
  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const categoryIcon = CATEGORY_ICONS[item.category] || 'dots-horizontal';
    const categoryColor = CATEGORY_COLORS[item.category] || '#6B7280';

    return (
      <TouchableOpacity
        style={styles.expenseItem}
        onLongPress={() => handleDeleteExpense(item.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.description} ${formatCurrency(item.amount, item.currency)}`}
        accessibilityHint={t('detail.expenses.alerts.deleteTitle')}
      >
        {/* Category icon */}
        <View style={[styles.categoryIconContainer, { backgroundColor: categoryColor + '20' }]}>
          <Icon name={categoryIcon as any} size={20} color={categoryColor} />
        </View>

        {/* Details */}
        <View style={styles.expenseDetails}>
          <Text
            style={[styles.expenseDescription, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}
            numberOfLines={1}
          >
            {item.description}
          </Text>
          <View style={styles.expenseMetaRow}>
            <Text style={[styles.expenseMeta, { color: theme.colors.textSecondary }]}>
              {t(`detail.expenses.categories.${item.category}`)}
            </Text>
            <Text style={[styles.expenseMetaDot, { color: theme.colors.textSecondary }]}>{'\u00B7'}</Text>
            <Text style={[styles.expenseMeta, { color: theme.colors.textSecondary }]}>
              {formatDate(item.date)}
            </Text>
            {item.paidBy && (
              <>
                <Text style={[styles.expenseMetaDot, { color: theme.colors.textSecondary }]}>{'\u00B7'}</Text>
                <Icon name="account" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.expenseMeta, { color: theme.colors.textSecondary }]}>
                  {item.paidBy.name}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Amount + Settlement badge */}
        <View style={styles.expenseAmountContainer}>
          <Text style={[styles.expenseAmount, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
            {formatCurrency(item.amount, item.currency)}
          </Text>
          {item.splits && item.splits.length > 0 && (
            <View style={[
              styles.settlementBadge,
              {
                backgroundColor: item.splits.every((s) => s.isSettled)
                  ? (isDark ? `${colors.success.main}20` : colors.success.light)
                  : (isDark ? `${colors.warning?.main || '#F59E0B'}20` : '#FEF3C7'),
              },
            ]}>
              <Icon
                name={item.splits.every((s) => s.isSettled) ? 'check' : 'clock-outline'}
                size={10}
                color={item.splits.every((s) => s.isSettled) ? colors.success.main : (colors.warning?.main || '#F59E0B')}
              />
              <Text style={[styles.settlementBadgeText, {
                color: item.splits.every((s) => s.isSettled) ? colors.success.main : (colors.warning?.main || '#F59E0B'),
              }]}>
                {item.splits.every((s) => s.isSettled)
                  ? t('detail.expenses.settledShort', { defaultValue: '정산됨' })
                  : `${item.splits.filter((s) => s.isSettled).length}/${item.splits.length}`}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state for expenses tab
  const renderEmptyExpenses = () => (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] },
        ]}
      >
        <Icon name="receipt" size={48} color={theme.colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        {t('detail.expenses.noExpenses')}
      </Text>
      <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
        {t('detail.expenses.noExpensesMessage')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common:back', { defaultValue: 'Go back' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('detail.expenses.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary Card — Splitwise-style balance overview */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryGrid}>
          {/* Total Spent */}
          <View style={styles.summaryItem}>
            <View style={styles.summaryItemHeader}>
              <Icon name="cash-multiple" size={16} color={theme.colors.primary} />
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                {t('detail.expenses.total')}
              </Text>
            </View>
            <Text style={[styles.summaryValue, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
              {formatCurrency(summary.totalSpent, summary.currency)}
            </Text>
          </View>

          {/* My Paid — 내가 결제한 금액 */}
          <View style={styles.summaryItem}>
            <View style={styles.summaryItemHeader}>
              <Icon name="credit-card-outline" size={16} color={colors.secondary[500]} />
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                {t('detail.expenses.myPaid', { defaultValue: '내가 결제' })}
              </Text>
            </View>
            <Text style={[styles.summaryValue, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
              {formatCurrency(summary.myPaid, summary.currency)}
            </Text>
          </View>

          {/* My Share — 내가 부담할 금액 */}
          <View style={styles.summaryItem}>
            <View style={styles.summaryItemHeader}>
              <Icon name="account-cash" size={16} color={colors.warning?.main || '#F59E0B'} />
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                {t('detail.expenses.myShare')}
              </Text>
            </View>
            <Text style={[styles.summaryValue, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}>
              {formatCurrency(summary.myShare, summary.currency)}
            </Text>
          </View>

          {/* Net Balance — 최종 정산 금액 */}
          <View style={styles.summaryItem}>
            <View style={styles.summaryItemHeader}>
              <Icon
                name={summary.balanceAmount > 0 ? 'arrow-down-bold-circle' : summary.balanceAmount < 0 ? 'arrow-up-bold-circle' : 'check-circle'}
                size={16}
                color={summary.balanceAmount > 0 ? colors.success.main : summary.balanceAmount < 0 ? colors.error.main : colors.success.main}
              />
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                {summary.balanceAmount > 0
                  ? t('detail.expenses.owedToMe')
                  : summary.balanceAmount < 0
                  ? t('detail.expenses.iOwe')
                  : t('detail.expenses.settled')}
              </Text>
            </View>
            <Text
              style={[
                styles.summaryValue,
                { color: summary.balanceAmount > 0 ? colors.success.main : summary.balanceAmount < 0 ? colors.error.main : colors.success.main },
              ]}
            >
              {summary.balanceAmount === 0
                ? t('detail.expenses.allSettled', { defaultValue: '정산 완료' })
                : formatCurrency(Math.abs(summary.balanceAmount), summary.currency)}
            </Text>
          </View>
        </View>

        {/* Balance explanation — 잔액이 있을 때만 표시 */}
        {summary.balanceAmount !== 0 && (
          <View style={[styles.balanceExplain, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[50], borderColor: isDark ? colors.neutral[600] : colors.neutral[200] }]}>
            <Icon name="information-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.balanceExplainText, { color: theme.colors.textSecondary }]}>
              {summary.balanceAmount > 0
                ? t('detail.expenses.balanceExplainPositive', {
                    defaultValue: `결제한 금액(${formatCurrency(summary.myPaid, summary.currency)})이 부담 금액(${formatCurrency(summary.myShare, summary.currency)})보다 많아 ${formatCurrency(summary.balanceAmount, summary.currency)}을 받을 수 있습니다.`,
                    paid: formatCurrency(summary.myPaid, summary.currency),
                    share: formatCurrency(summary.myShare, summary.currency),
                    balance: formatCurrency(summary.balanceAmount, summary.currency),
                  })
                : t('detail.expenses.balanceExplainNegative', {
                    defaultValue: `부담 금액(${formatCurrency(summary.myShare, summary.currency)})이 결제한 금액(${formatCurrency(summary.myPaid, summary.currency)})보다 많아 ${formatCurrency(Math.abs(summary.balanceAmount), summary.currency)}을 보내야 합니다.`,
                    share: formatCurrency(summary.myShare, summary.currency),
                    paid: formatCurrency(summary.myPaid, summary.currency),
                    balance: formatCurrency(Math.abs(summary.balanceAmount), summary.currency),
                  })}
            </Text>
          </View>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
          onPress={() => setActiveTab('expenses')}
          accessibilityRole="tab"
          accessibilityLabel={t('detail.expenses.tabs.expenses')}
          accessibilityState={{ selected: activeTab === 'expenses' }}
        >
          <Icon
            name="receipt"
            size={18}
            color={activeTab === 'expenses' ? colors.primary[500] : colors.neutral[400]}
          />
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
            {t('detail.expenses.tabs.expenses')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
          onPress={() => setActiveTab('balances')}
          accessibilityRole="tab"
          accessibilityLabel={t('detail.expenses.tabs.balances')}
          accessibilityState={{ selected: activeTab === 'balances' }}
        >
          <Icon
            name="scale-balance"
            size={18}
            color={activeTab === 'balances' ? colors.primary[500] : colors.neutral[400]}
          />
          <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
            {t('detail.expenses.tabs.balances')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpenseItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyExpenses}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <FlatList
          data={[{ type: 'balances' as const }, { type: 'settlements' as const }]}
          keyExtractor={(item) => item.type}
          renderItem={({ item }) => {
            if (item.type === 'balances') {
              return (
                <View style={styles.balanceSection}>
                  <View style={styles.sectionHeader}>
                    <Icon name="scale-balance" size={20} color={theme.colors.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                      {t('detail.expenses.balances')}
                    </Text>
                  </View>
                  {balances.length > 0 ? (
                    <View style={styles.balanceList}>
                      {balances.map((bal) => {
                        const paidTotal = expenses
                          .filter((e) => e.paidByUserId === bal.userId)
                          .reduce((s, e) => s + Number(e.amount), 0);
                        const shareTotal = expenses.reduce((s, e) => {
                          const sp = e.splits.find((x) => x.userId === bal.userId);
                          return s + (sp ? Number(sp.amount) : 0);
                        }, 0);
                        const paidCount = expenses.filter((e) => e.paidByUserId === bal.userId).length;
                        return (
                          <BalanceCard
                            key={bal.userId}
                            userName={bal.userName}
                            balance={bal.balance}
                            currency={summary.currency}
                            paidTotal={paidTotal}
                            shareTotal={shareTotal}
                            paidCount={paidCount}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={[styles.emptyBalanceText, { color: theme.colors.textSecondary }]}>
                      {t('detail.expenses.noExpenses')}
                    </Text>
                  )}
                </View>
              );
            }
            return (
              <View style={styles.settlementSection}>
                <View style={styles.sectionHeader}>
                  <Icon name="handshake" size={20} color={theme.colors.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {t('detail.expenses.settlements')}
                  </Text>
                </View>
                <SettlementSummary
                  settlements={settlements}
                  currency={summary.currency}
                  onSettle={handleSettle}
                  currentUserId={currentUserId}
                />
              </View>
            );
          }}
          contentContainerStyle={styles.balancesContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* FAB - Add Expense */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddExpense', { tripId })}
        accessibilityRole="button"
        accessibilityLabel={t('detail.expenses.addExpense')}
        activeOpacity={0.8}
      >
        <Icon name="plus" size={28} color={colors.neutral[0]} />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    summaryCard: {
      margin: 16,
      padding: 16,
      borderRadius: 16,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    summaryItem: {
      flex: 1,
      minWidth: '40%',
      gap: 4,
    },
    summaryItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: '700',
    },
    balanceExplain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: 12,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
    },
    balanceExplainText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    tabBar: {
      flexDirection: 'row',
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 4,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: isDark ? colors.primary[900] : colors.primary[50],
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.neutral[400],
    },
    tabTextActive: {
      color: colors.primary[500],
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
      gap: 8,
    },
    expenseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    categoryIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    expenseDetails: {
      flex: 1,
      gap: 3,
    },
    expenseDescription: {
      fontSize: 15,
      fontWeight: '600',
    },
    expenseMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    expenseMeta: {
      fontSize: 12,
      fontWeight: '500',
    },
    expenseMetaDot: {
      fontSize: 12,
    },
    expenseAmountContainer: {
      alignItems: 'flex-end',
      gap: 4,
    },
    expenseAmount: {
      fontSize: 16,
      fontWeight: '700',
    },
    settlementBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    settlementBadgeText: {
      fontSize: 10,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      marginTop: 40,
    },
    emptyIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    balancesContent: {
      paddingHorizontal: 16,
      paddingBottom: 100,
    },
    balanceSection: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    balanceList: {
      gap: 8,
    },
    emptyBalanceText: {
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: 16,
    },
    settlementSection: {
      marginBottom: 24,
    },
    fab: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 32 : 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
  });

export default ExpensesScreen;
