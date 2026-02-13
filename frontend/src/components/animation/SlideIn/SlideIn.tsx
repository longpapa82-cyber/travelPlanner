import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { SlideInProps, SlideInDirection } from './SlideIn.types';

export const SlideIn: React.FC<SlideInProps> = ({
  children,
  direction = 'bottom',
  distance = 50,
  duration = 300,
  delay = 0,
  visible = true,
  style,
  onAnimationComplete,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const getInitialTransform = (direction: SlideInDirection, distance: number) => {
    switch (direction) {
      case 'top':
        return { x: 0, y: -distance };
      case 'bottom':
        return { x: 0, y: distance };
      case 'left':
        return { x: -distance, y: 0 };
      case 'right':
        return { x: distance, y: 0 };
      default:
        return { x: 0, y: distance };
    }
  };

  useEffect(() => {
    const initial = getInitialTransform(direction, distance);

    if (visible) {
      translateX.setValue(initial.x);
      translateY.setValue(initial.y);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          friction: 8,
          tension: 40,
          delay,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(translateY, {
          toValue: 0,
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
        Animated.timing(translateX, {
          toValue: initial.x,
          duration,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: initial.y,
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
  }, [visible, direction, distance, duration, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateX }, { translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};
