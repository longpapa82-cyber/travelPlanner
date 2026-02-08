/**
 * Button Component Styles
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography, layout } from '../../../constants/theme';
import { ButtonVariant, ButtonSize } from './Button.types';

// ============================================================================
// VARIANT STYLES
// ============================================================================

export const getVariantStyles = (variant: ButtonVariant, isDark: boolean): { container: ViewStyle; text: TextStyle } => {
  const styles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: {
        backgroundColor: colors.primary[500],
        borderWidth: 0,
      },
      text: {
        color: colors.neutral[0],
      },
    },
    secondary: {
      container: {
        backgroundColor: colors.secondary[400],
        borderWidth: 0,
      },
      text: {
        color: colors.neutral[0],
      },
    },
    outline: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.primary[500],
      },
      text: {
        color: colors.primary[500],
      },
    },
    ghost: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      text: {
        color: colors.primary[500],
      },
    },
    danger: {
      container: {
        backgroundColor: colors.error.main,
        borderWidth: 0,
      },
      text: {
        color: colors.neutral[0],
      },
    },
  };

  return styles[variant];
};

// ============================================================================
// SIZE STYLES
// ============================================================================

export const getSizeStyles = (size: ButtonSize): { container: ViewStyle; text: TextStyle; icon: number } => {
  const styles: Record<ButtonSize, { container: ViewStyle; text: TextStyle; icon: number }> = {
    sm: {
      container: {
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[4],
        minHeight: layout.touchTarget.min,
      },
      text: {
        fontSize: 14,
        lineHeight: 20,
      },
      icon: 18,
    },
    md: {
      container: {
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[5],
        minHeight: layout.touchTarget.recommended,
      },
      text: {
        ...typography.button,
      },
      icon: 20,
    },
    lg: {
      container: {
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[6],
        minHeight: layout.touchTarget.comfortable,
      },
      text: {
        fontSize: 18,
        lineHeight: 24,
      },
      icon: 24,
    },
  };

  return styles[size];
};

// ============================================================================
// BASE STYLES
// ============================================================================

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.button,
    overflow: 'hidden',
    ...shadows.sm,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: spacing[2],
  },
  iconRight: {
    marginLeft: spacing[2],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: spacing[2],
  },
});
