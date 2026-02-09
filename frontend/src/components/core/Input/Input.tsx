import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { InputProps } from './Input.types';
import { getInputStyles } from './Input.styles';
import { theme } from '../../../constants/theme';

export const Input: React.FC<InputProps> = ({
  type = 'text',
  size = 'md',
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  leftIcon,
  rightIcon,
  disabled = false,
  required = false,
  maxLength,
  multiline = false,
  numberOfLines,
  style,
  inputStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const styles = getInputStyles({ size, error: !!error, disabled, isFocused });

  const keyboardType =
    type === 'email'
      ? 'email-address'
      : type === 'number'
      ? 'numeric'
      : type === 'tel'
      ? 'phone-pad'
      : 'default';

  const secureTextEntry = type === 'password' && !showPassword;

  const iconSize = size === 'sm' ? 18 : size === 'md' ? 20 : 22;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View style={styles.inputContainer}>
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={iconSize}
            color={error ? theme.colors.error : isFocused ? theme.colors.primary : theme.colors.textSecondary}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessible
          accessibilityLabel={label || placeholder}
          accessibilityState={{ disabled }}
        />

        {type === 'password' && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
            accessible
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon
              name={showPassword ? 'eye-off' : 'eye'}
              size={iconSize}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {rightIcon && type !== 'password' && (
          <Icon
            name={rightIcon}
            size={iconSize}
            color={error ? theme.colors.error : isFocused ? theme.colors.primary : theme.colors.textSecondary}
            style={styles.rightIcon}
          />
        )}
      </View>

      {(error || helperText) && (
        <Text style={error ? styles.errorText : styles.helperText}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};
