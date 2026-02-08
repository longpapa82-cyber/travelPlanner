import { ImageSourcePropType, ViewStyle } from 'react-native';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  source?: ImageSourcePropType;
  name?: string;
  size?: AvatarSize | number;
  badge?: 'online' | 'offline' | 'away' | null;
  editable?: boolean;
  onEdit?: () => void;
  style?: ViewStyle;
}
