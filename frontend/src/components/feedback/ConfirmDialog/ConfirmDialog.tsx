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
    backgroundColor: theme.colors.white,
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
