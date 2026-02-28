import * as Keychain from 'react-native-keychain';
import { secureStorage } from '../storage';

// Platform.OS defaults to 'ios' in jest-expo, so secureStorage uses native (Keychain) path

describe('secureStorage (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── setItem ──

  describe('setItem', () => {
    it('should store value using Keychain', async () => {
      await secureStorage.setItem('auth_token', 'jwt-token-123');

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'auth_token',
        'jwt-token-123',
        { service: 'auth_token' },
      );
    });

    it('should use key as service name', async () => {
      await secureStorage.setItem('refresh_token', 'refresh-abc');

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-abc',
        { service: 'refresh_token' },
      );
    });
  });

  // ── getItem ──

  describe('getItem', () => {
    it('should retrieve value from Keychain', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
        username: 'auth_token',
        password: 'jwt-token-123',
      });

      const result = await secureStorage.getItem('auth_token');

      expect(result).toBe('jwt-token-123');
      expect(Keychain.getGenericPassword).toHaveBeenCalledWith({
        service: 'auth_token',
      });
    });

    it('should return null when no credentials stored', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);

      const result = await secureStorage.getItem('missing_key');

      expect(result).toBeNull();
    });

    it('should return null on Keychain error', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockRejectedValue(
        new Error('Keychain locked'),
      );

      const result = await secureStorage.getItem('auth_token');

      expect(result).toBeNull();
    });
  });

  // ── removeItem ──

  describe('removeItem', () => {
    it('should reset Keychain for given service', async () => {
      await secureStorage.removeItem('auth_token');

      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
        service: 'auth_token',
      });
    });

    it('should silently fail on error', async () => {
      (Keychain.resetGenericPassword as jest.Mock).mockRejectedValue(
        new Error('Fail'),
      );

      await expect(secureStorage.removeItem('key')).resolves.toBeUndefined();
    });
  });

  // ── clear ──

  describe('clear', () => {
    it('should call resetGenericPassword for all token services', async () => {
      // Ensure mock resolves (previous test may have set mockRejectedValue)
      (Keychain.resetGenericPassword as jest.Mock).mockResolvedValue(true);

      await secureStorage.clear();

      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
        service: '@travelplanner:auth_token',
      });
      expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
        service: '@travelplanner:refresh_token',
      });
    });

    it('should silently fail on error', async () => {
      (Keychain.resetGenericPassword as jest.Mock).mockRejectedValue(
        new Error('Fail'),
      );

      await expect(secureStorage.clear()).resolves.toBeUndefined();
    });
  });
});
