/**
 * Rewarded Ad Hook - Native (iOS/Android) - IMPROVED VERSION
 *
 * Improvements:
 * - Test device detection for appropriate ad IDs
 * - Better error handling with user feedback
 * - Loading state management
 * - Fallback behavior when ads unavailable
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { canShowFullScreenAd, recordFullScreenAdShown } from './adFrequency';
import { useToast } from '../feedback/Toast/ToastContext';
import { useTranslation } from 'react-i18next';
import { getAdUnitId } from '../../utils/adTestDevice';

const extra = Constants.expoConfig?.extra || {};

// Production ad unit IDs from app.config.js
const PRODUCTION_IDS = {
  ios: extra.admob?.rewardedAdUnitId?.ios || '',
  android: extra.admob?.rewardedAdUnitId?.android || '',
};

export function useRewardedAd(): {
  isLoaded: boolean;
  isLoading: boolean;
  show: (onReward?: () => void) => Promise<void>;
  load: () => void;
  reload: () => void;
  error: string | null;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adRef = useRef<RewardedAd | null>(null);
  const rewardCallbackRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get appropriate ad unit ID (test or production)
      const adUnitId = await getAdUnitId(
        Platform.OS === 'ios' ? PRODUCTION_IDS.ios : PRODUCTION_IDS.android,
        TestIds.REWARDED
      );

      if (!adUnitId) {
        console.error('[AdMob] No rewarded ad unit ID configured');
        setError('광고 설정 오류');
        setIsLoading(false);
        return;
      }

      const rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const loadedUnsub = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          console.log('[AdMob] Rewarded ad loaded successfully');
          setIsLoaded(true);
          setIsLoading(false);
          setError(null);
          retryCountRef.current = 0;
        },
      );

      const earnedUnsub = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          console.log('[AdMob] User earned reward');
          showToast({
            type: 'success',
            message: '보상을 받았습니다! 상세 여행 인사이트가 생성됩니다.',
            position: 'top',
            duration: 3000,
          });
          rewardCallbackRef.current?.();
          rewardCallbackRef.current = null;
        },
      );

      const closedUnsub = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Rewarded ad closed');
        setIsLoaded(false);
        // Preload next ad
        setTimeout(() => rewarded.load(), 1000);
      });

      const errorUnsub = rewarded.addAdEventListener(AdEventType.ERROR, (err) => {
        console.error('[AdMob] Rewarded ad error:', err);
        setIsLoaded(false);
        setIsLoading(false);

        // User-friendly error messages
        if (err.message?.includes('No fill')) {
          setError('현재 광고를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
        } else if (err.message?.includes('Network')) {
          setError('네트워크 연결을 확인해주세요.');
        } else {
          setError('광고 로딩 실패');
        }

        // Retry with exponential backoff (max 3 retries)
        if (retryCountRef.current < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000);
          retryCountRef.current++;

          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            console.log(`[AdMob] Retrying (attempt ${retryCountRef.current}/3)`);
            rewarded.load();
          }, delay);
        } else {
          // After 3 failures, show user actionable message
          showToast({
            type: 'error',
            message: '광고를 불러올 수 없습니다. 나중에 다시 시도하거나 프리미엄 구독을 고려해보세요.',
            position: 'top',
            duration: 5000,
          });
        }
      });

      adRef.current = rewarded;
      rewarded.load();

      return () => {
        loadedUnsub();
        earnedUnsub();
        closedUnsub();
        errorUnsub();
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      };
    } catch (error) {
      console.error('[AdMob] Failed to initialize rewarded ad:', error);
      setIsLoading(false);
      setError('광고 초기화 실패');
    }
  }, [showToast]);

  useEffect(() => {
    const cleanup = load();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [load]);

  const show = useCallback(
    async (onReward?: () => void) => {
      try {
        // Check frequency cap
        const canShow = await canShowFullScreenAd();
        if (!canShow) {
          showToast({
            type: 'info',
            message: '광고는 잠시 후에 다시 볼 수 있습니다.',
            position: 'top',
            duration: 3000,
          });
          return;
        }

        if (!isLoaded || !adRef.current) {
          // If ad not loaded, show helpful message
          showToast({
            type: 'info',
            message: isLoading
              ? '광고를 불러오는 중입니다. 잠시만 기다려주세요...'
              : '광고가 준비되지 않았습니다. 다시 시도해주세요.',
            position: 'top',
            duration: 3000,
          });

          // Try to reload if not already loading
          if (!isLoading) {
            reload();
          }
          return;
        }

        rewardCallbackRef.current = onReward || null;
        await adRef.current.show();
        await recordFullScreenAdShown();
      } catch (error) {
        console.error('[AdMob] Failed to show rewarded ad:', error);
        showToast({
          type: 'error',
          message: '광고를 표시할 수 없습니다.',
          position: 'top',
          duration: 3000,
        });
      }
    },
    [isLoaded, isLoading, showToast],
  );

  const reload = useCallback(() => {
    console.log('[AdMob] Manual reload requested');
    retryCountRef.current = 0;
    setError(null);
    if (adRef.current) {
      adRef.current.load();
      setIsLoading(true);
    } else {
      // Reinitialize if no ad reference
      load();
    }
  }, [load]);

  return { isLoaded, isLoading, show, load, reload, error };
}