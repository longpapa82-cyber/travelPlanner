import { ViewStyle } from 'react-native';

export type StackDirection = 'vertical' | 'horizontal';
export type StackSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify =
  | 'start'
  | 'center'
  | 'end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export interface StackProps {
  /**
   * Direction of the stack
   * @default 'vertical'
   */
  direction?: StackDirection;

  /**
   * Spacing between items
   * @default 'md'
   */
  spacing?: StackSpacing;

  /**
   * Cross-axis alignment
   * @default 'stretch'
   */
  align?: StackAlign;

  /**
   * Main-axis justification
   * @default 'start'
   */
  justify?: StackJustify;

  /**
   * Whether to wrap items
   * @default false
   */
  wrap?: boolean;

  /**
   * Stack items (children)
   */
  children: React.ReactNode;

  /**
   * Custom style for the container
   */
  style?: ViewStyle;
}
