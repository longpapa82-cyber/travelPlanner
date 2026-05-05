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
    },
    headerTintColor: colors.neutral[0],
    headerTitleStyle: {
      fontWeight: 'bold' as const,
      fontSize: 17,
    },
    headerBackButtonDisplayMode: 'minimal' as const,
    // Fix iOS header height inconsistency across tabs.
    // headerTopInsetEnabled:false prevents UINavigationBar from auto-adjusting
    // for status bar height (which differs per device/orientation).
    // headerHeight:56 pins the bar to a fixed value so every tab renders
    // identically — without this, Dynamic Island vs. notch vs. no-notch
    // devices all produce slightly different computed heights.
    ...(Platform.OS === 'ios' ? { headerTopInsetEnabled: false, headerHeight: 56 } : {}),
  };
}
