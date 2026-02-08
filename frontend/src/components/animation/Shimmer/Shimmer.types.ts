import { ViewStyle } from 'react-native';

export interface ShimmerProps {
  /**
   * Width of the shimmer element
   * @default '100%'
   */
  width?: number | string;

  /**
   * Height of the shimmer element
   * @default 20
   */
  height?: number;

  /**
   * Border radius of the shimmer element
   * @default 4
   */
  borderRadius?: number;

  /**
   * Duration of one shimmer cycle in milliseconds
   * @default 1500
   */
  duration?: number;

  /**
   * Base color of the shimmer
   * @default '#E0E0E0'
   */
  baseColor?: string;

  /**
   * Highlight color of the shimmer
   * @default '#F5F5F5'
   */
  highlightColor?: string;

  /**
   * Custom style for the container
   */
  style?: ViewStyle;
}
