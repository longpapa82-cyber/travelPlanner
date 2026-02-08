import { ViewStyle } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';

export interface ToastProps {
  type?: ToastType;
  message: string;
  duration?: number;
  position?: ToastPosition;
  onHide?: () => void;
}

export interface ToastContextValue {
  showToast: (props: ToastProps) => void;
  hideToast: () => void;
}
