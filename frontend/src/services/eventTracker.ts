/**
 * Lightweight event analytics tracker.
 * - Records Sentry breadcrumbs for crash-context enrichment
 * - Batches events and flushes to backend every 30 seconds
 * - Fire-and-forget: never blocks UI
 */

import * as Sentry from '@sentry/react-native';
import { AppState, Platform } from 'react-native';
import apiService from './api';
import { isAuthLoggingOut } from '../contexts/AuthContext';

export type EventName =
  | 'login'
  | 'register'
  | 'logout'
  | 'trip_created'
  | 'trip_viewed'
  | 'trip_edited'
  | 'trip_deleted'
  | 'trip_shared'
  | 'trip_duplicated'
  | 'activity_added'
  | 'activity_edited'
  | 'activity_deleted'
  | 'photo_uploaded'
  | 'cover_changed'
  | '2fa_enabled'
  | '2fa_disabled'
  | '2fa_backup_regenerated'
  | 'search'
  | 'filter_applied'
  | 'user_followed'
  | 'user_unfollowed'
  | 'trip_liked'
  | 'trip_unliked'
  | 'feed_viewed'
  | 'profile_viewed'
  | 'trip_exported_ical';

interface AnalyticsEvent {
  name: EventName;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
}

const eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, 30000);

  // Flush when app goes to background. V186 (Invariant 36 강화): logout
  // 진행 중에는 flush가 401을 받아 onAuthExpired callback을 fire시키는
  // race window를 만들지 않도록 차단. logout 자체에서 logout 이벤트는
  // logout()이 trackEvent + flushEvents 직접 호출하므로 누락 없음.
  AppState.addEventListener('change', (state) => {
    if (isAuthLoggingOut()) return;
    if (state !== 'active') flush();
  });
}

async function flush() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, eventQueue.length);
  try {
    await apiService.post('/analytics/events', { events: batch });
  } catch {
    // Silent fail — events are best-effort
  }
}

/**
 * Track a user event.
 * Non-blocking — adds to Sentry breadcrumbs and queues for backend.
 */
export function trackEvent(name: EventName, properties?: Record<string, string | number | boolean>) {
  // Sentry breadcrumb for crash context
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: name,
    level: 'info',
    data: properties,
  });

  // Queue for backend
  eventQueue.push({
    name,
    properties: {
      platform: Platform.OS,
      ...properties,
    },
    timestamp: Date.now(),
  });

  startFlushTimer();
}

/**
 * Flush remaining events immediately (call on logout/app close).
 */
export function flushEvents() {
  flush();
}
