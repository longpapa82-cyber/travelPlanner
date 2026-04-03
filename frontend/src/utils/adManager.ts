/**
 * AdManager - Web stub
 *
 * Web platform doesn't support Google Mobile Ads.
 * This stub prevents import errors and provides no-op implementations.
 */

class AdManager {
  private static instance: AdManager;

  private constructor() {
    console.log('[AdManager] Web stub - ads not supported on web platform');
  }

  static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  async initialize(): Promise<void> {
    // No-op on web
  }

  async showRewardedAd(onRewarded: () => void): Promise<boolean> {
    // Always call reward callback on web for testing
    console.log('[AdManager] Web stub - simulating reward');
    onRewarded();
    return true;
  }

  getState() {
    return {
      initialized: false,
      rewardedAd: null,
      interstitialAd: null,
      appOpenAd: null,
      loadingRewardedAd: false,
      rewardedAdLoaded: false,
      lastRewardedAdError: 'Ads not supported on web',
      retryCount: 0,
      maxRetries: 0,
    };
  }

  async forceReload(): Promise<void> {
    // No-op on web
  }
}

export default AdManager.getInstance();