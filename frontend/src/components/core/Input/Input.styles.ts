import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme } from '../../../constants/theme';
import { InputSize } from './Input.types';

interface InputStylesProps {
  size: InputSize;
  error: boolean;
  disabled: boolean;
  isFocused: boolean;
}

export const getInputStyles = ({ size, error, disabled, isFocused }: InputStylesProps) => {
  const sizeStyles: Record<InputSize, { container: ViewStyle; input: TextStyle }> = {
    sm: {
      container: { minHeight: 40 },
      input: { fontSize: 14 },
    },
    md: {
      container: { minHeight: 48 },
      input: { fontSize: 16 },
    },
    lg: {
      container: { minHeight: 56 },
      input: { fontSize: 18 },
    },
  };

  const borderColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: theme.typography.label.fontSize,
      fontWeight: theme.typography.label.fontWeight,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    required: {
      color: theme.colors.error,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor,
      borderRadius: theme.borderRadius.input,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: disabled ? theme.colors.background : theme.colors.white,
      ...sizeStyles[size].container,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      ...sizeStyles[size].input,
    },
    leftIcon: {
      marginRight: theme.spacing.sm,
    },
    rightIcon: {
      marginLeft: theme.spacing.sm,
    },
    helperText: {
      fontSize: theme.typography.caption.fontSize,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    errorText: {
      fontSize: theme.typography.caption.fontSize,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
  });
};
