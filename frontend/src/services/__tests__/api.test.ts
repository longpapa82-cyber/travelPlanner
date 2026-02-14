// Mock dependencies before requiring api module
jest.mock('../../utils/storage', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../offlineCache', () => ({
  offlineCache: {
    get: jest.fn(),
    set: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../i18n', () => ({
  getCurrentLanguage: jest.fn(() => 'ko'),
}));

import apiService from '../api';

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── constructor ──

  describe('initialization', () => {
    it('should create an axios instance', () => {
      expect(apiService.getInstance()).toBeDefined();
      expect(apiService.getInstance().defaults.baseURL).toBeDefined();
      expect(apiService.getInstance().defaults.timeout).toBe(30000);
    });

    it('should have Content-Type header set', () => {
      expect(apiService.getInstance().defaults.headers['Content-Type']).toBe(
        'application/json',
      );
    });
  });

  // ── HTTP methods ──

  describe('HTTP methods', () => {
    it('should expose get method', () => {
      expect(typeof apiService.get).toBe('function');
    });

    it('should expose post method', () => {
      expect(typeof apiService.post).toBe('function');
    });
  });

  // ── Auth methods ──

  describe('auth methods', () => {
    it.each([
      'login',
      'register',
      'verifyEmail',
      'forgotPassword',
      'resetPassword',
      'exchangeOAuthCode',
      'refreshToken',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── 2FA methods ──

  describe('2FA methods', () => {
    it.each([
      'setupTwoFactor',
      'enableTwoFactor',
      'disableTwoFactor',
      'verifyTwoFactor',
      'regenerateBackupCodes',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── Trip methods ──

  describe('trip methods', () => {
    it.each([
      'createTrip',
      'getTrips',
      'getTripById',
      'updateTrip',
      'deleteTrip',
      'duplicateTrip',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });

    it('should return correct iCal URL', () => {
      const url = apiService.getExportIcalUrl('trip-123');
      expect(url).toContain('/trips/trip-123/export/ical');
    });
  });

  // ── Activity methods ──

  describe('activity methods', () => {
    it.each([
      'addActivity',
      'updateActivity',
      'deleteActivity',
      'reorderActivities',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── Share methods ──

  describe('share methods', () => {
    it.each([
      'generateShareLink',
      'getSharedTrip',
      'disableSharing',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── Notification methods ──

  describe('notification methods', () => {
    it.each([
      'getNotifications',
      'getUnreadNotificationCount',
      'markNotificationRead',
      'markAllNotificationsRead',
      'deleteNotification',
      'deleteAllNotifications',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── Analytics methods ──

  describe('analytics methods', () => {
    it.each([
      'trackAffiliateClick',
      'getMyAffiliateClicks',
      'getUserStats',
      'getAffiliateSummary',
      'getAffiliateProviderStats',
      'getAffiliateDailyStats',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── User methods ──

  describe('user methods', () => {
    it.each([
      'getProfile',
      'updateProfile',
      'changePassword',
      'deleteAccount',
      'uploadPhoto',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── Collaboration methods ──

  describe('collaboration methods', () => {
    it.each([
      'getCollaborators',
      'addCollaborator',
      'updateCollaboratorRole',
      'removeCollaborator',
    ])('should have %s method', (method) => {
      expect(typeof (apiService as any)[method]).toBe('function');
    });
  });

  // ── Auth expired callback ──

  describe('setOnAuthExpired', () => {
    it('should accept a callback', () => {
      const cb = jest.fn();
      expect(() => apiService.setOnAuthExpired(cb)).not.toThrow();
    });
  });
});
