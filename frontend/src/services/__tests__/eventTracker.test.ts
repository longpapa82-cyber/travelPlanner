import { AppState } from 'react-native';
import * as Sentry from '@sentry/react-native';

// Must mock api before importing eventTracker
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(() => Promise.resolve()),
  },
}));

import apiService from '../api';
import { trackEvent, flushEvents } from '../eventTracker';

describe('eventTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── trackEvent ──

  describe('trackEvent', () => {
    it('should add Sentry breadcrumb', () => {
      trackEvent('login', { method: 'email' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'user-action',
        message: 'login',
        level: 'info',
        data: { method: 'email' },
      });
    });

    it('should include platform in queued event properties', () => {
      trackEvent('trip_created');

      // Flush to check queued data
      flushEvents();

      expect(apiService.post).toHaveBeenCalledWith(
        '/analytics/events',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              name: 'trip_created',
              properties: expect.objectContaining({
                platform: expect.any(String),
              }),
              timestamp: expect.any(Number),
            }),
          ]),
        }),
      );
    });

    it('should merge custom properties with platform', () => {
      trackEvent('search', { query: 'Tokyo' });
      flushEvents();

      const call = (apiService.post as jest.Mock).mock.calls[0];
      const event = call[1].events[0];
      expect(event.properties.query).toBe('Tokyo');
      expect(event.properties.platform).toBeDefined();
    });
  });

  // ── flush ──

  describe('flush', () => {
    it('should batch and send events to backend', () => {
      trackEvent('login');
      trackEvent('trip_viewed');

      flushEvents();

      expect(apiService.post).toHaveBeenCalledTimes(1);
      const events = (apiService.post as jest.Mock).mock.calls[0][1].events;
      expect(events).toHaveLength(2);
      expect(events[0].name).toBe('login');
      expect(events[1].name).toBe('trip_viewed');
    });

    it('should not send when queue is empty', () => {
      flushEvents();

      expect(apiService.post).not.toHaveBeenCalled();
    });

    it('should clear queue after flush', () => {
      trackEvent('login');
      flushEvents();
      flushEvents(); // Second flush should be empty

      expect(apiService.post).toHaveBeenCalledTimes(1);
    });

    it('should silently fail on API error', async () => {
      (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('Network'));

      trackEvent('login');

      // Should not throw
      await expect(Promise.resolve(flushEvents())).resolves.not.toThrow();
    });
  });

  // ── multiple events accumulate ──

  describe('event accumulation', () => {
    it('should accumulate multiple events before flush', () => {
      trackEvent('login');
      trackEvent('trip_created');
      trackEvent('search', { query: 'Paris' });

      // No flush yet — events are queued
      expect(apiService.post).not.toHaveBeenCalled();

      // Manual flush sends all
      flushEvents();

      expect(apiService.post).toHaveBeenCalledTimes(1);
      const events = (apiService.post as jest.Mock).mock.calls[0][1].events;
      expect(events).toHaveLength(3);
      expect(events.map((e: any) => e.name)).toEqual(['login', 'trip_created', 'search']);
    });
  });
});
