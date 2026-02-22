import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { BadgeProps } from './Badge.types';
import { getBadgeStyles } from './Badge.styles';

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  style,
  textStyle,
}) => {
  const styles = getBadgeStyles({ variant, size });

  const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;

  return (
    <View style={[styles.container, style]} accessible>
      {icon && (
        <Icon
          name={icon}
          size={iconSize}
          color={styles.text.color as string}
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, textStyle]}>{children}</Text>
    </View>
  );
};
