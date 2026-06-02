import { Platform } from 'react-native';

/**
 * Report Core Web Vitals metrics.
 * Only runs on web platform. Logs to console in development.
 */
export function initWebVitals() {
  if (Platform.OS !== 'web') return;

  import('web-vitals').then(({ onCLS, onLCP, onFCP, onTTFB, onINP }) => {
    const report = (metric: { name: string; value: number; id: string }) => {
      if (__DEV__) {
        console.debug(`[WebVital] ${metric.name}: ${metric.value.toFixed(2)}`);
      }
    };

    onCLS(report);
    onINP(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  });
}
