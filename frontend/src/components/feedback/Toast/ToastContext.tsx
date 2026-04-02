import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Toast } from './Toast';
import { ToastProps, ToastContextValue } from './Toast.types';

// Web: use createPortal to render Toast at document root
const createPortal = Platform.OS === 'web' && typeof document !== 'undefined'
  ? require('react-dom').createPortal
  : undefined;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toastProps, setToastProps] = useState<ToastProps | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((props: ToastProps) => {
    setToastProps(props);
    setVisible(true);

    // Auto-hide after duration
    const duration = props.duration || 3000;
    setTimeout(() => {
      hideToast();
    }, duration);
  }, []);

  const hideToast = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setToastProps(null);
    }, 300); // Wait for animation to finish
  }, []);

  const value: ToastContextValue = {
    showToast,
    hideToast,
  };

  // Render Toast via portal on web to escape modal stacking contexts
  const renderToast = () => {
    if (!toastProps) return null;

    const toastElement = <Toast {...toastProps} visible={visible} onHide={hideToast} />;

    // Web: Use portal to render at document.body
    if (createPortal && typeof document !== 'undefined') {
      return createPortal(toastElement, document.body);
    }

    // Native: Render normally
    return toastElement;
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {renderToast()}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
