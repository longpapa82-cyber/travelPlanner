/**
 * AdManager - Enhanced Singleton Pattern for Robust Ad Management
 *
 * CRITICAL FIXES FOR P0 BUG:
 * 1. Proper SDK initialization with mobileAds
 * 2. Enhanced test device detection and configuration
 * 3. Comprehensive error handling and recovery
 * 4. Detailed logging for debugging Alpha test issues
 * 5. Fallback mechanisms for ad loading failures
 */

import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
  InterstitialAd,
  AppOpenAd,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';
import { Platform, DeviceEventEmitter } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

// Critical: Add known Alpha tester device hashes here
const KNOWN_TEST_DEVICE_HASHES: string[] = [
  'EMULATOR',
  'SIMULATOR',
  // Add Alpha tester device hashes here as they're discovered
  // These will be shown in logs when ads fail to load
];

interface AdManagerState {
  sdkInitialized: boolean;
  managerInitialized: boolean;
  rewardedAd: RewardedAd | null;
  interstitialAd: InterstitialAd | null;
  appOpenAd: AppOpenAd | null;
  loadingRewardedAd: boolean;
  rewardedAdLoaded: boolean;
  lastRewardedAdError: string | null;
  retryCount: number;
  maxRetries: number;
  deviceHash: string | null;
  isTestDevice: boolean;
}

class AdManager {
  private static instance: AdManager;
  private state: AdManagerState = {
    sdkInitialized: false,
    managerInitialized: false,
    rewardedAd: null,
    interstitialAd: null,
    appOpenAd: null,
    loadingRewardedAd: false,
    rewardedAdLoaded: false,
    lastRewardedAdError: null,
    retryCount: 0,
    maxRetries: 5, // Increased for Alpha testing
    deviceHash: null,
    isTestDevice: false,
  };

  private initializationPromise: Promise<void> | null = null;
  private rewardedAdListenersSetup = false;

  private constructor() {
    console.log('[AdManager] 🚀 Singleton instance created');
    this.detectDeviceInfo();
  }

  static getInstance(): AdManager {
    if (!AdManager.instance) {
      AdManager.instance = new AdManager();
    }
    return AdManager.instance;
  }

  /**
   * Detect device information for debugging
   */
  private detectDeviceInfo(): void {
    // Listen for device hash detection from failed ad loads
    DeviceEventEmitter.addListener('AdMobDeviceHashDetected', (hash: string) => {
      if (hash && hash !== this.state.deviceHash) {
        console.log('[AdManager] 🔑 Device hash detected:', hash);
        console.log('[AdManager] ⚠️  Add this hash to KNOWN_TEST_DEVICE_HASHES for test ads');
        this.state.deviceHash = hash;
      }
    });
  }

  /**
   * Initialize the SDK and ad manager - idempotent
   */
  async initialize(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      console.log('[AdManager] ⏳ Waiting for existing initialization...');
      return this.initializationPromise;
    }

    if (this.state.managerInitialized) {
      console.log('[AdManager] ✅ Already initialized');
      return Promise.resolve();
    }

    // Create and store the initialization promise
    this.initializationPromise = this.performInitialization();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    console.log('[AdManager] 🎯 Starting comprehensive initialization...');

