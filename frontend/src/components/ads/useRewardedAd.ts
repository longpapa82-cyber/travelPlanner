/**
 * Rewarded Ad Hook - Web stub
 * Returns no-op on web since RewardedAd is native-only.
 */

export function useRewardedAd() {
  return {
    isLoaded: false,
    show: async (_onReward?: () => void) => {},
    load: () => {},
  };
}
