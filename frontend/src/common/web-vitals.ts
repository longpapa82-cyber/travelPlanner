import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

/**
 * Report Core Web Vitals metrics.
 * Only runs on web platform. Sends to Sentry custom measurements when available,
 * otherwise logs to console in development.
 */
export function initWebVitals() {
  if (Platform.OS !== 'web') return;

  import('web-vitals').then(({ onCLS, onLCP, onFCP, onTTFB, onINP }) => {
    const report = (metric: { name: string; value: number; id: string }) => {
      if (__DEV__) {
        console.debug(`[WebVital] ${metric.name}: ${metric.value.toFixed(2)}`);
      }
      Sentry.addBreadcrumb({
        category: 'web-vital',
        message: `${metric.name}: ${metric.value.toFixed(2)}`,
        level: 'info',
        data: { name: metric.name, value: metric.value, id: metric.id },
      });
    };

    onCLS(report);
    onINP(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  });
}
