/**
 * App Tracking Transparency (ATT) hook for iOS 14+
 *
 * Deferred tracking: does NOT auto-request on mount.
 * Instead, tracks session count via AsyncStorage and exposes
 * `requestTracking()` for external callers (e.g. PrePermissionATTModal).
 *
 * On web, tracking is always considered "granted" (handled by cookie consent).
 */

import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type TrackingStatus = 'undetermined' | 'denied' | 'authorized' | 'restricted' | 'unavailable';

const SESSION_COUNT_KEY = '@travelplanner:session_count';
const MIN_SESSIONS_FOR_ATT = 3;

export function useTrackingTransparency() {
  const [status, setStatus] = useState<TrackingStatus>(
    Platform.OS === 'web' ? 'authorized' : 'undetermined',
  );
  const [isReady, setIsReady] = useState(Platform.OS === 'web');
  const [sessionCount, setSessionCount] = useState(0);

  // Increment session count and read current ATT status (no auto-request)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;

    (async () => {
      try {
        // Increment session count
        const stored = await AsyncStorage.getItem(SESSION_COUNT_KEY);
        const count = (parseInt(stored || '0', 10) || 0) + 1;
        await AsyncStorage.setItem(SESSION_COUNT_KEY, String(count));
        if (mounted) setSessionCount(count);

        // Read current status without requesting
        const { getTrackingPermissionsAsync } = await import('expo-tracking-transparency');
        const { status: currentStatus } = await getTrackingPermissionsAsync();
        if (mounted) setStatus(currentStatus as TrackingStatus);
      } catch {
        if (mounted) setStatus('unavailable');
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Manually request tracking — called from PrePermissionATTModal
  const requestTracking = useCallback(async (): Promise<TrackingStatus> => {
    if (Platform.OS === 'web') return 'authorized';
    try {
      const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      const { status: newStatus } = await requestTrackingPermissionsAsync();
      setStatus(newStatus as TrackingStatus);
      return newStatus as TrackingStatus;
    } catch {
      setStatus('unavailable');
      return 'unavailable';
    }
  }, []);

  return {
    status,
    isReady,
    sessionCount,
    canShowPersonalizedAds: status === 'authorized',
    shouldShowPrePermission: isReady && status === 'undetermined' && sessionCount >= MIN_SESSIONS_FOR_ATT,
    requestTracking,
  };
}
