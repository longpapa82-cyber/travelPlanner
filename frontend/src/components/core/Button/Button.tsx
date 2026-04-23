/**
 * Button Component
 *
 * Production-ready button with animations, loading states, and accessibility
 *
 * @example
 * <Button variant="primary" onPress={handlePress}>
 *   Click Me
 * </Button>
 *
 * <Button variant="outline" icon="heart" loading>
 *   Loading...
 * </Button>
 */

import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  Animated,
  ActivityIndicator,
  AccessibilityRole,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { ButtonProps } from './Button.types';
import { styles, getVariantStyles, getSizeStyles } from './Button.styles';

const Button: React.FC<ButtonProps> = React.memo(({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  iconSize,
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
  testID,
}) => {
  const { isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
    };
  }, []);

  // Get variant and size styles
  const variantStyles = getVariantStyles(variant, isDark);
  const sizeStyles = getSizeStyles(size);
  const finalIconSize = iconSize || sizeStyles.icon;

  // Press animation handlers
  const handlePressIn = () => {
    if (disabled || loading) return;

    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || loading) return;

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePress = () => {
    if (disabled || loading) return;
    onPress();
  };

  // Render icon
  const renderIcon = () => {
    if (!icon) return null;

    return (
      <Icon
        name={icon}
        size={finalIconSize}
        color={variantStyles.text.color as string}
        style={iconPosition === 'left' ? styles.iconLeft : styles.iconRight}
      />
    );
  };

  // Render content
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={variantStyles.text.color as string}
            style={styles.spinner}
          />
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              variantStyles.text,
              textStyle,
            ]}
          >
            {children}
          </Text>
        </View>
      );
    }

    return (
      <>
        {icon && iconPosition === 'left' && renderIcon()}
        <Text
          style={[
            styles.text,
            sizeStyles.text,
            variantStyles.text,
            textStyle,
          ]}
        >
          {children}
        </Text>
        {icon && iconPosition === 'right' && renderIcon()}
      </>
    );
  };

  return (
    <TouchableOpacity
      accessible
      accessibilityRole={"button" as AccessibilityRole}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      testID={testID}
      activeOpacity={0.9}
      disabled={disabled || loading}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.container,
          variantStyles.container,
          sizeStyles.container,
          fullWidth && styles.fullWidth,
          (disabled || loading) && styles.disabled,
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
      >
        {renderContent()}
      </Animated.View>
    </TouchableOpacity>
  );
});

Button.displayName = 'Button';
export default Button;
