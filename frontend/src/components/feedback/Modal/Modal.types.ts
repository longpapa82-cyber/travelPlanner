import { ViewStyle } from 'react-native';

export type ModalSize = 'sm' | 'md' | 'lg' | 'full';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: ViewStyle;
}
