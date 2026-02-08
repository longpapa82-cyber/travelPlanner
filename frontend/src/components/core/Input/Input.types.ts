import { TextStyle, ViewStyle } from 'react-native';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps {
  type?: InputType;
  size?: InputSize;
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
}
