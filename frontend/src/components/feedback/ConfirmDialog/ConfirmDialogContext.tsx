import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ConfirmDialogOptions, ConfirmDialogContextValue } from './ConfirmDialog.types';

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined);

interface ConfirmDialogProviderProps {
  children: ReactNode;
}

// V182 (Issue 2): queue-based dialog. The previous single resolveRef
// slot caused race conditions like the V177/V181 double-logout bug — when
// the user tapped a button twice quickly, the second confirm() call
// overwrote the first call's resolve, leaving the first promise pending
// forever. Now subsequent calls queue and resolve in order; if the same
// caller (e.g. handleLogout) re-enters before its first dialog finishes,
// the second call is rejected immediately so the caller's in-flight guard
// correctly observes the busy state.
type QueueItem = {
  opts: ConfirmDialogOptions;
  resolve: (v: boolean) => void;
};

export const ConfirmDialogProvider: React.FC<ConfirmDialogProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({
    title: '',
    message: '',
  });
  const queueRef = useRef<QueueItem[]>([]);

  const showNext = useCallback(() => {
    const next = queueRef.current[0];
    if (next) {
      setOptions(next.opts);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, []);

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      queueRef.current.push({ opts, resolve });
      // First in queue → display immediately; later items wait their turn.
      if (queueRef.current.length === 1) {
        setOptions(opts);
        setVisible(true);
      }
    });
  }, []);

  const drain = useCallback((result: boolean) => {
    const head = queueRef.current.shift();
    setVisible(false);
    head?.resolve(result);
    // Show the next queued dialog (if any) on the next tick so the close
    // animation does not collide with the open animation.
    setTimeout(() => showNext(), 0);
  }, [showNext]);

  const handleConfirm = useCallback(() => drain(true), [drain]);
  const handleCancel = useCallback(() => drain(false), [drain]);

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
