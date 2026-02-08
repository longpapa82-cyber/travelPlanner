import { ViewStyle } from 'react-native';

export interface ScreenProps {
  /**
   * Main content of the screen
   */
  children: React.ReactNode;

  /**
   * Whether the content should be scrollable
   * @default false
   */
  scrollable?: boolean;

  /**
   * Whether to show loading indicator
   * @default false
   */
  loading?: boolean;

  /**
   * Optional header component
   */
  header?: React.ReactNode;

  /**
   * Optional footer component
   */
  footer?: React.ReactNode;

  /**
   * Background color of the screen
   * @default theme.colors.background
   */
  backgroundColor?: string;

  /**
   * Whether to handle keyboard avoiding
   * @default true
   */
  keyboardAvoiding?: boolean;

  /**
   * Additional padding
   * @default 0
   */
  padding?: number;

  /**
   * Custom style for the container
   */
  style?: ViewStyle;

  /**
   * Custom style for the content
   */
  contentStyle?: ViewStyle;
}
