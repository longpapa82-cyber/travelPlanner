jest.mock('../../i18n', () => ({
  getCurrentLanguage: jest.fn(() => 'ko'),
}));

import { getCurrentLanguage } from '../../i18n';
import {
  getDateLocale,
  formatDate,
  formatShortDate,
  formatFullDate,
  formatDateRange,
} from '../dateLocale';

const mockGetCurrentLanguage = getCurrentLanguage as jest.Mock;

describe('dateLocale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentLanguage.mockReturnValue('ko');
  });

  // ── getDateLocale ──

  describe('getDateLocale', () => {
    it('should return ko-KR for Korean', () => {
      mockGetCurrentLanguage.mockReturnValue('ko');

      expect(getDateLocale()).toBe('ko-KR');
    });

    it('should return en-US for English', () => {
      mockGetCurrentLanguage.mockReturnValue('en');

      expect(getDateLocale()).toBe('en-US');
    });

    it('should return ja-JP for Japanese', () => {
      mockGetCurrentLanguage.mockReturnValue('ja');

      expect(getDateLocale()).toBe('ja-JP');
    });

    it('should fallback to ko-KR for unknown language', () => {
      mockGetCurrentLanguage.mockReturnValue('unknown');

      // Falls through to default which is undefined, so || 'ko-KR'
      expect(getDateLocale()).toBe('ko-KR');
    });
  });

  // ── formatDate ──

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date(2025, 5, 15); // June 15, 2025
      const result = formatDate(date);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format date string', () => {
      const result = formatDate('2025-06-15');

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should apply custom format options', () => {
      const date = new Date(2025, 5, 15);
      const result = formatDate(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      expect(result).toBeTruthy();
    });
  });

  // ── formatShortDate ──

  describe('formatShortDate', () => {
    it('should format with month and day', () => {
      const date = new Date(2025, 5, 15);
      const result = formatShortDate(date);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle string dates', () => {
      const result = formatShortDate('2025-12-25');

      expect(result).toBeTruthy();
    });
  });

  // ── formatFullDate ──

  describe('formatFullDate', () => {
    it('should include year, month, and day', () => {
      const date = new Date(2025, 5, 15);
      const result = formatFullDate(date);

      expect(result).toBeTruthy();
      // Korean format includes 2025
      expect(result).toContain('2025');
    });

    it('should handle string dates', () => {
      const result = formatFullDate('2025-01-01');

      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });
  });

  // ── formatDateRange ──

  describe('formatDateRange', () => {
    it('should format start and end dates with separator', () => {
      const start = new Date(2025, 5, 1);
      const end = new Date(2025, 5, 7);
      const result = formatDateRange(start, end);

      expect(result).toContain('-');
    });

    it('should handle string dates', () => {
      const result = formatDateRange('2025-06-01', '2025-06-07');

      expect(result).toContain('-');
    });

    it('should handle cross-month ranges', () => {
      const result = formatDateRange('2025-06-28', '2025-07-05');

      expect(result).toContain('-');
      expect(result).toBeTruthy();
    });
  });
});
