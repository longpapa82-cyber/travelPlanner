import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ModalProps, ModalSize } from './Modal.types';
import { theme } from '../../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  size = 'md',
  showCloseButton = true,
  children,
  footer,
  style,
}) => {
  const getModalWidth = (size: ModalSize): number => {
    switch (size) {
      case 'sm':
        return SCREEN_WIDTH * 0.7;
      case 'md':
        return SCREEN_WIDTH * 0.85;
      case 'lg':
        return SCREEN_WIDTH * 0.95;
      case 'full':
        return SCREEN_WIDTH;
      default:
        return SCREEN_WIDTH * 0.85;
    }
  };

  const modalWidth = getModalWidth(size);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: modalWidth,
      maxHeight: '90%',
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.modal,
      overflow: 'hidden',
      ...theme.shadows.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing.sm,
      marginLeft: theme.spacing.md,
    },
    content: {
      padding: theme.spacing.lg,
    },
    footer: {
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
  });

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContainer, style]}>
              {(title || showCloseButton) && (
                <View style={styles.header}>
                  {title && <Text style={styles.title}>{title}</Text>}
                  {showCloseButton && (
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={onClose}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel="Close modal"
                    >
                      <Icon name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>

              {footer && <View style={styles.footer}>{footer}</View>}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};
