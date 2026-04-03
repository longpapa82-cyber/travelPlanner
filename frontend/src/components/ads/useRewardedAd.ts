/**
 * Rewarded Ad Hook - Web stub
 * Returns no-op on web since RewardedAd is native-only.
 */

export function useRewardedAd(): {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  show: (onRewarded: () => void) => Promise<void>;
  reload: () => void;
} {
  return {
    isLoaded: false,
    isLoading: false,
    error: 'Ads not supported on web',
    show: async (onRewarded: () => void) => {
      // Simulate reward on web for testing
      onRewarded();
    },
    reload: () => {},
  };
}
