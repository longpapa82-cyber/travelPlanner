import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { useTrackingTransparency } from '../useTrackingTransparency';

// Mocks come from jest.setup.js:
// getTrackingPermissionsAsync → { status: 'undetermined' }
// requestTrackingPermissionsAsync → { status: 'authorized' }

describe('useTrackingTransparency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Web platform ──

  describe('on web', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      (Platform as any).OS = 'web';
    });

    afterEach(() => {
      (Platform as any).OS = originalOS;
    });

    it('should immediately return authorized on web', () => {
      const { result } = renderHook(() => useTrackingTransparency());

      expect(result.current.status).toBe('authorized');
      expect(result.current.isReady).toBe(true);
      expect(result.current.canShowPersonalizedAds).toBe(true);
    });

    it('should not call tracking permissions on web', () => {
      renderHook(() => useTrackingTransparency());

      // The hook skips the effect entirely on web
      // No ATT calls should be made
      expect(getTrackingPermissionsAsync).not.toHaveBeenCalled();
      expect(requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  // ── Native platform (iOS) ──

  describe('on native (iOS)', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    afterEach(() => {
      (Platform as any).OS = originalOS;
    });

    it('should start with undetermined status', () => {
      const { result } = renderHook(() => useTrackingTransparency());

      expect(result.current.status).toBe('undetermined');
      expect(result.current.isReady).toBe(false);
    });

    it('should return canShowPersonalizedAds based on status', () => {
      const { result } = renderHook(() => useTrackingTransparency());

      // Initially undetermined
      expect(result.current.canShowPersonalizedAds).toBe(false);
    });
  });
});
