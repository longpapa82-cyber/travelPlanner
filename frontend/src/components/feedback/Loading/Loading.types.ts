export type LoadingSize = 'sm' | 'md' | 'lg';

export interface LoadingProps {
  /**
   * Whether to show the loading indicator
   */
  visible?: boolean;

  /**
   * Size of the loading indicator
   * @default 'md'
   */
  size?: LoadingSize;

  /**
   * Color of the loading indicator
   * If not provided, uses theme primary color
   */
  color?: string;

  /**
   * Whether to show full-screen overlay
   * @default false
   */
  overlay?: boolean;

  /**
   * Optional text to display below the spinner
   */
  text?: string;

  /**
   * Background color of the overlay
   * @default 'rgba(0, 0, 0, 0.5)'
   */
  overlayColor?: string;
}
