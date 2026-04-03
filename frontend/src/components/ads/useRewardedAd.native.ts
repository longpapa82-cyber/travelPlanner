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
    });

    // Poll for state updates
    const interval = setInterval(() => {
      const state = AdManager.getState();
      setIsLoaded(state.rewardedAdLoaded);
      setError(state.lastRewardedAdError);
      setIsLoading(state.loadingRewardedAd);
    }, 1000);

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

    AdManager.forceReload().finally(() => {
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