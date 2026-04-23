import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { FadeInProps } from './FadeIn.types';

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  duration = 300,
  delay = 0,
  visible = true,
  style,
  onAnimationComplete,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      opacity.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished && onAnimationComplete) {
          onAnimationComplete();
        }
      });
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [visible, duration, delay]);

  return (
    <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>
  );
};
