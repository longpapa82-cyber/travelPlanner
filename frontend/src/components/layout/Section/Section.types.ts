import { ViewStyle } from 'react-native';

export type SectionPadding = 'none' | 'sm' | 'md' | 'lg';
export type SectionSpacing = 'none' | 'sm' | 'md' | 'lg';

export interface SectionProps {
  /**
   * Optional title for the section
   */
  title?: string;

  /**
   * Optional description below the title
   */
  description?: string;

  /**
   * Main content of the section
   */
  children: React.ReactNode;

  /**
   * Padding inside the section
   * @default 'md'
   */
  padding?: SectionPadding;

  /**
   * Spacing between title and content
   * @default 'md'
   */
  spacing?: SectionSpacing;

  /**
   * Optional action component (e.g., "See All" button)
   */
  action?: React.ReactNode;

  /**
   * Background color of the section
   */
  backgroundColor?: string;

  /**
   * Whether to add border radius
   * @default false
   */
  rounded?: boolean;

  /**
   * Whether to add elevation/shadow
   * @default false
   */
  elevated?: boolean;

  /**
   * Custom style for the container
   */
  style?: ViewStyle;

  /**
   * Custom style for the content
   */
  contentStyle?: ViewStyle;
}
