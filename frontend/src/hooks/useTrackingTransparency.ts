/**
 * App Tracking Transparency (ATT) hook for iOS 14+
 *
 * Requests tracking permission before ads are loaded on native.
 * On web, tracking is always considered "granted" (handled by cookie consent separately).
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type TrackingStatus = 'undetermined' | 'denied' | 'authorized' | 'restricted' | 'unavailable';

export function useTrackingTransparency() {
  const [status, setStatus] = useState<TrackingStatus>(
    Platform.OS === 'web' ? 'authorized' : 'undetermined',
  );
  const [isReady, setIsReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;

    (async () => {
      try {
        const {
          getTrackingPermissionsAsync,
          requestTrackingPermissionsAsync,
        } = await import('expo-tracking-transparency');

        const { status: currentStatus } = await getTrackingPermissionsAsync();

        if (currentStatus === 'undetermined') {
          const { status: newStatus } = await requestTrackingPermissionsAsync();
          if (mounted) {
            setStatus(newStatus as TrackingStatus);
          }
        } else {
          if (mounted) {
            setStatus(currentStatus as TrackingStatus);
          }
        }
      } catch {
        // Tracking transparency not available (older iOS or Android)
        if (mounted) {
          setStatus('unavailable');
        }
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    status,
    isReady,
    canShowPersonalizedAds: status === 'authorized',
  };
}
