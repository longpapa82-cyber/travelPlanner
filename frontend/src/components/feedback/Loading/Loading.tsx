import React, { useEffect, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { LoadingProps, LoadingSize } from './Loading.types';
import { theme } from '../../../constants/theme';

export const Loading: React.FC<LoadingProps> = ({
  visible = true,
  size = 'md',
  color,
  overlay = false,
  text,
  overlayColor = 'rgba(0, 0, 0, 0.5)',
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && overlay) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, overlay]);

  const getSpinnerSize = (size: LoadingSize): 'small' | 'large' => {
    switch (size) {
      case 'sm':
        return 'small';
      case 'md':
      case 'lg':
        return 'large';
      default:
        return 'large';
    }
  };

  const spinnerColor = color || theme.colors.primary[500];

  const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlayContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: overlayColor,
    },
    contentContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.md,
    },
    text: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.body.md.fontSize,
      fontWeight: theme.typography.body.md.fontWeight as any,
      color: theme.colors.text,
      textAlign: 'center',
    },
  });

  if (!visible) {
    return null;
  }

  const renderSpinner = () => (
    <View style={styles.container}>
      <ActivityIndicator size={getSpinnerSize(size)} color={spinnerColor} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );

  if (overlay) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <Animated.View style={[styles.overlayContainer, { opacity }]}>
          <View style={styles.contentContainer}>{renderSpinner()}</View>
        </Animated.View>
      </Modal>
    );
  }

  return renderSpinner();
};
