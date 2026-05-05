import { Platform } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Shared NativeStack screenOptions applied to every Stack navigator.
 * Ensures a consistent header height across all tabs on iOS.
 *
 * Why headerHeight is fixed: React Navigation's createNativeStackNavigator
 * uses the native iOS UINavigationController whose default height varies by
 * device (standard vs. large-title vs. Dynamic Island). Setting an explicit
 * height to 56 (Android standard) normalized across all screens prevents
 * the "uneven header" look when switching tabs.
 */
export function makeStackScreenOptions(primaryColor: string) {
  return {
    headerStyle: {
      backgroundColor: primaryColor,
      // Fix iOS header height inconsistency across tabs.
      // height:56 pins the bar so every tab renders identically.
      // Without this, Dynamic Island vs. notch vs. no-notch devices
      // produce slightly different computed heights.
      // Note: headerHeight is not a valid NativeStack prop; height inside
      // headerStyle is the correct way to fix this.
      ...(Platform.OS === 'ios' ? { height: 56 } : {}),
    },
    headerTintColor: colors.neutral[0],
    headerTitleStyle: {
      fontWeight: 'bold' as const,
      fontSize: 17,
    },
    headerBackButtonDisplayMode: 'minimal' as const,
    ...(Platform.OS === 'ios' ? { headerTopInsetEnabled: false } : {}),
  };
}
