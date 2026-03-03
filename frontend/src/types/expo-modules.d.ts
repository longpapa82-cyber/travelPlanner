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

declare module 'expo-file-system' {
  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: Record<string, any>): Promise<void>;
  export function readAsStringAsync(fileUri: string, options?: Record<string, any>): Promise<string>;
  export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>;
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