    try {
      // Step 1: Initialize SDK if not already done
      if (!this.state.sdkInitialized) {
        await this.initializeSDK();
      }

      // Step 2: Initialize rewarded ad
      await this.initializeRewardedAd();

      this.state.managerInitialized = true;
      console.log('[AdManager] ✅ Initialization complete');
    } catch (error) {
      console.error('[AdManager] ❌ Initialization failed:', error);
      this.state.lastRewardedAdError = String(error);

      // Schedule retry with longer delay for initialization
      setTimeout(() => {
        this.initializationPromise = null;
        this.initialize();
      }, 10000);

      throw error;
    }
  }

  /**
   * Initialize the AdMob SDK with proper configuration
   */
  private async initializeSDK(): Promise<void> {
    console.log('[AdManager] 📱 Initializing AdMob SDK...');

    try {
      // Configure test devices and content rating
      const testDevices = [...KNOWN_TEST_DEVICE_HASHES];

      // In development, always use test ads
      const isDev = __DEV__;
      this.state.isTestDevice = isDev;

      console.log('[AdManager] 🔧 Configuration:', {
        mode: isDev ? 'DEVELOPMENT' : 'PRODUCTION',
        testDevices: testDevices.length,
        platform: Platform.OS,
      });

      // Set request configuration
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
        testDeviceIdentifiers: testDevices,
      });

      // Initialize the SDK
      const adapterStatuses = await mobileAds().initialize();

      // Log adapter status for debugging
      console.log('[AdManager] 📊 SDK Initialization complete. Adapter statuses:');
      Object.keys(adapterStatuses).forEach(adapter => {
        const status = (adapterStatuses as any)[adapter];
        console.log(`[AdManager]   ${adapter}: ${status.state} (${status.description || 'ready'})`);
      });

      this.state.sdkInitialized = true;
      console.log('[AdManager] ✅ SDK initialized successfully');
    } catch (error) {
      console.error('[AdManager] ❌ SDK initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize rewarded ad with enhanced error handling
   */
  private async initializeRewardedAd(): Promise<void> {
    const adUnitId = this.getRewardedAdUnitId();
    const idPrefix = adUnitId.substring(0, 30);
    console.log('[AdManager] 🎮 Creating rewarded ad with ID:', idPrefix + '...');

    try {
      // Create new ad instance
      this.state.rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
        keywords: ['travel', 'vacation', 'trip', 'tourism', 'hotels', 'flights'],
      });

      // Set up event listeners only once
      if (!this.rewardedAdListenersSetup) {
        this.setupRewardedAdListeners();
        this.rewardedAdListenersSetup = true;
      }

      // Load the ad
      await this.loadRewardedAd();
    } catch (error) {
      console.error('[AdManager] ❌ Failed to initialize rewarded ad:', error);
      this.extractDeviceHashFromError(error);
      throw error;
    }
  }

  /**
   * Extract device hash from error messages for test device configuration
   */
  private extractDeviceHashFromError(error: any): void {
    const errorMessage = String(error);

    // Look for device hash in error message
    const hashMatch = errorMessage.match(/device:\s*([A-F0-9]{32})/i);
    if (hashMatch && hashMatch[1]) {
      const hash = hashMatch[1];
      console.log('[AdManager] 🔍 Found device hash in error:', hash);
      console.log('[AdManager] ⚠️  ACTION REQUIRED: Add this to KNOWN_TEST_DEVICE_HASHES');
      DeviceEventEmitter.emit('AdMobDeviceHashDetected', hash);
    }

    // Also check for "Use test ads" message which includes the hash
    const testAdsMatch = errorMessage.match(/setTestDeviceIds.*"([A-F0-9]{32})"/i);
    if (testAdsMatch && testAdsMatch[1]) {
      const hash = testAdsMatch[1];
      console.log('[AdManager] 🔍 Found test device hash:', hash);
      console.log('[AdManager] ⚠️  ACTION REQUIRED: Add this to KNOWN_TEST_DEVICE_HASHES');
      DeviceEventEmitter.emit('AdMobDeviceHashDetected', hash);
    }
  }

  /**
   * Set up all rewarded ad event listeners with enhanced logging
   */
  private setupRewardedAdListeners(): void {
    if (!this.state.rewardedAd) return;

    console.log('[AdManager] 🎧 Setting up rewarded ad listeners...');

    // Load event
    this.state.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[AdManager] ✅ Rewarded ad loaded successfully');
      this.state.rewardedAdLoaded = true;
      this.state.loadingRewardedAd = false;
      this.state.retryCount = 0;
      this.state.lastRewardedAdError = null;
    });

    // Error event
    this.state.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('[AdManager] ❌ Rewarded ad error:', error);
      this.state.rewardedAdLoaded = false;
      this.state.loadingRewardedAd = false;
      this.state.lastRewardedAdError = String(error);

      // Extract device hash from error
      this.extractDeviceHashFromError(error);

      // Log helpful debugging info
      this.logDebugInfo(error);

      // Retry with exponential backoff
      this.retryLoadRewardedAd();
    });

    // Earned reward event
    this.state.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      console.log('[AdManager] 🎁 User earned reward:', reward);
    });

    // Opened event
    this.state.rewardedAd.addAdEventListener(AdEventType.OPENED, () => {
      console.log('[AdManager] 📺 Rewarded ad opened');
    });

    // Closed event
    this.state.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdManager] 📪 Rewarded ad closed, reloading...');
      this.state.rewardedAdLoaded = false;
      // Reload for next use
      setTimeout(() => this.loadRewardedAd(), 1000);
    });
  }

  /**
   * Log helpful debugging information when ads fail
   */
  private logDebugInfo(error: any): void {
    console.log('[AdManager] 🔍 DEBUG INFO:');
    console.log('[AdManager] - Platform:', Platform.OS);
    console.log('[AdManager] - Mode:', __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION');
    console.log('[AdManager] - SDK Initialized:', this.state.sdkInitialized);
    console.log('[AdManager] - Test Device:', this.state.isTestDevice);
    console.log('[AdManager] - Retry Count:', this.state.retryCount);
    console.log('[AdManager] - Ad Unit ID Type:', __DEV__ ? 'TEST' : 'PRODUCTION');

    const errorStr = String(error);
    if (errorStr.includes('No fill') || errorStr.includes('ERROR_CODE_NO_FILL')) {
      console.log('[AdManager] ℹ️  No ads available. Common causes:');
      console.log('[AdManager]    1. Limited ad inventory in your region');
      console.log('[AdManager]    2. AdMob account not fully activated');
      console.log('[AdManager]    3. New ad units need time to serve ads');
      console.log('[AdManager]    4. Test device not properly configured');
    } else if (errorStr.includes('Network error') || errorStr.includes('ERROR_CODE_NETWORK_ERROR')) {
      console.log('[AdManager] ℹ️  Network issue. Check:');
      console.log('[AdManager]    1. Internet connectivity');
      console.log('[AdManager]    2. VPN/Proxy settings');
      console.log('[AdManager]    3. Firewall restrictions');
    } else if (errorStr.includes('Invalid request') || errorStr.includes('ERROR_CODE_INVALID_REQUEST')) {
      console.log('[AdManager] ℹ️  Configuration issue. Check:');
      console.log('[AdManager]    1. Ad unit IDs are correct');
      console.log('[AdManager]    2. App ID matches package name');
      console.log('[AdManager]    3. AdMob account status');
    }
  }

  /**
   * Load rewarded ad with enhanced error handling
   */
  private async loadRewardedAd(): Promise<void> {
    if (!this.state.rewardedAd) {
      console.log('[AdManager] ⚠️  No ad instance, creating new one...');
      await this.initializeRewardedAd();
      return;
    }

    if (this.state.loadingRewardedAd) {
      console.log('[AdManager] ⏳ Already loading, skipping...');
      return;
    }

    if (this.state.rewardedAdLoaded) {
      console.log('[AdManager] ✅ Ad already loaded');
      return;
    }

    try {
      console.log('[AdManager] 📥 Loading rewarded ad...');
      this.state.loadingRewardedAd = true;
      await this.state.rewardedAd.load();
    } catch (error) {
      console.error('[AdManager] ❌ Failed to load rewarded ad:', error);
      this.state.loadingRewardedAd = false;
      this.state.lastRewardedAdError = String(error);
      this.extractDeviceHashFromError(error);
      this.logDebugInfo(error);
      this.retryLoadRewardedAd();
    }
  }

  /**
   * Retry loading with exponential backoff
   */
  private retryLoadRewardedAd(): void {
    if (this.state.retryCount >= this.state.maxRetries) {
      console.error('[AdManager] ⛔ Max retries reached');
      console.log('[AdManager] 💡 TIP: Check AdMob dashboard for account/ad unit issues');
      return;
    }

    this.state.retryCount++;
    const delay = Math.min(2000 * Math.pow(1.5, this.state.retryCount), 30000);

    console.log(`[AdManager] 🔄 Retrying in ${delay}ms (attempt ${this.state.retryCount}/${this.state.maxRetries})`);

    setTimeout(() => {
      this.loadRewardedAd();
    }, delay);
  }

  /**
   * Show rewarded ad with comprehensive fallback
   */
  async showRewardedAd(onRewarded: () => void): Promise<boolean> {
    console.log('[AdManager] 🎬 Show rewarded ad requested');

    try {
      // Ensure initialized
      if (!this.state.managerInitialized) {
        console.log('[AdManager] ⚙️  Not initialized, initializing now...');
        await this.initialize();

        // Wait for ad to load (max 5 seconds)
        let waitTime = 0;
        while (!this.state.rewardedAdLoaded && waitTime < 5000) {
          await new Promise(resolve => setTimeout(resolve, 500));
          waitTime += 500;
        }
      }

      if (!this.state.rewardedAd) {
        console.error('[AdManager] ❌ No rewarded ad instance');
        console.log('[AdManager] 🎁 Falling back: Granting reward anyway');
        onRewarded();
        return false;
      }

      if (!this.state.rewardedAdLoaded) {
        console.log('[AdManager] ⚠️  Ad not loaded, attempting reload...');

        // Try one more load
        await this.loadRewardedAd();

        // Wait briefly
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!this.state.rewardedAdLoaded) {
          console.error('[AdManager] ❌ Still not loaded after reload');
          console.log('[AdManager] 🎁 Falling back: Granting reward anyway');
          onRewarded();
          return false;
        }
      }

      console.log('[AdManager] 📺 Showing rewarded ad...');

      // Set up one-time reward listener
      const unsubscribe = this.state.rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          console.log('[AdManager] 🎁 Reward earned!');
          onRewarded();
          unsubscribe();
        }
      );

      // Also add error handler for show failure
      const errorUnsubscribe = this.state.rewardedAd.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.error('[AdManager] ❌ Error during show:', error);
          console.log('[AdManager] 🎁 Falling back: Granting reward anyway');
          onRewarded();
          errorUnsubscribe();
        }
      );

      await this.state.rewardedAd.show();
      return true;

    } catch (error) {
      console.error('[AdManager] ❌ Failed to show rewarded ad:', error);
      this.state.lastRewardedAdError = String(error);
      this.extractDeviceHashFromError(error);
      this.logDebugInfo(error);

      // Always grant reward on error to not frustrate users
      console.log('[AdManager] 🎁 Falling back: Granting reward anyway');
      onRewarded();
      return false;
    }
  }

  /**
   * Get the correct ad unit ID with enhanced logging
   */
  private getRewardedAdUnitId(): string {
    // Always use test ads in development
    if (__DEV__) {
      console.log('[AdManager] 🧪 Using TEST rewarded ad ID');
      return TestIds.REWARDED;
    }

    // Production IDs from config
    const productionId = Platform.OS === 'ios'
      ? extra.admob?.rewardedAdUnitId?.ios
      : extra.admob?.rewardedAdUnitId?.android;

    if (!productionId) {
      console.error('[AdManager] ⚠️  Production ad ID not found in config!');
      console.log('[AdManager] 🧪 Falling back to TEST ad ID');
      return TestIds.REWARDED;
    }

    console.log('[AdManager] 🏭 Using PRODUCTION rewarded ad ID for', Platform.OS);
    return productionId;
  }

  /**
   * Get current state for debugging
   */
  getState(): AdManagerState {
    return { ...this.state };
  }

  /**
   * Force reload ads (for debugging and recovery)
   */
  async forceReload(): Promise<void> {
    console.log('[AdManager] 🔄 Force reloading ads...');
    this.state.retryCount = 0;
    this.state.rewardedAdLoaded = false;
    this.state.lastRewardedAdError = null;

    if (!this.state.managerInitialized) {
      await this.initialize();
    } else {
      await this.loadRewardedAd();
    }
  }

  /**
   * Reset the manager (for critical recovery)
   */
  async reset(): Promise<void> {
    console.log('[AdManager] 🔄 Resetting AdManager...');

    // Clear state
    this.state.rewardedAd = null;
    this.state.rewardedAdLoaded = false;
    this.state.loadingRewardedAd = false;
    this.state.managerInitialized = false;
    this.state.retryCount = 0;
    this.rewardedAdListenersSetup = false;

    // Reinitialize
    await this.initialize();
  }
}

export default AdManager.getInstance();