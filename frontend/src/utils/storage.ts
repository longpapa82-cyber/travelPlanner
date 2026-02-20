import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const isWeb = Platform.OS === 'web';

// In-memory store for sensitive tokens on web (XSS protection)
const memoryStore = new Map<string, string>();

// Keys stored only in memory on web — never written to localStorage
const MEMORY_ONLY_KEYS = ['@travelplanner:auth_token'];

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
      try {
        const credentials = await Keychain.getGenericPassword({ service: key });
        return credentials ? credentials.password : null;
      } catch (error) {
        return null;
      }
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
};
