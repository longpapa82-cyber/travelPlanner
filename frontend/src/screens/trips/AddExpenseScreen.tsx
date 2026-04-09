import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { TripsStackParamList } from '../../types';
import { colors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../components/feedback/Toast/ToastContext';
import apiService from '../../services/api';
import Button from '../../components/core/Button';
import DatePickerField from '../../components/core/DatePicker';

type Props = {
  navigation: NativeStackNavigationProp<TripsStackParamList, 'AddExpense'>;
  route: RouteProp<TripsStackParamList, 'AddExpense'>;
};

interface Collaborator {
  id: string;
  userId: string;
  user?: { id: string; name: string; profileImage?: string };
  role: string;
}

const CATEGORIES = ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'] as const;
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

const CURRENCIES = ['USD', 'KRW', 'JPY', 'EUR', 'GBP', 'THB', 'CNY'];

const AddExpenseScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tripId, expenseId } = route.params;
  const { theme, isDark } = useTheme();
  const { showToast } = useToast();
  const { t } = useTranslation('trips');

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState<string>('food');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'exact'>('equal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidByUserId, setPaidByUserId] = useState('');
  const [splitUserIds, setSplitUserIds] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [profile, collabs] = await Promise.all([
          apiService.getProfile(),
          apiService.getCollaborators(tripId),
        ]);
        setCurrentUserId(profile.id);
        setPaidByUserId(profile.id);
        setCollaborators(collabs);

        // Default: split with all members (deduplicate — collabs may include owner)
        const allUserIds = [...new Set([profile.id, ...collabs.map((c: Collaborator) => c.user?.id).filter(Boolean)])] as string[];
        setSplitUserIds(allUserIds);

        if (profile.travelPreferences?.budget) {
          // Infer currency from trip
          const trip = await apiService.getTripById(tripId);
          if (trip?.budgetCurrency) setCurrency(trip.budgetCurrency);
        }
      } catch {
        // silent
      } finally {
        setIsFetching(false);
      }
    };
    init();
  }, [tripId]);

  // Load existing expense if editing
  useEffect(() => {
    if (!expenseId) return;
    const loadExpense = async () => {
      try {
        const expenses = await apiService.getExpenses(tripId);
        const expense = expenses.find((e: any) => e.id === expenseId);
        if (expense) {
          setDescription(expense.description);
          setAmount(String(expense.amount));
          setCurrency(expense.currency);
          setCategory(expense.category);
          setSplitMethod(expense.splitMethod);
          setDate(expense.date?.split('T')[0] || date);
          setPaidByUserId(expense.paidByUserId);
          setSplitUserIds(expense.splits?.map((s: any) => s.userId) || []);
        }
      } catch {
        // silent
      }
    };
    loadExpense();
  }, [expenseId, tripId]);

  const allMembers = useMemo(() => {
    const members: { id: string; name: string }[] = [];
    if (currentUserId) {
      members.push({ id: currentUserId, name: t('detail.expenses.paidBy') + ' (me)' });
    }
    collaborators.forEach((c) => {
      if (c.user && c.user.id !== currentUserId) {
        members.push({ id: c.user.id, name: c.user.name });
      }
    });
    return members;
  }, [currentUserId, collaborators, t]);

  const toggleSplitUser = (userId: string) => {
    setSplitUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) {
      showToast({ type: 'error', message: t('detail.expenses.description'), position: 'top' });
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      showToast({ type: 'error', message: t('detail.expenses.amount'), position: 'top' });
      return;
    }
    if (splitUserIds.length === 0) {
      showToast({ type: 'error', message: t('detail.expenses.splitWith'), position: 'top' });
      return;
    }

    // Validate exact split amounts
    if (splitMethod === 'exact') {
      const splitTotal = splitUserIds.reduce((sum, uid) => sum + (parseFloat(exactAmounts[uid] || '0') || 0), 0);
      if (Math.abs(splitTotal - amountNum) > 0.01) {
        showToast({
          type: 'error',
          message: t('detail.expenses.exactSplitMismatch', {
            defaultValue: `분할 금액 합계(${splitTotal.toFixed(2)})가 총액(${amountNum.toFixed(2)})과 일치하지 않습니다.`,
          }),
          position: 'top',
          duration: 4000,
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const splits = splitMethod === 'exact'
        ? splitUserIds.map((uid) => ({ userId: uid, amount: parseFloat(exactAmounts[uid] || '0') || 0 }))
        : splitUserIds.map((uid) => ({ userId: uid }));

      const data = {
        description: description.trim(),
        amount: amountNum,
        currency,
        category,
        splitMethod,
        date,
        paidByUserId,
        splits,
      };

      if (expenseId) {
        await apiService.updateExpense(tripId, expenseId, data);
      } else {
        await apiService.createExpense(tripId, data);
      }
      navigation.goBack();
    } catch {
      showToast({ type: 'error', message: t('detail.expenses.alerts.createFailed'), position: 'top' });
    } finally {
      setIsLoading(false);
    }
  }, [description, amount, currency, category, splitMethod, date, paidByUserId, splitUserIds, tripId, expenseId, navigation, showToast, t]);

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  if (isFetching) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('detail.expenses.description')}</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder={t('detail.expenses.description')}
            placeholderTextColor={theme.colors.textSecondary}
            maxLength={100}
            accessibilityLabel={t('detail.expenses.description')}
          />
        </View>

        {/* Amount + Currency */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('detail.expenses.amount')}</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.colors.textSecondary}
              accessibilityLabel={t('detail.expenses.amount')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyPicker}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, currency === c && styles.chipActive]}
                  onPress={() => setCurrency(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: currency === c }}
                >
                  <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('detail.expenses.category')}</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat;
              const catColor = CATEGORY_COLORS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    { borderColor: isActive ? catColor : isDark ? colors.neutral[600] : colors.neutral[300] },
                    isActive && { backgroundColor: catColor + '20' },
                  ]}
                  onPress={() => setCategory(cat)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={t(`detail.expenses.categories.${cat}`)}
                >
                  <Icon name={CATEGORY_ICONS[cat] as any} size={18} color={isActive ? catColor : theme.colors.textSecondary} />
                  <Text style={[styles.categoryText, { color: isActive ? catColor : theme.colors.textSecondary }]}>
                    {t(`detail.expenses.categories.${cat}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('detail.expenses.date')}</Text>
          <DatePickerField
            value={date}
            onChange={(d: string) => setDate(d)}
            label={t('detail.expenses.date')}
          />
        </View>

        {/* Paid by */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('detail.expenses.paidBy')}</Text>
          <View style={styles.memberList}>
            {allMembers.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.memberChip, paidByUserId === m.id && styles.memberChipActive]}
                onPress={() => setPaidByUserId(m.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: paidByUserId === m.id }}
              >
                <Icon
                  name="account"
                  size={16}
                  color={paidByUserId === m.id ? colors.neutral[0] : theme.colors.textSecondary}
                />
                <Text style={[styles.memberText, paidByUserId === m.id && styles.memberTextActive]}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Split with */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('detail.expenses.splitWith')}</Text>
          <View style={styles.splitMethodRow}>
            <TouchableOpacity
              style={[styles.splitBtn, splitMethod === 'equal' && styles.splitBtnActive]}
              onPress={() => setSplitMethod('equal')}
              accessibilityRole="radio"
              accessibilityState={{ selected: splitMethod === 'equal' }}
            >
              <Icon name="equal" size={16} color={splitMethod === 'equal' ? colors.neutral[0] : theme.colors.textSecondary} />
              <Text style={[styles.splitBtnText, splitMethod === 'equal' && styles.splitBtnTextActive]}>
                {t('detail.expenses.splitEqual')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.splitBtn, splitMethod === 'exact' && styles.splitBtnActive]}
              onPress={() => setSplitMethod('exact')}
              accessibilityRole="radio"
              accessibilityState={{ selected: splitMethod === 'exact' }}
            >
              <Icon name="pencil" size={16} color={splitMethod === 'exact' ? colors.neutral[0] : theme.colors.textSecondary} />
              <Text style={[styles.splitBtnText, splitMethod === 'exact' && styles.splitBtnTextActive]}>
                {t('detail.expenses.splitExact')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.memberList}>
            {allMembers.map((m) => {
              const isSelected = splitUserIds.includes(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberChip, isSelected && styles.memberChipActive]}
                  onPress={() => toggleSplitUser(m.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Icon
                    name={isSelected ? 'check-circle' : 'circle-outline'}
                    size={16}
                    color={isSelected ? colors.neutral[0] : theme.colors.textSecondary}
                  />
                  <Text style={[styles.memberText, isSelected && styles.memberTextActive]}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Per-user amount inputs for exact split */}
          {splitMethod === 'exact' && splitUserIds.length > 0 && (
            <View style={{ gap: 8, marginTop: 8 }}>
              {splitUserIds.map((uid) => {
                const member = allMembers.find((m) => m.id === uid);
                return (
                  <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.label, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>
                      {member?.name || uid}
                    </Text>
                    <TextInput
                      style={[styles.input, { flex: 1, textAlign: 'right', paddingVertical: 10, fontSize: 16, fontWeight: '600' }]}
                      value={exactAmounts[uid] || ''}
                      onChangeText={(val) => setExactAmounts((prev) => ({ ...prev, [uid]: val }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={theme.colors.textSecondary}
                      accessibilityLabel={`${member?.name} amount`}
                    />
                  </View>
                );
              })}
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textAlign: 'right' }}>
                {t('detail.expenses.exactSplitHint', {
                  defaultValue: `합계: ${splitUserIds.reduce((s, uid) => s + (parseFloat(exactAmounts[uid] || '0') || 0), 0).toFixed(2)} / ${amount || '0'}`,
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Submit */}
        <View style={styles.submitSection}>
          <Button
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
          >
            {expenseId ? t('common:save') : t('detail.expenses.addExpense')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 20,
    },
    section: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.neutral[200] : colors.neutral[700],
    },
    input: {
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
    },
    amountRow: {
      gap: 8,
    },
    amountInput: {
      fontSize: 24,
      fontWeight: '700',
    },
    currencyPicker: {
      flexGrow: 0,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
      marginRight: 8,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.neutral[300] : colors.neutral[600],
    },
    chipTextActive: {
      color: colors.neutral[0],
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
    },
    categoryText: {
      fontSize: 13,
      fontWeight: '600',
    },
    memberList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    memberChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
    },
    memberChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    memberText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.neutral[300] : colors.neutral[600],
    },
    memberTextActive: {
      color: colors.neutral[0],
    },
    splitMethodRow: {
      flexDirection: 'row',
      gap: 8,
    },
    splitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
    },
    splitBtnActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    splitBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? colors.neutral[300] : colors.neutral[600],
    },
    splitBtnTextActive: {
      color: colors.neutral[0],
    },
    submitSection: {
      marginTop: 8,
    },
  });

export default AddExpenseScreen;
