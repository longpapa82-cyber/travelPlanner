/**
 * AdManager - Singleton Pattern for Robust Ad Management
 *
 * Centralized ad management with:
 * - Singleton pattern for global state
 * - Automatic retry with exponential backoff
 * - Comprehensive error tracking
 * - Test device auto-detection
 * - Initialization guarantee
 */

import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
  BannerAd,
  InterstitialAd,
  AppOpenAd,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

interface AdManagerState {
  initialized: boolean;
  rewardedAd: RewardedAd | null;
  interstitialAd: InterstitialAd | null;
  appOpenAd: AppOpenAd | null;
  loadingRewardedAd: boolean;
  rewardedAdLoaded: boolean;
  lastRewardedAdError: string | null;
  retryCount: number;
  maxRetries: number;
}

class AdManager {
  private static instance: AdManager;
  private state: AdManagerState = {
    initialized: false,
    rewardedAd: null,
    interstitialAd: null,
    appOpenAd: null,
    loadingRewardedAd: false,
    rewardedAdLoaded: false,
    lastRewardedAdError: null,
    retryCount: 0,
    maxRetries: 3,
  };

  private constructor() {
    console.log('[AdManager] Singleton instance created');
  }

  static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  /**
   * Initialize the ad manager - call once at app startup
   */
  async initialize(): Promise<void> {
    if (this.state.initialized) {
      console.log('[AdManager] Already initialized');
      return;
    }

    console.log('[AdManager] Initializing...');

    try {
      // Initialize rewarded ad
      await this.initializeRewardedAd();

      this.state.initialized = true;
      console.log('[AdManager] Initialization complete');
    } catch (error) {
      console.error('[AdManager] Initialization failed:', error);
      this.state.lastRewardedAdError = String(error);

      // Schedule retry
      setTimeout(() => this.initialize(), 5000);
    }
  }

  /**
   * Initialize rewarded ad with proper error handling
   */
  private async initializeRewardedAd(): Promise<void> {
    const adUnitId = this.getRewardedAdUnitId();
    console.log('[AdManager] Creating rewarded ad with ID:', adUnitId.substring(0, 20) + '...');

    // Create new ad instance
    this.state.rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
      keywords: ['travel', 'vacation', 'trip', 'tourism'],
    });

    // Set up event listeners
    this.setupRewardedAdListeners();

    // Load the ad
    await this.loadRewardedAd();
  }

  /**
   * Set up all rewarded ad event listeners
   */
  private setupRewardedAdListeners(): void {
    if (!this.state.rewardedAd) return;

    // Load event
    this.state.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[AdManager] Rewarded ad loaded successfully');
      this.state.rewardedAdLoaded = true;
      this.state.loadingRewardedAd = false;
      this.state.retryCount = 0;
      this.state.lastRewardedAdError = null;
    });

    // Error event
    this.state.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('[AdManager] Rewarded ad error:', error);
      this.state.rewardedAdLoaded = false;
      this.state.loadingRewardedAd = false;
      this.state.lastRewardedAdError = String(error);

      // Retry with exponential backoff
      this.retryLoadRewardedAd();
    });

    // Earned reward event
    this.state.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      console.log('[AdManager] User earned reward:', reward);
    });

    // Closed event
    this.state.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdManager] Rewarded ad closed, reloading...');
      this.state.rewardedAdLoaded = false;
      this.loadRewardedAd();
    });
  }

  /**
   * Load rewarded ad
   */
  private async loadRewardedAd(): Promise<void> {
    if (!this.state.rewardedAd || this.state.loadingRewardedAd) {
      console.log('[AdManager] Skip loading - ad not initialized or already loading');
      return;
    }

    try {
      console.log('[AdManager] Loading rewarded ad...');
      this.state.loadingRewardedAd = true;
      await this.state.rewardedAd.load();
    } catch (error) {
      console.error('[AdManager] Failed to load rewarded ad:', error);
      this.state.loadingRewardedAd = false;
      this.state.lastRewardedAdError = String(error);
      this.retryLoadRewardedAd();
    }
  }

  /**
   * Retry loading with exponential backoff
   */
  private retryLoadRewardedAd(): void {
    if (this.state.retryCount >= this.state.maxRetries) {
      console.error('[AdManager] Max retries reached, giving up');
      return;
    }

    this.state.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 30000);

    console.log(`[AdManager] Retrying in ${delay}ms (attempt ${this.state.retryCount}/${this.state.maxRetries})`);

    setTimeout(() => {
      this.loadRewardedAd();
    }, delay);
  }

  /**
   * Show rewarded ad with callback
   */
  async showRewardedAd(onRewarded: () => void): Promise<boolean> {
    console.log('[AdManager] Show rewarded ad requested');

    // Ensure initialized
    if (!this.state.initialized) {
      console.log('[AdManager] Not initialized, initializing now...');
      await this.initialize();

      // Wait for ad to load (max 5 seconds)
      let waitTime = 0;
      while (!this.state.rewardedAdLoaded && waitTime < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }
    }

    if (!this.state.rewardedAd) {
      console.error('[AdManager] No rewarded ad instance');
      return false;
    }

    if (!this.state.rewardedAdLoaded) {
      console.log('[AdManager] Rewarded ad not loaded yet');

      // Try loading again
      await this.loadRewardedAd();

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!this.state.rewardedAdLoaded) {
        console.error('[AdManager] Still not loaded after retry');
        return false;
      }
    }

    try {
      console.log('[AdManager] Showing rewarded ad...');

      // Set up one-time reward listener
      const unsubscribe = this.state.rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          console.log('[AdManager] Reward earned, calling callback');
          onRewarded();
          unsubscribe();
        }
      );

      await this.state.rewardedAd.show();
      return true;
    } catch (error) {
      console.error('[AdManager] Failed to show rewarded ad:', error);
      this.state.lastRewardedAdError = String(error);
      return false;
    }
  }

  /**
   * Get the correct ad unit ID
   */
  private getRewardedAdUnitId(): string {
    // Always use test ads in development
    if (__DEV__) {
      console.log('[AdManager] Using TEST rewarded ad ID');
      return TestIds.REWARDED;
    }

    // Production IDs
    const productionId = Platform.OS === 'ios'
      ? extra.admob?.rewardedAdUnitId?.ios
      : extra.admob?.rewardedAdUnitId?.android;

    if (!productionId) {
      console.error('[AdManager] Production ad ID not found, using test ID');
      return TestIds.REWARDED;
    }

    console.log('[AdManager] Using PRODUCTION rewarded ad ID');
    return productionId;
  }

  /**
   * Get current state for debugging
   */
  getState(): AdManagerState {
    return { ...this.state };
  }

  /**
   * Force reload ads (for debugging)
   */
  async forceReload(): Promise<void> {
    console.log('[AdManager] Force reloading ads...');
    this.state.retryCount = 0;
    await this.loadRewardedAd();
  }
}

export default AdManager.getInstance();