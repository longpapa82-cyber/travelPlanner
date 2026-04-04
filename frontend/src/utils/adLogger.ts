/**
 * Enhanced Ad System Logger for Alpha Testing
 *
 * Provides comprehensive logging for ad initialization, loading, and display
 * with automatic error reporting and metrics collection.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface AdEvent {
  timestamp: Date;
  event: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  data?: any;
  deviceInfo?: {
    platform: string;
    version: string;
    deviceHash?: string;
    isTestDevice?: boolean;
  };
}

class AdLogger {
  private events: AdEvent[] = [];
  private maxEvents = 100;

  constructor() {
    this.log('info', 'AdLogger initialized', {
      platform: Platform.OS,
      version: Platform.Version,
      appOwnership: Constants.appOwnership,
    });
  }

  log(level: AdEvent['level'], event: string, data?: any) {
    const logEntry: AdEvent = {
      timestamp: new Date(),
      event,
      level,
      data,
      deviceInfo: {
        platform: Platform.OS,
        version: String(Platform.Version),
      },
    };

    // Console output with color coding
    const colors = {
      info: '\x1b[36m',    // Cyan
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[90m',   // Gray
    };

    const reset = '\x1b[0m';
    const prefix = `${colors[level]}[AdLogger:${level.toUpperCase()}]${reset}`;

    console.log(`${prefix} ${event}`, data || '');

    // Store event
    this.events.push(logEntry);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Send critical errors to backend
    if (level === 'error') {
      this.reportError(event, data);
    }
  }

  private async reportError(event: string, data?: any) {
    try {
      // Send to backend analytics
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/analytics/ad-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          data,
          deviceInfo: {
            platform: Platform.OS,
            version: Platform.Version,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error('[AdLogger] Failed to report error:', error);
    }
  }

  // Get formatted log for debugging
  getFormattedLog(): string {
    return this.events
      .map(e => `[${e.timestamp.toISOString()}] ${e.level.toUpperCase()}: ${e.event}`)
      .join('\n');
  }

  // Clear logs
  clear() {
    this.events = [];
  }

  // Export logs for debugging
  exportLogs(): AdEvent[] {
    return [...this.events];
  }
}

export const adLogger = new AdLogger();

// Helper functions for common logging scenarios
export const logAdInit = (success: boolean, details?: any) => {
  adLogger.log(
    success ? 'info' : 'error',
    success ? 'Ad SDK initialized successfully' : 'Ad SDK initialization failed',
    details
  );
};

export const logAdLoad = (adType: string, success: boolean, details?: any) => {
  adLogger.log(
    success ? 'info' : 'warning',
    `${adType} ad ${success ? 'loaded' : 'failed to load'}`,
    details
  );
};

export const logAdShow = (adType: string, success: boolean, details?: any) => {
  adLogger.log(
    success ? 'info' : 'error',
    `${adType} ad ${success ? 'shown' : 'failed to show'}`,
    details
  );
};

export const logAdReward = (earned: boolean, amount?: number, type?: string) => {
  adLogger.log(
    'info',
    earned ? 'User earned reward' : 'User did not earn reward',
    { earned, amount, type }
  );
};

export const logDeviceInfo = (deviceHash: string | null, isTestDevice: boolean) => {
  adLogger.log('debug', 'Device information', {
    deviceHash,
    isTestDevice,
    hint: !isTestDevice && deviceHash
      ? `Add this hash to test devices: ${deviceHash}`
      : undefined,
  });
};