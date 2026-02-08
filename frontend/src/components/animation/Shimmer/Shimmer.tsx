import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { ShimmerProps } from './Shimmer.types';
import { useTheme } from '../../../contexts/ThemeContext';
import { theme } from '../../../constants/theme';

export const Shimmer: React.FC<ShimmerProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  duration = 1500,
  baseColor,
  highlightColor,
  style,
}) => {
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  const defaultBaseColor = isDark
    ? theme.darkColors.surface
    : theme.colors.neutral[200];
  const defaultHighlightColor = isDark
    ? theme.darkColors.border
    : theme.colors.neutral[100];

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [duration]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width as number, width as number],
  });

  const styles = StyleSheet.create({
    container: {
      width,
      height,
      borderRadius,
      backgroundColor: baseColor || defaultBaseColor,
      overflow: 'hidden',
    },
    shimmer: {
      width: '100%',
      height: '100%',
      backgroundColor: highlightColor || defaultHighlightColor,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};
