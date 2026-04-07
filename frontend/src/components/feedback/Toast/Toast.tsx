import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { ToastProps, ToastType } from './Toast.types';
import { theme } from '../../../constants/theme';

interface ToastComponentProps extends ToastProps {
  visible: boolean;
}

export const Toast: React.FC<ToastComponentProps> = ({
  type = 'info',
  message,
  position = 'top',
  visible,
  onHide,
}) => {
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: position === 'top' ? -100 : 100,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible]);

  const getTypeConfig = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          icon: 'check-circle',
          iconColor: '#fff',
        };
      case 'error':
        return {
          backgroundColor: theme.colors.error,
          icon: 'alert-circle',
          iconColor: '#fff',
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warning,
          icon: 'alert',
          iconColor: '#fff',
        };
      case 'info':
      default:
        return {
          backgroundColor: theme.colors.primary,
          icon: 'information',
          iconColor: '#fff',
        };
    }
  };

  const typeConfig = getTypeConfig(type);

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      left: theme.spacing.md,
      right: theme.spacing.md,
      [position]: theme.spacing.lg,
      zIndex: 99999,
      elevation: 99999, // Maximum elevation to be above modals on Android
    },
    toast: {
      backgroundColor: typeConfig.backgroundColor,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      ...theme.shadows.lg,
    },
    iconContainer: {
      marginRight: theme.spacing.md,
    },
    message: {
      flex: 1,
      color: '#fff',
      fontSize: 14,
      fontWeight: '500',
    },
    closeButton: {
      marginLeft: theme.spacing.sm,
      padding: theme.spacing.xs,
    },
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.toast} accessible accessibilityRole="alert" testID="toast">
        <View style={styles.iconContainer}>
          <Icon name={typeConfig.icon} size={24} color={typeConfig.iconColor} />
        </View>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onHide}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Close toast"
        >
          <Icon name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
