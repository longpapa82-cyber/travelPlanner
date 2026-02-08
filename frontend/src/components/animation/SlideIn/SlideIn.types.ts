import { ViewStyle } from 'react-native';

export type SlideInDirection = 'top' | 'bottom' | 'left' | 'right';

export interface SlideInProps {
  /**
   * Content to animate
   */
  children: React.ReactNode;

  /**
   * Direction to slide in from
   * @default 'bottom'
   */
  direction?: SlideInDirection;

  /**
   * Distance to slide in from (in pixels)
   * @default 50
   */
  distance?: number;

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
