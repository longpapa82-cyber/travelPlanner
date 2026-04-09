/**
 * SettlementSummary - Settlement recommendation cards
 *
 * Displays optimal settlement paths between trip members
 * with actionable "Settle" buttons for each transaction.
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';
import { Settlement } from '../types';

interface SettlementSummaryProps {
  settlements: Settlement[];
  currency?: string;
  onSettle?: (fromUserId: string, toUserId: string) => void;
}

const formatCurrency = (amount: number | string, currency: string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const symbol =
    currency === 'KRW' ? '\u20A9' : currency === 'JPY' ? '\u00A5' : currency === 'EUR' ? '\u20AC' : '$';
  const decimals = currency === 'KRW' || currency === 'JPY' ? 0 : 2;
  const formatted = num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formatted}`;
};

const SettlementSummary: React.FC<SettlementSummaryProps> = memo(
  ({ settlements, currency = 'USD', onSettle }) => {
    const { t } = useTranslation('trips');
    const { theme, isDark } = useTheme();

    if (settlements.length === 0) {
      return (
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] },
          ]}
          accessibilityRole="summary"
          accessibilityLabel={t('detail.expenses.settled')}
        >
          <View
            style={[
              styles.emptyIconWrapper,
              { backgroundColor: isDark ? `${colors.success.main}20` : colors.success.light },
            ]}
          >
            <Icon name="check-circle" size={32} color={colors.success.main} />
          </View>
          <Text
            style={[styles.emptyTitle, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}
          >
            {t('detail.expenses.settled')}
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
            {t('detail.expenses.noExpensesMessage')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {settlements.map((settlement, index) => (
          <View
            key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`}
            style={[
              styles.settlementRow,
              { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0] },
            ]}
            accessibilityRole="summary"
            accessibilityLabel={`${settlement.fromUserName} ${t('detail.expenses.owes')} ${settlement.toUserName} ${formatCurrency(settlement.amount, currency)}`}
          >
            <View style={styles.settlementContent}>
              {/* From user */}
              <View style={styles.userBubble}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                  ]}
                >
                  <Icon name="account" size={16} color={isDark ? colors.neutral[300] : colors.neutral[500]} />
                </View>
                <Text
                  style={[styles.userName, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}
                  numberOfLines={1}
                >
                  {settlement.fromUserName}
                </Text>
              </View>

              {/* Arrow + amount */}
              <View style={styles.arrowSection}>
                <View style={styles.arrowLine}>
                  <View
                    style={[
                      styles.arrowDash,
                      { backgroundColor: isDark ? colors.neutral[600] : colors.neutral[300] },
                    ]}
                  />
                  <Icon name="arrow-right" size={16} color={theme.colors.primary} />
                </View>
                <Text style={[styles.amountText, { color: theme.colors.primary }]}>
                  {formatCurrency(settlement.amount, currency)}
                </Text>
              </View>

              {/* To user */}
              <View style={styles.userBubble}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                  ]}
                >
                  <Icon name="account" size={16} color={isDark ? colors.neutral[300] : colors.neutral[500]} />
                </View>
                <Text
                  style={[styles.userName, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}
                  numberOfLines={1}
                >
                  {settlement.toUserName}
                </Text>
              </View>
            </View>

            {/* Settle button */}
            {onSettle && (
              <TouchableOpacity
                style={[
                  styles.settleButton,
                  {
                    backgroundColor: isDark ? `${colors.success.main}20` : colors.success.light,
                    borderColor: colors.success.main,
                  },
                ]}
                onPress={() => onSettle(settlement.fromUserId, settlement.toUserId)}
                accessibilityRole="button"
                accessibilityLabel={`${t('detail.expenses.settleUp')} ${settlement.fromUserName} → ${settlement.toUserName}`}
              >
                <Icon name="handshake" size={14} color={colors.success.dark} />
                <Text style={[styles.settleButtonText, { color: colors.success.dark }]}>
                  {t('detail.expenses.settleUp')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  },
);

SettlementSummary.displayName = 'SettlementSummary';

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  settlementRow: {
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settlementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userBubble: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  arrowSection: {
    alignItems: 'center',
    gap: 2,
    minWidth: 80,
  },
  arrowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowDash: {
    width: 24,
    height: 2,
    borderRadius: 1,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
  },
  settleButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SettlementSummary;
