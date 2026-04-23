import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { ScaleInProps } from './ScaleIn.types';

export const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  initialScale = 0.5,
  duration = 300,
  delay = 0,
  visible = true,
  style,
  onAnimationComplete,
}) => {
  const scale = useRef(new Animated.Value(initialScale)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      scale.stopAnimation();
      opacity.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      scale.setValue(initialScale);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(({ finished }) => {
        if (finished && onAnimationComplete) {
          onAnimationComplete();
        }
      });
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: initialScale,
          duration,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible, initialScale, duration, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};
