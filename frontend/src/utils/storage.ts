import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const isWeb = Platform.OS === 'web';

// In-memory store for sensitive tokens on web (XSS protection)
const memoryStore = new Map<string, string>();

// Keys stored only in memory on web — never written to localStorage (XSS protection)
const MEMORY_ONLY_KEYS = ['@travelplanner:auth_token', '@travelplanner:refresh_token'];

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
