/**
 * Ad Debugger Utility
 *
 * Comprehensive debugging tools for Alpha testing ad issues.
 * Provides detailed diagnostics and troubleshooting guidance.
 */

import { Platform } from 'react-native';

export interface AdDebugInfo {
  platform: string;
  mode: 'development' | 'production';
  timestamp: string;
  adManagerState?: any;
  sdkInitialized?: boolean;
  testDeviceConfigured?: boolean;
  deviceHash?: string | null;
  lastError?: string | null;
  suggestions: string[];
}

/**
 * Collect comprehensive debugging information
 */
export async function collectAdDebugInfo(): Promise<AdDebugInfo> {
  const info: AdDebugInfo = {
    platform: Platform.OS,
    mode: __DEV__ ? 'development' : 'production',
    timestamp: new Date().toISOString(),
    suggestions: [],
  };

  try {
    // Check if ads are initialized
    const { isAdsInitialized } = require('./initAds');
    info.sdkInitialized = isAdsInitialized();

    // Get AdManager state
    const AdManager = require('./adManager').default;
    const state = AdManager.getState();
    info.adManagerState = state;
    info.deviceHash = state.deviceHash;
    info.lastError = state.lastRewardedAdError;
    info.testDeviceConfigured = state.isTestDevice;

    // Generate suggestions based on state
    info.suggestions = generateSuggestions(info);

  } catch (error) {
    info.lastError = String(error);
    info.suggestions.push('Failed to collect debug info - check console for errors');
  }

  return info;
}

/**
 * Generate troubleshooting suggestions based on current state
 */
function generateSuggestions(info: AdDebugInfo): string[] {
  const suggestions: string[] = [];

  // Check SDK initialization
  if (!info.sdkInitialized) {
    suggestions.push('AdMob SDK not initialized - check app startup logs');
    suggestions.push('Try restarting the app');
  }

  // Check AdManager state
  if (info.adManagerState) {
    const state = info.adManagerState;

    if (!state.managerInitialized) {
      suggestions.push('AdManager not initialized - check initialization logs');
    }

    if (!state.rewardedAdLoaded && state.retryCount >= state.maxRetries) {
      suggestions.push('Max retries reached - ad unit may have issues');
      suggestions.push('Check AdMob dashboard for account/ad unit status');
    }

    if (state.lastRewardedAdError) {
      const error = state.lastRewardedAdError.toLowerCase();

      if (error.includes('no fill')) {
        suggestions.push('No ads available in your region');
        suggestions.push('This is common for new ad units - wait 24-48 hours');
        suggestions.push('Try using VPN to test from different location');
      } else if (error.includes('network')) {
        suggestions.push('Network connectivity issue detected');
        suggestions.push('Check internet connection');
        suggestions.push('Disable VPN/proxy if active');
      } else if (error.includes('invalid')) {
        suggestions.push('Configuration issue detected');
        suggestions.push('Verify ad unit IDs in app.config.js');
        suggestions.push('Check AdMob account approval status');
      }
    }
  }

  // Production-specific suggestions
  if (info.mode === 'production') {
    if (!info.testDeviceConfigured) {
      suggestions.push('Device not configured as test device');
      suggestions.push('Look for "DEVICE HASH DETECTED" in console logs');
      suggestions.push('Add hash to ALPHA_TEST_DEVICE_HASHES and rebuild');
    }

    suggestions.push('Ensure AdMob account is fully approved');
    suggestions.push('Check if app is published on Play Store (improves ad serving)');
  }

  // Add device hash if found
  if (info.deviceHash) {
    suggestions.push(`Your device hash: ${info.deviceHash}`);
    suggestions.push('Add this to ALPHA_TEST_DEVICE_HASHES for test ads');
  }

  if (suggestions.length === 0) {
    suggestions.push('No issues detected - ads should be working');
  }

  return suggestions;
}

/**
 * Format debug info for display or logging
 */
export function formatDebugInfo(info: AdDebugInfo): string {
  const lines: string[] = [
    '====== AD DEBUG REPORT ======',
    `Timestamp: ${info.timestamp}`,
    `Platform: ${info.platform}`,
    `Mode: ${info.mode}`,
    `SDK Initialized: ${info.sdkInitialized ? 'YES' : 'NO'}`,
  ];

  if (info.adManagerState) {
    lines.push('');
    lines.push('AdManager State:');
    lines.push(`  Manager Initialized: ${info.adManagerState.managerInitialized}`);
    lines.push(`  Ad Loaded: ${info.adManagerState.rewardedAdLoaded}`);
    lines.push(`  Loading: ${info.adManagerState.loadingRewardedAd}`);
    lines.push(`  Retry Count: ${info.adManagerState.retryCount}/${info.adManagerState.maxRetries}`);
    lines.push(`  Test Device: ${info.adManagerState.isTestDevice ? 'YES' : 'NO'}`);
  }

  if (info.lastError) {
    lines.push('');
    lines.push('Last Error:');
    lines.push(`  ${info.lastError}`);
  }

  if (info.deviceHash) {
    lines.push('');
    lines.push('Device Hash:');
    lines.push(`  ${info.deviceHash}`);
  }

  if (info.suggestions.length > 0) {
    lines.push('');
    lines.push('Troubleshooting Suggestions:');
    info.suggestions.forEach((suggestion, index) => {
      lines.push(`  ${index + 1}. ${suggestion}`);
    });
  }

  lines.push('============================');

  return lines.join('\n');
}

/**
 * Log debug info to console with formatting
 */
export async function logAdDebugInfo(): Promise<void> {
  const info = await collectAdDebugInfo();
  const formatted = formatDebugInfo(info);
  console.log(formatted);
}

/**
 * Test ad configuration without showing ads
 */
export async function testAdConfiguration(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('[AdDebugger] Testing ad configuration...');

    // Check SDK initialization
    const { isAdsInitialized } = require('./initAds');
    if (!isAdsInitialized()) {
      return {
        success: false,
        message: 'AdMob SDK not initialized',
        details: { suggestion: 'Check app startup logs for initialization errors' },
      };
    }

    // Check AdManager
    const AdManager = require('./adManager').default;
    const state = AdManager.getState();

    if (!state.managerInitialized) {
      return {
        success: false,
        message: 'AdManager not initialized',
        details: { suggestion: 'AdManager initialization failed - check logs' },
      };
    }

    if (state.rewardedAdLoaded) {
      return {
        success: true,
        message: 'Ad configuration is working correctly',
        details: { adLoaded: true, testDevice: state.isTestDevice },
      };
    }

    if (state.loadingRewardedAd) {
      return {
        success: false,
        message: 'Ad is currently loading',
        details: { suggestion: 'Wait a moment and try again' },
      };
    }

    if (state.lastRewardedAdError) {
      return {
        success: false,
        message: 'Ad loading failed',
        details: {
          error: state.lastRewardedAdError,
          retries: `${state.retryCount}/${state.maxRetries}`,
        },
      };
    }

    return {
      success: false,
      message: 'Unknown ad state',
      details: state,
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error testing ad configuration',
      details: { error: String(error) },
    };
  }
}

/**
 * Force reset ads for troubleshooting
 */
export async function resetAds(): Promise<void> {
  try {
    console.log('[AdDebugger] Resetting ads...');

    const AdManager = require('./adManager').default;
    await AdManager.reset();

    console.log('[AdDebugger] Ads reset complete');
  } catch (error) {
    console.error('[AdDebugger] Failed to reset ads:', error);
    throw error;
  }
}