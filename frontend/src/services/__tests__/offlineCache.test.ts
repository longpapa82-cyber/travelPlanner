import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineCache } from '../offlineCache';

const CACHE_PREFIX = '@travelplanner:cache:';

describe('offlineCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── get ──

  describe('get', () => {
    it('should return cached data when valid', async () => {
      const entry = { data: { name: 'Tokyo' }, timestamp: 1700000000000 - 1000 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entry));

      const result = await offlineCache.get('trip:1');

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`${CACHE_PREFIX}trip:1`);
      expect(result).toEqual({ name: 'Tokyo' });
    });

    it('should return null when cache is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await offlineCache.get('missing');
      expect(result).toBeNull();
    });

    it('should return null and remove expired entries', async () => {
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const entry = { data: 'old', timestamp: 1700000000000 - SEVEN_DAYS - 1 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(entry));

      const result = await offlineCache.get('expired');

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}expired`);
    });

    it('should return null on parse error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json{{{');

      const result = await offlineCache.get('broken');
      expect(result).toBeNull();
    });

    it('should return null on storage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await offlineCache.get('error');
      expect(result).toBeNull();
    });
  });

  // ── set ──

  describe('set', () => {
    it('should store data with timestamp', async () => {
      await offlineCache.set('trip:1', { destination: 'Paris' });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `${CACHE_PREFIX}trip:1`,
        JSON.stringify({ data: { destination: 'Paris' }, timestamp: 1700000000000 }),
      );
    });

    it('should silently fail on storage error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Full'));

      // Should not throw
      await expect(offlineCache.set('key', 'value')).resolves.toBeUndefined();
    });
  });

  // ── remove ──

  describe('remove', () => {
    it('should remove specific cache entry', async () => {
      await offlineCache.remove('trip:1');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}trip:1`);
    });

    it('should silently fail on error', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Fail'));

      await expect(offlineCache.remove('key')).resolves.toBeUndefined();
    });
  });

  // ── clearExpired ──

  describe('clearExpired', () => {
    it('should remove only expired entries', async () => {
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const validEntry = { data: 'fresh', timestamp: 1700000000000 - 1000 };
      const expiredEntry = { data: 'old', timestamp: 1700000000000 - SEVEN_DAYS - 1 };

      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        `${CACHE_PREFIX}valid`,
        `${CACHE_PREFIX}expired`,
      ]);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(validEntry))
        .mockResolvedValueOnce(JSON.stringify(expiredEntry));

      await offlineCache.clearExpired();

      // Only expired entry should be removed
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}expired`);
    });

    it('should handle empty storage', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);

      await expect(offlineCache.clearExpired()).resolves.toBeUndefined();
    });
  });

  // ── clearAll ──

  describe('clearAll', () => {
    it('should remove all cache entries', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        `${CACHE_PREFIX}a`,
        `${CACHE_PREFIX}b`,
        `${CACHE_PREFIX}c`,
      ]);
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await offlineCache.clearAll();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}a`);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}b`);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${CACHE_PREFIX}c`);
    });

    it('should handle storage error', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValue(new Error('Fail'));

      await expect(offlineCache.clearAll()).resolves.toBeUndefined();
    });
  });
});
