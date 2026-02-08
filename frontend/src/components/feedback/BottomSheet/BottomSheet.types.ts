import { ViewStyle } from 'react-native';

export type BottomSheetHeight = 'sm' | 'md' | 'lg' | 'full';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  height?: BottomSheetHeight | number;
  showHandle?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: ViewStyle;
}
