import { StyleSheet, ViewStyle } from 'react-native';
import { theme, colors, darkColors } from '../../../constants/theme';
import { CardElevation, CardPadding } from './Card.types';

interface CardStylesProps {
  elevation: CardElevation;
  padding: CardPadding;
  borderRadius?: number;
  isDark?: boolean;
}

export const getCardStyles = ({ elevation, padding, borderRadius, isDark = false }: CardStylesProps) => {
  const elevationStyles: Record<CardElevation, ViewStyle> = {
    none: theme.shadows.none,
    sm: isDark ? { ...theme.shadows.none } : theme.shadows.sm,
    md: isDark ? { ...theme.shadows.xs } : theme.shadows.md,
    lg: isDark ? { ...theme.shadows.sm } : theme.shadows.lg,
  };

  const paddingStyles: Record<CardPadding, ViewStyle> = {
    none: { padding: 0 },
    sm: { padding: theme.spacing.sm },
    md: { padding: theme.spacing.md },
    lg: { padding: theme.spacing.lg },
    xl: { padding: theme.spacing.xl },
  };

  return StyleSheet.create({
    container: {
      backgroundColor: isDark ? darkColors.background.secondary : theme.colors.white,
      borderRadius: borderRadius || theme.borderRadius.card,
      ...(isDark ? { borderWidth: 1, borderColor: darkColors.border.light } : {}),
      ...elevationStyles[elevation],
      ...paddingStyles[padding],
    },
  });
};
