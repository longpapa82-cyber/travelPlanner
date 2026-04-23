import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { theme } from '../../../constants/theme';
import { ConfirmDialogProps } from './ConfirmDialog.types';

// On web, use createPortal to escape parent stacking contexts
const createPortal =
  Platform.OS === 'web'
    ? require('react-dom').createPortal
    : undefined;

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText,
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  // Web: lock body scroll when dialog is open
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  const dialogContent = (
    <Animated.View style={[styles.dialog, { transform: [{ scale }] }]}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <View style={styles.actions}>
        {cancelText ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{cancelText}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            destructive && styles.confirmButtonDestructive,
            !cancelText && styles.confirmButtonFull,
          ]}
          onPress={onConfirm}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.confirmText,
              destructive && styles.confirmTextDestructive,
            ]}
          >
            {confirmText}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // Web: use createPortal with z-index above ShareModal (9999)
  if (Platform.OS === 'web') {
    if (!visible) return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10001,
          padding: 40,
        }}
        onClick={(e: any) => { if (e.target === e.currentTarget) onCancel?.(); }}
      >
        <div
          style={{ width: '100%', maxWidth: 340 }}
          onClick={(e: any) => e.stopPropagation()}
        >
          {dialogContent}
        </div>
      </div>,
      document.body,
    );
  }

  // Native: use React Native Modal
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <Animated.View style={[styles.overlay, { opacity }]}>
          <TouchableWithoutFeedback>
            {dialogContent}
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    ...theme.shadows.xl,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  confirmButtonFull: {
    flex: 1,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  confirmTextDestructive: {
    color: '#EF4444',
  },
});
