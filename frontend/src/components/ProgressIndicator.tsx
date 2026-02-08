/**
 * ProgressIndicator - 여행 진행률 표시 컴포넌트
 *
 * 기능:
 * - 완료된 활동 수 / 전체 활동 수 표시
 * - 진행률 바 (0-100%)
 * - 다크모드 지원
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../constants/theme';

interface ProgressIndicatorProps {
  completed: number;
  total: number;
  variant?: 'compact' | 'full';
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  completed,
  total,
  variant = 'full',
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation('components');
  const styles = createStyles(theme, isDark);

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 진행률에 따른 색상
  const getProgressColor = (): string => {
    if (percentage === 100) return colors.success.main;
    if (percentage >= 50) return colors.primary[500];
    if (percentage > 0) return colors.warning.main;
    return colors.neutral[400];
  };

  const progressColor = getProgressColor();

  // 컴팩트 모드: 한 줄로 간단하게 표시
  if (variant === 'compact') {
    return (
      <View style={styles.compactContainer}>
        <Icon name="check-circle" size={16} color={progressColor} />
        <Text style={styles.compactText}>
          {completed}/{total} ({percentage}%)
        </Text>
      </View>
    );
  }

  // 풀 모드: 프로그레스 바와 함께 표시
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          <Icon name="check-circle-outline" size={20} color={progressColor} />
          <Text style={styles.label}>{t('progressIndicator.title')}</Text>
        </View>
        <Text style={[styles.percentage, { color: progressColor }]}>
          {percentage}%
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${percentage}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>

      {/* Status Text */}
      <Text style={styles.statusText}>
        {t('progressIndicator.status', { completed, total })}
      </Text>
    </View>
  );
};

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    // Compact Mode
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    compactText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },

    // Full Mode
    container: {
      backgroundColor: isDark ? colors.neutral[800] : colors.neutral[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    labelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    percentage: {
      fontSize: 18,
      fontWeight: '700',
    },

    // Progress Bar
    progressBarContainer: {
      height: 8,
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200],
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: theme.spacing.sm,
    },
    progressBar: {
      height: '100%',
      borderRadius: 4,
      transition: 'width 0.3s ease',
    },

    // Status Text
    statusText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default ProgressIndicator;
