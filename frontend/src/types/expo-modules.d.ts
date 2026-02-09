/**
 * Type declarations for Expo modules that lack their own type definitions.
 */

declare module '@expo/vector-icons' {
  import type { ComponentType } from 'react';
  import type { TextStyle } from 'react-native';

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle;
  }

  export const MaterialCommunityIcons: ComponentType<IconProps>;
  export const Ionicons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const FontAwesome5: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
  export const AntDesign: ComponentType<IconProps>;
  export const Entypo: ComponentType<IconProps>;
  export const MaterialIcons: ComponentType<IconProps>;
}

declare module 'expo-constants' {
  interface ExpoConfig {
    extra?: Record<string, any>;
    [key: string]: any;
  }

  interface Constants {
    expoConfig: ExpoConfig | null;
    manifest: any;
    manifest2: any;
    executionEnvironment: string;
    [key: string]: any;
  }

  const Constants: Constants;
  export default Constants;
}
