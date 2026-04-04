/**
 * Ad System Diagnostics Tool - Web Stub
 *
 * Web platform doesn't support AdMob.
 * This stub provides no-op implementations.
 */

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

export async function runAdDiagnostics(): Promise<AdDiagnosticsReport> {
  console.log('[AdDiagnostics] Web stub - ads not supported on web');

  return {
    timestamp: new Date().toISOString(),
    platform: 'web',
    environment: 'production',
    initialization: {
      sdkInitialized: false,
      managerInitialized: false,
      initializationErrors: ['Ads not supported on web'],
    },
    configuration: {
      appId: undefined,
      adUnitIds: {
        rewarded: undefined,
        interstitial: undefined,
        banner: undefined,
        appOpen: undefined,
      },
      testDevices: [],
    },
    adState: {
      rewardedAdLoaded: false,
      loadingRewardedAd: false,
      lastError: 'Ads not supported on web',
      retryCount: 0,
    },
    network: {
      isConnected: true,
      connectionType: 'web',
    },
    recommendations: ['AdMob is not supported on web platform'],
  };
}

export function formatDiagnosticsReport(report: AdDiagnosticsReport): string {
  return 'Ad diagnostics not available on web platform';
}

export async function quickHealthCheck(): Promise<boolean> {
  return false; // Always unhealthy on web
}

export async function testAdDisplay(): Promise<void> {
  console.log('[AdDiagnostics] Web stub - cannot test ads on web');
}