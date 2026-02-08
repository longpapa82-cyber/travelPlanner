import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
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

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && onAnimationComplete) {
          onAnimationComplete();
        }
      });
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, duration, delay]);

  return (
    <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>
  );
};
