import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, TwoFactorRequiredError } from '../AuthContext';
import apiService from '../../services/api';
import { secureStorage } from '../../utils/storage';
import { offlineCache } from '../../services/offlineCache';
import { trackEvent, flushEvents } from '../../services/eventTracker';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithKakao,
} from '../../services/oauth.service';
import { nativeGoogleSignIn } from '../../services/googleNativeSignIn';

// ── Mocks ──

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
    verifyTwoFactor: jest.fn(),
    exchangeOAuthCode: jest.fn(),
    exchangeGoogleIdToken: jest.fn(),
    removePushToken: jest.fn(),
    setOnAuthExpired: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../../utils/storage', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../../services/offlineCache', () => ({
  offlineCache: {
    clearAll: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../services/eventTracker', () => ({
  trackEvent: jest.fn(),
  flushEvents: jest.fn(),
}));

jest.mock('../../services/oauth.service', () => ({
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithKakao: jest.fn(),
}));

jest.mock('../../services/googleNativeSignIn', () => ({
  nativeGoogleSignIn: jest.fn(),
}));

// ── Helpers ──

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'email' as const,
  isEmailVerified: true,
  isTwoFactorEnabled: false,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const mockAuthResponse = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
  user: mockUser,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no stored token
    (secureStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  // ── TwoFactorRequiredError ──

  describe('TwoFactorRequiredError', () => {
    it('should store tempToken and have correct name', () => {
      const err = new TwoFactorRequiredError('temp-123');
      expect(err.tempToken).toBe('temp-123');
      expect(err.name).toBe('TwoFactorRequiredError');
      expect(err.message).toBe('Two-factor authentication required');
    });
  });

  // ── Initial State ──

  describe('initial state', () => {
    it('should start with null user and loading true', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should restore session from stored token', async () => {
      (secureStorage.getItem as jest.Mock).mockResolvedValue('stored-token');
      (apiService.getProfile as jest.Mock).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle auth check failure gracefully', async () => {
      (secureStorage.getItem as jest.Mock).mockResolvedValue('expired-token');
      (apiService.getProfile as jest.Mock).mockRejectedValue(new Error('401'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should register onAuthExpired callback', () => {
      renderHook(() => useAuth(), { wrapper });
      expect(apiService.setOnAuthExpired).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── Email Login ──

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      (apiService.login as jest.Mock).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(apiService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(secureStorage.setItem).toHaveBeenCalledWith(
        '@travelplanner:auth_token',
        'access-token-123',
      );
      expect(secureStorage.setItem).toHaveBeenCalledWith(
        '@travelplanner:refresh_token',
        'refresh-token-456',
      );
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(trackEvent).toHaveBeenCalledWith('login', { method: 'email' });
    });

    it('should throw TwoFactorRequiredError when 2FA is needed', async () => {
      (apiService.login as jest.Mock).mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp-2fa-token',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'password123');
        }),
      ).rejects.toThrow(TwoFactorRequiredError);

      expect(result.current.user).toBeNull();
    });

    it('should re-throw other login errors', async () => {
      (apiService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong');
        }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  // ── 2FA Login Completion ──

  describe('completeTwoFactorLogin', () => {
    it('should complete 2FA login and store tokens', async () => {
      (apiService.verifyTwoFactor as jest.Mock).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.completeTwoFactorLogin('temp-token', '123456');
      });

      expect(apiService.verifyTwoFactor).toHaveBeenCalledWith('temp-token', '123456');
      expect(secureStorage.setItem).toHaveBeenCalledWith(
        '@travelplanner:auth_token',
        'access-token-123',
      );
      expect(result.current.user).toEqual(mockUser);
      expect(trackEvent).toHaveBeenCalledWith('login', { method: '2fa' });
    });

    it('should throw on invalid 2FA code', async () => {
      (apiService.verifyTwoFactor as jest.Mock).mockRejectedValue(new Error('Invalid code'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.completeTwoFactorLogin('temp-token', '000000');
        }),
      ).rejects.toThrow('Invalid code');
    });
  });

  // ── Registration ──

  describe('register', () => {
    it('should register and store tokens', async () => {
      (apiService.register as jest.Mock).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.register('new@example.com', 'pass123', 'New User');
      });

      expect(apiService.register).toHaveBeenCalledWith(
        'new@example.com',
        'pass123',
        'New User',
      );
      expect(result.current.user).toEqual(mockUser);
      expect(trackEvent).toHaveBeenCalledWith('register', { method: 'email' });
    });
  });

  // ── OAuth Logins ──

  describe('OAuth logins', () => {
    const oauthResult = { code: 'oauth-code-abc' };

    beforeEach(() => {
      (apiService.exchangeOAuthCode as jest.Mock).mockResolvedValue(mockAuthResponse);
    });

    it('should login with Google', async () => {
      // On non-web platforms, loginWithGoogle uses nativeGoogleSignIn + exchangeGoogleIdToken
      (nativeGoogleSignIn as jest.Mock).mockResolvedValue('mock-id-token');
      (apiService.exchangeGoogleIdToken as jest.Mock).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.loginWithGoogle();
      });

      expect(nativeGoogleSignIn).toHaveBeenCalled();
      expect(apiService.exchangeGoogleIdToken).toHaveBeenCalledWith('mock-id-token');
      expect(result.current.user).toEqual(mockUser);
      expect(trackEvent).toHaveBeenCalledWith('login', { method: 'google_native' });
    });

    it('should login with Apple', async () => {
      (signInWithApple as jest.Mock).mockResolvedValue(oauthResult);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.loginWithApple();
      });

      expect(signInWithApple).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('login', { method: 'apple' });
    });

    it('should login with Kakao', async () => {
      (signInWithKakao as jest.Mock).mockResolvedValue(oauthResult);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.loginWithKakao();
      });

      expect(signInWithKakao).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('login', { method: 'kakao' });
    });

    it('should throw when Google native returns null (cancelled)', async () => {
      // On non-web platforms, nativeGoogleSignIn returning null means user cancelled
      (nativeGoogleSignIn as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.loginWithGoogle();
        }),
      ).rejects.toThrow('GOOGLE_SIGNIN_CANCELLED');
    });
  });

  // ── Logout ──

  describe('logout', () => {
    it('should clear tokens, cache, and user state', async () => {
      // Start with a logged-in user
      (apiService.login as jest.Mock).mockResolvedValue(mockAuthResponse);
      (apiService.removePushToken as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).not.toBeNull();

      await act(async () => {
        await result.current.logout();
      });

      expect(trackEvent).toHaveBeenCalledWith('logout');
      expect(flushEvents).toHaveBeenCalled();
      expect(apiService.removePushToken).toHaveBeenCalled();
      expect(secureStorage.removeItem).toHaveBeenCalledWith('@travelplanner:auth_token');
      expect(secureStorage.removeItem).toHaveBeenCalledWith('@travelplanner:refresh_token');
      expect(offlineCache.clearAll).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should still clear user even if push token removal fails', async () => {
      (apiService.login as jest.Mock).mockResolvedValue(mockAuthResponse);
      (apiService.removePushToken as jest.Mock).mockRejectedValue(new Error('Network'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
    });
  });

  // ── Refresh User ──

  describe('refreshUser', () => {
    it('should update user from API', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      (apiService.getProfile as jest.Mock).mockResolvedValue(updatedUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(updatedUser);
    });

    it('should silently fail on refresh error', async () => {
      (apiService.getProfile as jest.Mock).mockRejectedValue(new Error('Network'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw
      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toBeNull();
    });
  });

  // ── useAuth outside provider ──

  describe('useAuth outside provider', () => {
    it('should throw when used outside AuthProvider', () => {
      // Suppress console.error for expected error
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within AuthProvider');

      spy.mockRestore();
    });
  });
});
