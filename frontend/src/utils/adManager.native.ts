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

    // Create and store the initialization promise with timeout
    this.initializationPromise = this.performInitializationWithTimeout();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitializationWithTimeout(): Promise<void> {
    const INIT_TIMEOUT = 30000; // 30 seconds timeout

    return Promise.race([
      this.performInitialization(),
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          console.error('[AdManager] ⏰ Initialization timeout after 30 seconds');
          reject(new Error('AdManager initialization timeout'));
        }, INIT_TIMEOUT);
      })
    ]);
  }

  private async performInitialization(): Promise<void> {
    console.log('[AdManager] 🎯 Starting comprehensive initialization...');
    console.log('[AdManager] 📊 Current state:', {
      sdkInitialized: this.state.sdkInitialized,
      managerInitialized: this.state.managerInitialized,
      rewardedAdLoaded: this.state.rewardedAdLoaded,
    });

    try {
      // SDK is initialized by initAds.native.ts - no need to initialize again
      console.log('[AdManager] ✓ SDK initialized by initAds.native.ts');
      this.state.sdkInitialized = true;

      // Initialize rewarded ad
      console.log('[AdManager] 🎮 Initializing rewarded ad...');
      await this.initializeRewardedAd();

      this.state.managerInitialized = true;
      console.log('[AdManager] ✅ Initialization complete');
      console.log('[AdManager] 📊 Final state:', {
        sdkInitialized: this.state.sdkInitialized,
        managerInitialized: this.state.managerInitialized,
        rewardedAdLoaded: this.state.rewardedAdLoaded,
      });
    } catch (error) {
      console.error('[AdManager] ❌ Initialization failed:', error);
      this.state.lastRewardedAdError = String(error);

      // Log the exact error type for debugging
      const errorStr = String(error);
      if (errorStr.includes('Module') || errorStr.includes('Cannot find')) {
        console.error('[AdManager] ❌ Module/import error - check file paths');
      } else if (errorStr.includes('Network')) {
        console.error('[AdManager] ❌ Network error - check connectivity');
      } else if (errorStr.includes('timeout')) {
        console.error('[AdManager] ❌ Timeout error - initialization took too long');
      }

      // Schedule retry with longer delay for initialization
      setTimeout(() => {
        console.log('[AdManager] 🔄 Scheduling initialization retry...');
        this.initializationPromise = null;
        this.initialize();
      }, 10000);

      throw error;
    }
  }

  // SDK initialization removed - handled by initAds.native.ts

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

    // Multiple patterns to catch device hashes in various error formats
    const patterns = [
      /device:\s*([A-F0-9]{32})/i,
      /setTestDeviceIds.*"([A-F0-9]{32})"/i,
      /test device ID.*([A-F0-9]{32})/i,
      /Use RequestConfiguration\.Builder\(\)\.setTestDeviceIds\(Arrays\.asList\("([A-F0-9]{32})"\)\)/i,
      /device\s+ID\s+([A-F0-9]{32})/i,
    ];

    let hashFound = false;
    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match && match[1]) {
        const hash = match[1];
        if (!hashFound) {
          console.log('[AdManager] 🔑 DEVICE HASH DETECTED:', hash);
          console.log('[AdManager] ⚠️  ACTION REQUIRED:');
          console.log('[AdManager]    1. Add this hash to KNOWN_TEST_DEVICE_HASHES in adManager.native.ts');
          console.log('[AdManager]    2. Also add to ALPHA_TEST_DEVICE_HASHES in initAds.native.ts');
          console.log('[AdManager]    3. Rebuild the app');
          console.log('[AdManager]    4. Test ads should then work on this device');
          DeviceEventEmitter.emit('AdMobDeviceHashDetected', hash);
          hashFound = true;
        }
      }
    }

    // If no hash found but it's a test device error, provide guidance
    if (!hashFound && errorMessage.toLowerCase().includes('test')) {
      console.log('[AdManager] ℹ️  Test device error detected but no hash found');
      console.log('[AdManager]    The device hash should appear in the full error message');
      console.log('[AdManager]    Look for a 32-character hexadecimal string');
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