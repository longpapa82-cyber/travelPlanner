/**
 * BalanceCard - Net balance display for a user
 *
 * Shows a user's net balance with color coding:
 * - Green: positive (owed to them)
 * - Red: negative (they owe)
 * - Neutral: settled (zero)
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';

interface BalanceCardProps {
  userName: string;
  balance: number;
  currency?: string;
}

const formatCurrency = (amount: number | string, currency: string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const abs = Math.abs(num);
  const symbol =
    currency === 'KRW' ? '\u20A9' : currency === 'JPY' ? '\u00A5' : currency === 'EUR' ? '\u20AC' : '$';
  const decimals = currency === 'KRW' || currency === 'JPY' ? 0 : 2;
  const formatted = abs.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${formatted}`;
};

const BalanceCard: React.FC<BalanceCardProps> = memo(({ userName, balance, currency = 'USD' }) => {
  const { isDark } = useTheme();

  const isPositive = balance > 0;
  const isNegative = balance < 0;
  const isZero = balance === 0;

  const balanceColor = isPositive
    ? colors.success.main
    : isNegative
    ? colors.error.main
    : isDark
    ? colors.neutral[400]
    : colors.neutral[500];

  const iconName = isPositive
    ? 'arrow-down-bold-circle'
    : isNegative
    ? 'arrow-up-bold-circle'
    : 'check-circle';

  const bgColor = isPositive
    ? colors.success.light
    : isNegative
    ? colors.error.light
    : isDark
    ? colors.neutral[700]
    : colors.neutral[200];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
          borderLeftColor: balanceColor,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${userName}: ${formatCurrency(balance, currency)}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Icon name={iconName} size={20} color={balanceColor} />
      </View>
      <View style={styles.content}>
        <Text
          style={[styles.userName, { color: isDark ? colors.neutral[100] : colors.neutral[800] }]}
          numberOfLines={1}
        >
          {userName}
        </Text>
        <Text style={[styles.balanceText, { color: balanceColor }]}>
          {isNegative ? '-' : isPositive ? '+' : ''}
          {formatCurrency(balance, currency)}
        </Text>
      </View>
      {isZero && (
        <View style={[styles.settledBadge, { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[100] }]}>
          <Icon name="check" size={12} color={colors.success.main} />
        </View>
      )}
    </View>
  );
});

BalanceCard.displayName = 'BalanceCard';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  settledBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BalanceCard;
