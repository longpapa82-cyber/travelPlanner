import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

/**
 * Cross-platform secure storage utility
 * - Web: Uses localStorage
 * - Native: Uses react-native-keychain
 */

const isWeb = Platform.OS === 'web';

export const secureStorage = {
  /**
   * Store a value securely
   */
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      // Web: Use localStorage
      localStorage.setItem(key, value);
    } else {
      // Native: Use Keychain
      await Keychain.setGenericPassword(key, value, {
        service: key,
      });
    }
  },

  /**
   * Retrieve a stored value
   */
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      // Web: Use localStorage
      return localStorage.getItem(key);
    } else {
      // Native: Use Keychain
      try {
        const credentials = await Keychain.getGenericPassword({
          service: key,
        });
        return credentials ? credentials.password : null;
      } catch (error) {
        console.error(`Error getting item ${key}:`, error);
        return null;
      }
    }
  },

  /**
   * Remove a stored value
   */
  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      // Web: Use localStorage
      localStorage.removeItem(key);
    } else {
      // Native: Use Keychain
      try {
        await Keychain.resetGenericPassword({
          service: key,
        });
      } catch (error) {
        console.error(`Error removing item ${key}:`, error);
      }
    }
  },

  /**
   * Clear all stored values
   */
  async clear(): Promise<void> {
    if (isWeb) {
      // Web: Clear all items with our prefix
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('auth_') || key.startsWith('refresh_')) {
          localStorage.removeItem(key);
        }
      });
    } else {
      // Native: Reset all keychains we use
      try {
        await Keychain.resetGenericPassword({ service: 'auth_token' });
        await Keychain.resetGenericPassword({ service: 'refresh_token' });
      } catch (error) {
        console.error('Error clearing storage:', error);
      }
    }
  },
};
