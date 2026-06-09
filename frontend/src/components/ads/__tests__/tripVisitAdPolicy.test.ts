import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldShowAdOnVisit,
  registerTripVisit,
  getTripVisitSnapshot,
} from '../tripVisitAdPolicy';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

describe('tripVisitAdPolicy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
  });

  describe('shouldShowAdOnVisit', () => {
    it('skips the first visit so content lands before any ad', () => {
      expect(shouldShowAdOnVisit(1)).toBe(false);
    });

    it('shows on every 2nd visit (N=2 boundary)', () => {
      expect(shouldShowAdOnVisit(2)).toBe(true);
      expect(shouldShowAdOnVisit(4)).toBe(true);
      expect(shouldShowAdOnVisit(6)).toBe(true);
      expect(shouldShowAdOnVisit(8)).toBe(true);
    });

    it('does not show on odd (non-boundary) visits past the free visit', () => {
      expect(shouldShowAdOnVisit(3)).toBe(false);
      expect(shouldShowAdOnVisit(5)).toBe(false);
      expect(shouldShowAdOnVisit(7)).toBe(false);
    });
  });

  describe('registerTripVisit', () => {
    it('increments a missing counter to 1 and reports no ad', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await registerTripVisit();

      expect(result.visitCount).toBe(1);
      expect(result.shouldShowAd).toBe(false);
      expect(mockSetItem).toHaveBeenCalledWith('@trip_detail_visit_count', '1');
    });

    it('increments an existing counter and flags an ad on an even (Nth) visit', async () => {
      mockGetItem.mockResolvedValue('1');

      const result = await registerTripVisit();

      expect(result.visitCount).toBe(2);
      expect(result.shouldShowAd).toBe(true);
      expect(mockSetItem).toHaveBeenCalledWith('@trip_detail_visit_count', '2');
    });

    it('treats a corrupt stored value as 0', async () => {
      mockGetItem.mockResolvedValue('not-a-number');

      const result = await registerTripVisit();

      expect(result.visitCount).toBe(1);
    });

    it('still increments in-flow when persistence fails (best-effort)', async () => {
      mockGetItem.mockResolvedValue('5');
      mockSetItem.mockRejectedValue(new Error('disk full'));

      const result = await registerTripVisit();

      expect(result.visitCount).toBe(6);
      expect(result.shouldShowAd).toBe(true); // 6 is an Nth boundary
    });
  });

  describe('getTripVisitSnapshot', () => {
    it('reads the count without incrementing', async () => {
      mockGetItem.mockResolvedValue('7');

      const snap = await getTripVisitSnapshot();

      expect(snap.visitCount).toBe(7);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('returns 0 on read error', async () => {
      mockGetItem.mockRejectedValue(new Error('read fail'));

      const snap = await getTripVisitSnapshot();

      expect(snap.visitCount).toBe(0);
    });
  });
});
