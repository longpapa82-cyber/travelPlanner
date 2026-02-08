import { ViewStyle } from 'react-native';

export interface ScaleInProps {
  /**
   * Content to animate
   */
  children: React.ReactNode;

  /**
   * Initial scale value (0-1)
   * @default 0.5
   */
  initialScale?: number;

  /**
   * Duration of the animation in milliseconds
   * @default 300
   */
  duration?: number;

  /**
   * Delay before starting the animation in milliseconds
   * @default 0
   */
  delay?: number;

  /**
   * Whether the animation should trigger
   * @default true
   */
  visible?: boolean;

  /**
   * Custom style for the container
   */
  style?: ViewStyle;

  /**
   * Callback when animation completes
   */
  onAnimationComplete?: () => void;
}
