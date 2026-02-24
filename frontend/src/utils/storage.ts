import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const isWeb = Platform.OS === 'web';

// In-memory store for access token on web (XSS protection — short-lived, 15m)
const memoryStore = new Map<string, string>();

// Access token: memory-only (XSS protection, 15m expiry means low risk on page reload)
// Refresh token: sessionStorage (survives page reload within same tab, cleared on tab close)
// This hybrid approach balances XSS protection with session continuity on web.
const MEMORY_ONLY_KEYS = ['@travelplanner:auth_token'];
const SESSION_STORAGE_KEYS = ['@travelplanner:refresh_token'];

const KEYCHAIN_MAX_RETRIES = 3;
const KEYCHAIN_RETRY_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (MEMORY_ONLY_KEYS.includes(key)) {
        memoryStore.set(key, value);
      } else if (SESSION_STORAGE_KEYS.includes(key)) {
        memoryStore.set(key, value); // Also keep in memory for fast access
        try { sessionStorage.setItem(key, value); } catch { /* private browsing */ }
      } else {
        localStorage.setItem(key, value);
      }
    } else {
      await Keychain.setGenericPassword(key, value, { service: key });
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      if (MEMORY_ONLY_KEYS.includes(key)) {
        return memoryStore.get(key) ?? null;
      }
      if (SESSION_STORAGE_KEYS.includes(key)) {
        // Try memory first (fastest), fall back to sessionStorage (survives reload)
        const fromMemory = memoryStore.get(key);
        if (fromMemory) return fromMemory;
        try {
          const fromSession = sessionStorage.getItem(key);
          if (fromSession) {
            // Restore to memory for fast subsequent access
            memoryStore.set(key, fromSession);
          }
          return fromSession;
        } catch {
          return null;
        }
      }
      return localStorage.getItem(key);
    } else {
      // Retry up to 3 times — react-native-keychain can return false
      // spuriously on Android after app restart (known issue #594)
      for (let attempt = 1; attempt <= KEYCHAIN_MAX_RETRIES; attempt++) {
        try {
          const credentials = await Keychain.getGenericPassword({ service: key });
          if (credentials) return credentials.password;
          // credentials === false — may be a spurious miss on Android
          if (attempt < KEYCHAIN_MAX_RETRIES) {
            await delay(KEYCHAIN_RETRY_DELAY_MS);
          }
        } catch (error) {
          console.warn(`[SecureStorage] getItem("${key}") attempt ${attempt} failed:`, error);
          if (attempt < KEYCHAIN_MAX_RETRIES) {
            await delay(KEYCHAIN_RETRY_DELAY_MS);
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
      } else if (SESSION_STORAGE_KEYS.includes(key)) {
        memoryStore.delete(key);
        try { sessionStorage.removeItem(key); } catch { /* private browsing */ }
      } else {
        localStorage.removeItem(key);
      }
    } else {
      try {
        await Keychain.resetGenericPassword({ service: key });
      } catch (error) {
        // Silent fail — best-effort removal
      }
    }
  },

  async clear(): Promise<void> {
    if (isWeb) {
      memoryStore.clear();
      try {
        // Clear session storage tokens
        SESSION_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
      } catch { /* private browsing */ }
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('@travelplanner:')) {
          localStorage.removeItem(key);
        }
      });
    } else {
      try {
        await Keychain.resetGenericPassword({ service: 'auth_token' });
        await Keychain.resetGenericPassword({ service: 'refresh_token' });
      } catch (error) {
        // Silent fail — best-effort clear
      }
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
