/**
 * Rewarded Ad Hook - Fixed Version using AdManager
 *
 * Uses the singleton AdManager for reliable ad loading and display.
 * Includes comprehensive error handling and retry logic.
 */

import { useState, useCallback, useEffect } from 'react';
import AdManager from '../../utils/adManager';
import { canShowFullScreenAd, recordFullScreenAdShown } from './adFrequency';

export function useRewardedAd(): {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  show: (onRewarded: () => void) => Promise<void>;
  reload: () => void;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize AdManager on mount
  useEffect(() => {
    console.log('[useRewardedAd] Initializing AdManager...');
    AdManager.initialize().then(() => {
      // Check if ad is loaded
      const state = AdManager.getState();
      setIsLoaded(state.rewardedAdLoaded);
      setError(state.lastRewardedAdError);
      console.log('[useRewardedAd] Initial state:', {
        isLoaded: state.rewardedAdLoaded,
        error: state.lastRewardedAdError
      });
    }).catch(err => {
      console.error('[useRewardedAd] Failed to initialize AdManager:', err);
      setError(String(err));
    });

    // Poll for state updates more frequently (500ms instead of 1000ms)
    const interval = setInterval(() => {
      const state = AdManager.getState();
      const prevLoaded = isLoaded;
      setIsLoaded(state.rewardedAdLoaded);
      setError(state.lastRewardedAdError);
      setIsLoading(state.loadingRewardedAd);

      // Log state changes
      if (prevLoaded !== state.rewardedAdLoaded) {
        console.log('[useRewardedAd] Ad loaded state changed:', state.rewardedAdLoaded);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const show = useCallback(async (onRewarded: () => void) => {
    console.log('[useRewardedAd] Show requested');

    // Check frequency capping
    if (!canShowFullScreenAd()) {
      console.log('[useRewardedAd] Frequency capped, skipping ad');
      // Still give reward to not frustrate user
      onRewarded();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await AdManager.showRewardedAd(onRewarded);

      if (success) {
        recordFullScreenAdShown();
      } else {
        // If ad failed to show, still give reward
        console.log('[useRewardedAd] Ad failed to show, giving reward anyway');
        onRewarded();
      }
    } catch (err) {
      console.error('[useRewardedAd] Error showing ad:', err);
      setError(String(err));

      // Still give reward on error
      onRewarded();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    console.log('[useRewardedAd] Force reload requested');
    setIsLoading(true);
    setError(null);

    AdManager.forceReload()
      .then(() => {
        console.log('[useRewardedAd] Reload completed successfully');
        // Check state immediately after reload
        const state = AdManager.getState();
        setIsLoaded(state.rewardedAdLoaded);
        setError(state.lastRewardedAdError);
      })
      .catch(err => {
        console.error('[useRewardedAd] Reload failed:', err);
        setError(String(err));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    show,
    reload,
  };
}