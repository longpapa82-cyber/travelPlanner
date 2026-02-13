import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@travelplanner:cache:';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
      return;
    }
    return AsyncStorage.removeItem(key);
  },
  async getAllKeys(): Promise<readonly string[]> {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return Object.keys(window.localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    }
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((k) => k.startsWith(CACHE_PREFIX));
  },
};

export const offlineCache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await storage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        await storage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      await storage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    } catch {
      // Storage full or error - silently fail
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await storage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch {
      // ignore
    }
  },

  async clearExpired(): Promise<void> {
    try {
      const keys = await storage.getAllKeys();
      for (const key of keys) {
        const raw = await storage.getItem(key);
        if (raw) {
          const entry: CacheEntry<unknown> = JSON.parse(raw);
          if (Date.now() - entry.timestamp > CACHE_TTL) {
            await storage.removeItem(key);
          }
        }
      }
    } catch {
      // ignore
    }
  },

  async clearAll(): Promise<void> {
    try {
      const keys = await storage.getAllKeys();
      for (const key of keys) {
        await storage.removeItem(key);
      }
    } catch {
      // ignore
    }
  },
};
