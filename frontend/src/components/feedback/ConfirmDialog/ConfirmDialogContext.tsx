import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ConfirmDialogOptions, ConfirmDialogContextValue } from './ConfirmDialog.types';

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined);

interface ConfirmDialogProviderProps {
  children: ReactNode;
}

export const ConfirmDialogProvider: React.FC<ConfirmDialogProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({
    title: '',
    message: '',
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    setOptions(opts);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setVisible(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setVisible(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        visible={visible}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        destructive={options.destructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirm = (): ConfirmDialogContextValue => {
  const context = useContext(ConfirmDialogContext);
  if (context === undefined) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context;
};
