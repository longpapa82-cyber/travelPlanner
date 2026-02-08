import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast } from './Toast';
import { ToastProps, ToastContextValue } from './Toast.types';

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

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastProps && <Toast {...toastProps} visible={visible} onHide={hideToast} />}
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
