import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { CardProps } from './Card.types';
import { getCardStyles } from './Card.styles';

export const Card: React.FC<CardProps> = ({
  elevation = 'sm',
  padding = 'md',
  borderRadius,
  onPress,
  children,
  style,
}) => {
  const styles = getCardStyles({ elevation, padding, borderRadius });

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={onPress}
        activeOpacity={0.8}
        accessible
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]} accessible>
      {children}
    </View>
  );
};
