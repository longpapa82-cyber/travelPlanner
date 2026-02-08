/**
 * Button Component Types
 */

import { ViewStyle, TextStyle } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  // Visual style
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;

  // State
  disabled?: boolean;
  loading?: boolean;

  // Icon
  icon?: string;
  iconPosition?: 'left' | 'right';
  iconSize?: number;

  // Content
  children: React.ReactNode;

  // Interaction
  onPress: () => void;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;

  // Style override
  style?: ViewStyle;
  textStyle?: TextStyle;

  // Test ID
  testID?: string;
}
