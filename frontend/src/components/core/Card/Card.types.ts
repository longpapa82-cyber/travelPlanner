import { AccessibilityProps, ViewStyle } from 'react-native';

export type CardElevation = 'none' | 'sm' | 'md' | 'lg';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps extends AccessibilityProps {
  elevation?: CardElevation;
  padding?: CardPadding;
  borderRadius?: number;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}
