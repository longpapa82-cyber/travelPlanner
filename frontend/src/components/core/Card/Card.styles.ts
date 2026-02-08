import { StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../../../constants/theme';
import { CardElevation, CardPadding } from './Card.types';

interface CardStylesProps {
  elevation: CardElevation;
  padding: CardPadding;
  borderRadius?: number;
}

export const getCardStyles = ({ elevation, padding, borderRadius }: CardStylesProps) => {
  const elevationStyles: Record<CardElevation, ViewStyle> = {
    none: theme.shadows.none,
    sm: theme.shadows.sm,
    md: theme.shadows.md,
    lg: theme.shadows.lg,
  };

  const paddingStyles: Record<CardPadding, ViewStyle> = {
    none: { padding: 0 },
    sm: { padding: theme.spacing.sm },
    md: { padding: theme.spacing.md },
    lg: { padding: theme.spacing.lg },
  };

  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.white,
      borderRadius: borderRadius || theme.borderRadius.card,
      ...elevationStyles[elevation],
      ...paddingStyles[padding],
    },
  });
};
