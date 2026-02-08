import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../../constants/theme';
import { BadgeVariant, BadgeSize } from './Badge.types';

interface BadgeStylesProps {
  variant: BadgeVariant;
  size: BadgeSize;
}

export const getBadgeStyles = ({ variant, size }: BadgeStylesProps) => {
  const variantStyles: Record<BadgeVariant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: {
        backgroundColor: theme.colors.primaryLight,
      },
      text: {
        color: theme.colors.primaryDark,
      },
    },
    secondary: {
      container: {
        backgroundColor: theme.colors.secondaryLight,
      },
      text: {
        color: theme.colors.secondaryDark,
      },
    },
    success: {
      container: {
        backgroundColor: theme.colors.success + '20',
      },
      text: {
        color: theme.colors.success,
      },
    },
    warning: {
      container: {
        backgroundColor: theme.colors.warning + '20',
      },
      text: {
        color: theme.colors.warning,
      },
    },
    error: {
      container: {
        backgroundColor: theme.colors.error + '20',
      },
      text: {
        color: theme.colors.error,
      },
    },
    info: {
      container: {
        backgroundColor: '#4299E1' + '20',
      },
      text: {
        color: '#4299E1',
      },
    },
    neutral: {
      container: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      },
      text: {
        color: '#FFFFFF',
      },
    },
  };

  const sizeStyles: Record<BadgeSize, { container: ViewStyle; text: TextStyle }> = {
    sm: {
      container: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
      },
      text: {
        fontSize: 10,
      },
    },
    md: {
      container: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      },
      text: {
        fontSize: 12,
      },
    },
    lg: {
      container: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
      },
      text: {
        fontSize: 14,
      },
    },
  };

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.borderRadius.badge,
      alignSelf: 'flex-start',
      ...variantStyles[variant].container,
      ...sizeStyles[size].container,
    },
    text: {
      fontWeight: '600',
      ...variantStyles[variant].text,
      ...sizeStyles[size].text,
    },
    icon: {
      marginRight: theme.spacing.xs,
    },
  });
};
