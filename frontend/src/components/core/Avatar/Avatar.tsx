import React from 'react';
import { View, Image, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AvatarProps } from './Avatar.types';
import { getAvatarStyles } from './Avatar.styles';
import { theme } from '../../../constants/theme';

export const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'md',
  badge,
  editable = false,
  onEdit,
  style,
}) => {
  const styles = getAvatarStyles({ size });

  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const getBadgeColor = () => {
    switch (badge) {
      case 'online':
        return theme.colors.success;
      case 'away':
        return theme.colors.warning;
      case 'offline':
        return theme.colors.textSecondary;
      default:
        return 'transparent';
    }
  };

  const avatarContent = (
    <View style={[styles.container, style]}>
      {source ? (
        <Image source={source} style={styles.image} accessible accessibilityRole="image" />
      ) : (
        <View style={styles.placeholder} accessible>
          <Text style={styles.initials}>{getInitials(name)}</Text>
        </View>
      )}

      {badge && (
        <View
          style={[styles.badgeContainer, { backgroundColor: getBadgeColor() }]}
          accessible
          accessibilityLabel={`Status: ${badge}`}
        />
      )}

      {editable && onEdit && (
        <TouchableOpacity
          style={styles.editButton}
          onPress={onEdit}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Edit avatar"
        >
          <Icon name="camera" size={12} color={theme.colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );

  return avatarContent;
};
