import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { theme } from '../../../constants/theme';
import { AvatarSize } from './Avatar.types';

interface AvatarStylesProps {
  size: AvatarSize | number;
}

export const getAvatarStyles = ({ size }: AvatarStylesProps) => {
  const sizeMap: Record<AvatarSize, number> = {
    xs: 24,
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const avatarSize = typeof size === 'number' ? size : sizeMap[size];
  const fontSize = avatarSize * 0.4;
  const badgeSize = avatarSize * 0.25;
  const editButtonSize = avatarSize * 0.3;

  const containerStyle: ViewStyle = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: theme.borderRadius.avatar,
    overflow: 'hidden',
  };

  const imageStyle: ImageStyle = {
    width: '100%',
    height: '100%',
  };

  const placeholderStyle: ViewStyle = {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const initialsStyle: TextStyle = {
    fontSize,
    fontWeight: '600',
    color: theme.colors.white,
  };

  const badgeStyle: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: badgeSize,
    height: badgeSize,
    borderRadius: badgeSize / 2,
    borderWidth: 2,
    borderColor: theme.colors.white,
  };

  const editButtonStyle: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: editButtonSize,
    height: editButtonSize,
    borderRadius: editButtonSize / 2,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  };

  return StyleSheet.create({
    container: containerStyle,
    image: imageStyle,
    placeholder: placeholderStyle,
    initials: initialsStyle,
    badgeContainer: badgeStyle,
    editButton: editButtonStyle,
  });
};
