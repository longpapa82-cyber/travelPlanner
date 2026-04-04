/**
 * Ad System Diagnostics Tool
 *
 * Comprehensive diagnostics for debugging AdMob ad display issues.
 * This tool provides detailed information about the ad system state,
 * configuration, and potential issues.
 */

import { Platform } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import AdManager from './adManager';
import { isAdsInitialized, getTestDeviceHashes } from './initAds.native';
import Constants from 'expo-constants';

export interface AdDiagnosticsReport {
  timestamp: string;
  platform: string;
  environment: 'development' | 'production';
  initialization: {
    sdkInitialized: boolean;
    managerInitialized: boolean;
    initializationErrors: string[];
  };
  configuration: {
    appId: string | undefined;
    adUnitIds: {
      rewarded: string | undefined;
      interstitial: string | undefined;
      banner: string | undefined;
      appOpen: string | undefined;
    };
    testDevices: string[];
  };
  adState: {
    rewardedAdLoaded: boolean;
    loadingRewardedAd: boolean;
    lastError: string | null;
    retryCount: number;
  };
  network: {
    isConnected: boolean;
    connectionType: string | undefined;
  };
  recommendations: string[];
}

/**
 * Run comprehensive diagnostics on the ad system
 */
export async function runAdDiagnostics(): Promise<AdDiagnosticsReport> {
  console.log('[AdDiagnostics] 🔍 Starting comprehensive ad system diagnostics...');

  const extra = Constants.expoConfig?.extra || {};
  const adManagerState = AdManager.getState();
  const testDevices = getTestDeviceHashes();
  const recommendations: string[] = [];

  // Check network connectivity
  let isConnected = true;
  let connectionType: string | undefined;

  try {
    // Try to make a simple network request
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
    });
    isConnected = true;
  } catch (error) {
    isConnected = false;
    recommendations.push('❌ No internet connection - ads cannot load without network');
  }

  // Check SDK initialization
  const sdkInitialized = isAdsInitialized();
  const managerInitialized = (adManagerState as any).managerInitialized || false;

  if (!sdkInitialized) {
    recommendations.push('❌ AdMob SDK not initialized - check initAds.native.ts');
  }

  if (!managerInitialized) {
    recommendations.push('❌ AdManager not initialized - check adManager.native.ts');
  }

  // Check configuration
  const appId = Platform.OS === 'ios'
    ? process.env.ADMOB_IOS_APP_ID
    : process.env.ADMOB_ANDROID_APP_ID;

  if (!appId) {
    recommendations.push('❌ AdMob App ID not configured - check .env and app.config.js');
  }

  // Check ad unit IDs
  const adUnitIds = {
    rewarded: Platform.OS === 'ios'
      ? extra.admob?.rewardedAdUnitId?.ios
      : extra.admob?.rewardedAdUnitId?.android,
    interstitial: Platform.OS === 'ios'
      ? extra.admob?.interstitialAdUnitId?.ios
      : extra.admob?.interstitialAdUnitId?.android,
    banner: Platform.OS === 'ios'
      ? extra.admob?.bannerAdUnitId?.ios
      : extra.admob?.bannerAdUnitId?.android,
    appOpen: Platform.OS === 'ios'
      ? extra.admob?.appOpenAdUnitId?.ios
      : extra.admob?.appOpenAdUnitId?.android,
  };

  if (!adUnitIds.rewarded) {
    recommendations.push('❌ Rewarded ad unit ID not configured');
  }

  // Check ad loading state
  if (adManagerState.rewardedAdLoaded) {
    recommendations.push('✅ Rewarded ad is loaded and ready to show');
  } else if ((adManagerState as any).loadingRewardedAd) {
    recommendations.push('⏳ Rewarded ad is currently loading...');
  } else if (adManagerState.lastRewardedAdError) {
    const error = adManagerState.lastRewardedAdError;

    if (error.includes('No fill') || error.includes('ERROR_CODE_NO_FILL')) {
      recommendations.push('⚠️ No ads available - this is normal in some regions or for new accounts');
      recommendations.push('💡 Try: Add device as test device to see test ads');
    } else if (error.includes('Network') || error.includes('ERROR_CODE_NETWORK_ERROR')) {
      recommendations.push('❌ Network error loading ads - check internet connection');
    } else if (error.includes('Invalid') || error.includes('ERROR_CODE_INVALID_REQUEST')) {
      recommendations.push('❌ Invalid ad request - check ad unit IDs and account status');
    } else {
      recommendations.push(`❌ Ad loading error: ${error}`);
    }
  }

  // Check test device configuration
  if (__DEV__) {
    recommendations.push('✅ Development mode - should show test ads');
  } else {
    if (testDevices.length <= 2) { // Only EMULATOR and SIMULATOR
      recommendations.push('⚠️ No real test devices configured for production testing');
      recommendations.push('💡 Add device hashes to ALPHA_TEST_DEVICE_HASHES');
    }
  }

  // Check retry count
  if (adManagerState.retryCount > 3) {
    recommendations.push('⚠️ Multiple ad loading retries - check network and configuration');
  }

  // Build the report
  const report: AdDiagnosticsReport = {
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
    environment: __DEV__ ? 'development' : 'production',
    initialization: {
      sdkInitialized,
      managerInitialized,
      initializationErrors: adManagerState.lastRewardedAdError ? [adManagerState.lastRewardedAdError] : [],
    },
    configuration: {
      appId,
      adUnitIds,
      testDevices,
    },
    adState: {
      rewardedAdLoaded: adManagerState.rewardedAdLoaded,
      loadingRewardedAd: (adManagerState as any).loadingRewardedAd || false,
      lastError: adManagerState.lastRewardedAdError,
      retryCount: adManagerState.retryCount,
    },
    network: {
      isConnected,
      connectionType,
    },
    recommendations,
  };

  // Log the report
  console.log('[AdDiagnostics] 📊 Diagnostics Report:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}

/**
 * Format diagnostics report for display
 */
export function formatDiagnosticsReport(report: AdDiagnosticsReport): string {
  const lines: string[] = [
    '=== AD SYSTEM DIAGNOSTICS ===',
    `Timestamp: ${report.timestamp}`,
    `Platform: ${report.platform}`,
    `Environment: ${report.environment}`,
    '',
    '📱 INITIALIZATION:',
    `  SDK: ${report.initialization.sdkInitialized ? '✅' : '❌'}`,
    `  Manager: ${report.initialization.managerInitialized ? '✅' : '❌'}`,
    '',
    '⚙️ CONFIGURATION:',
    `  App ID: ${report.configuration.appId ? '✅' : '❌ Missing'}`,
    `  Rewarded Ad Unit: ${report.configuration.adUnitIds.rewarded ? '✅' : '❌ Missing'}`,
    `  Test Devices: ${report.configuration.testDevices.length} configured`,
    '',
    '📊 AD STATE:',
    `  Loaded: ${report.adState.rewardedAdLoaded ? '✅' : '❌'}`,
    `  Loading: ${report.adState.loadingRewardedAd ? '⏳' : '⏸'}`,
    `  Retry Count: ${report.adState.retryCount}`,
    `  Last Error: ${report.adState.lastError || 'None'}`,
    '',
    '🌐 NETWORK:',
    `  Connected: ${report.network.isConnected ? '✅' : '❌'}`,
    '',
    '💡 RECOMMENDATIONS:',
    ...report.recommendations.map(r => `  ${r}`),
  ];

  return lines.join('\n');
}

/**
 * Quick health check for ad system
 */
export async function quickHealthCheck(): Promise<boolean> {
  const report = await runAdDiagnostics();

  // System is healthy if:
  // 1. Both SDK and Manager are initialized
  // 2. Either ad is loaded OR no critical errors
  // 3. Network is connected

  const isHealthy =
    report.initialization.sdkInitialized &&
    report.initialization.managerInitialized &&
    report.network.isConnected &&
    (report.adState.rewardedAdLoaded || !report.adState.lastError?.includes('ERROR_CODE'));

  console.log(`[AdDiagnostics] Health Check: ${isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);

  return isHealthy;
}

/**
 * Test ad display with detailed logging
 */
export async function testAdDisplay(): Promise<void> {
  console.log('[AdDiagnostics] 🎮 Testing ad display...');

  // Run diagnostics first
  const report = await runAdDiagnostics();

  if (!report.initialization.sdkInitialized || !report.initialization.managerInitialized) {
    console.error('[AdDiagnostics] ❌ Cannot test - system not initialized');
    return;
  }

  if (!report.network.isConnected) {
    console.error('[AdDiagnostics] ❌ Cannot test - no network connection');
    return;
  }

  console.log('[AdDiagnostics] 📺 Attempting to show rewarded ad...');

  try {
    const success = await AdManager.showRewardedAd(() => {
      console.log('[AdDiagnostics] 🎁 Reward granted!');
    });

    if (success) {
      console.log('[AdDiagnostics] ✅ Ad displayed successfully');
    } else {
      console.log('[AdDiagnostics] ⚠️ Ad display failed but reward was granted');
    }
  } catch (error) {
    console.error('[AdDiagnostics] ❌ Ad display error:', error);
  }
}