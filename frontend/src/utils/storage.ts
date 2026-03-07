import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const isWeb = Platform.OS === 'web';

// In-memory store for access token on web (XSS protection — short-lived, 15m)
const memoryStore = new Map<string, string>();

// Access token: memory-only (XSS protection, 15m expiry means low risk on page reload)
// Refresh token: localStorage (survives tab close + reload; one-time-use mitigates XSS theft)
// This hybrid approach balances XSS protection with session continuity on web.
const MEMORY_ONLY_KEYS = ['@travelplanner:auth_token'];
const LOCAL_STORAGE_KEYS = ['@travelplanner:refresh_token'];

// Native: Keychain retry with exponential backoff (react-native-keychain #594)
const KEYCHAIN_MAX_RETRIES = 5;
const KEYCHAIN_BASE_DELAY_MS = 200;

// Keys to backup in AsyncStorage on native as fallback for Keychain failures.
// Refresh token is one-time-use so exposure risk is minimal.
// AsyncStorage is in app-private SQLite on Android (requires root to access).
const ASYNC_STORAGE_BACKUP_PREFIX = '@travelplanner:backup:';
const BACKUP_KEYS = [
  '@travelplanner:auth_token',
  '@travelplanner:refresh_token',
];

// Native in-memory cache — avoids slow Keychain reads on every API request.
// Populated on setItem, checked first on getItem. Cleared on removeItem/clear.
const nativeMemoryCache = new Map<string, string>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (MEMORY_ONLY_KEYS.includes(key)) {
        memoryStore.set(key, value);
      } else if (LOCAL_STORAGE_KEYS.includes(key)) {
        memoryStore.set(key, value); // Also keep in memory for fast access
        try { localStorage.setItem(key, value); } catch { /* private browsing */ }
      } else {
        localStorage.setItem(key, value);
      }
    } else {
      nativeMemoryCache.set(key, value);
      await Keychain.setGenericPassword(key, value, { service: key });
      // Backup critical tokens to AsyncStorage as Keychain fallback
      if (BACKUP_KEYS.includes(key)) {
        try {
          await AsyncStorage.setItem(ASYNC_STORAGE_BACKUP_PREFIX + key, value);
        } catch { /* best-effort backup */ }
      }
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      if (MEMORY_ONLY_KEYS.includes(key)) {
        return memoryStore.get(key) ?? null;
      }
      if (LOCAL_STORAGE_KEYS.includes(key)) {
        // Try memory first (fastest), fall back to localStorage (survives tab close)
        const fromMemory = memoryStore.get(key);
        if (fromMemory) return fromMemory;
        try {
          const fromStorage = localStorage.getItem(key);
          if (fromStorage) {
            // Restore to memory for fast subsequent access
            memoryStore.set(key, fromStorage);
          }
          return fromStorage;
        } catch {
          return null;
        }
      }
      return localStorage.getItem(key);
    } else {
      // 1. In-memory cache — instant (populated by setItem during this session)
      const cached = nativeMemoryCache.get(key);
      if (cached) return cached;

      // 2. AsyncStorage backup — fast (~5ms), survives cold start
      if (BACKUP_KEYS.includes(key)) {
        try {
          const backup = await AsyncStorage.getItem(ASYNC_STORAGE_BACKUP_PREFIX + key);
          if (backup) {
            nativeMemoryCache.set(key, backup);
            return backup;
          }
        } catch { /* backup read failed */ }
      }

      // 3. Keychain with exponential backoff — last resort
      // react-native-keychain can return false spuriously on Android cold start (#594)
      // Delays: 200, 400, 800, 1600ms = ~3s total before giving up
      for (let attempt = 1; attempt <= KEYCHAIN_MAX_RETRIES; attempt++) {
        try {
          const credentials = await Keychain.getGenericPassword({ service: key });
          if (credentials) {
            nativeMemoryCache.set(key, credentials.password);
            return credentials.password;
          }
          // credentials === false — may be a spurious miss on Android
          if (attempt < KEYCHAIN_MAX_RETRIES) {
            await delay(KEYCHAIN_BASE_DELAY_MS * Math.pow(2, attempt - 1));
          }
        } catch (error) {
          console.warn(`[SecureStorage] getItem("${key}") attempt ${attempt} failed:`, error);
          if (attempt < KEYCHAIN_MAX_RETRIES) {
            await delay(KEYCHAIN_BASE_DELAY_MS * Math.pow(2, attempt - 1));
          }
        }
      }
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      if (MEMORY_ONLY_KEYS.includes(key)) {
        memoryStore.delete(key);
      } else if (LOCAL_STORAGE_KEYS.includes(key)) {
        memoryStore.delete(key);
        try { localStorage.removeItem(key); } catch { /* private browsing */ }
      } else {
        localStorage.removeItem(key);
      }
    } else {
      nativeMemoryCache.delete(key);
      try {
        await Keychain.resetGenericPassword({ service: key });
      } catch (error) {
        // Silent fail — best-effort removal
      }
      // Also clear AsyncStorage backup
      if (BACKUP_KEYS.includes(key)) {
        try {
          await AsyncStorage.removeItem(ASYNC_STORAGE_BACKUP_PREFIX + key);
        } catch { /* best-effort */ }
      }
    }
  },

  async clear(): Promise<void> {
    if (isWeb) {
      memoryStore.clear();
      try {
        // Clear localStorage tokens
        LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch { /* private browsing */ }
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('@travelplanner:')) {
          localStorage.removeItem(key);
        }
      });
    } else {
      nativeMemoryCache.clear();
      try {
        await Keychain.resetGenericPassword({ service: '@travelplanner:auth_token' });
        await Keychain.resetGenericPassword({ service: '@travelplanner:refresh_token' });
      } catch (error) {
        // Silent fail — best-effort clear
      }
      // Clear AsyncStorage backups
      try {
        await Promise.all(
          BACKUP_KEYS.map((key) => AsyncStorage.removeItem(ASYNC_STORAGE_BACKUP_PREFIX + key)),
        );
      } catch { /* best-effort */ }
    }
  },

  /** Verify a value was actually persisted to keychain */
  async verifyItem(key: string, expected: string): Promise<boolean> {
    if (isWeb) return true;
    try {
      const credentials = await Keychain.getGenericPassword({ service: key });
      return credentials ? credentials.password === expected : false;
    } catch {
      return false;
    }
  },
};
