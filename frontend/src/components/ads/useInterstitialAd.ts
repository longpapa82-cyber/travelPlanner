/**
 * Interstitial Ad Hook - Web stub
 * Returns no-op on web since AdMob interstitials are native-only.
 */

export function useInterstitialAd() {
  return {
    isLoaded: false,
    show: async () => {},
    load: () => {},
  };
}
