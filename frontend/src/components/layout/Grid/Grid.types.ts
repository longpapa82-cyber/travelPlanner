import { ViewStyle } from 'react-native';

export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6;
export type GridGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface GridProps {
  /**
   * Number of columns in the grid
   * @default 2
   */
  columns?: GridColumns;

  /**
   * Gap between grid items
   * @default 'md'
   */
  gap?: GridGap;

  /**
   * Grid items (children)
   */
  children: React.ReactNode;

  /**
   * Custom style for the container
   */
  style?: ViewStyle;

  /**
   * Custom style for each grid item
   */
  itemStyle?: ViewStyle;
}
