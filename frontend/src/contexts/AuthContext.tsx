import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import { STORAGE_KEYS } from '../constants/config';
import apiService from '../services/api';
import { secureStorage } from '../utils/storage';
import { offlineCache } from '../services/offlineCache';
import { trackEvent, flushEvents } from '../services/eventTracker';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithKakao,
  OAuthResult,
} from '../services/oauth.service';

export class TwoFactorRequiredError extends Error {
  tempToken: string;
  constructor(tempToken: string) {
    super('Two-factor authentication required');
    this.name = 'TwoFactorRequiredError';
    this.tempToken = tempToken;
  }
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeTwoFactorLogin: (tempToken: string, code: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithKakao: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  registerPushAfterLogin: () => void;
}

// Push token registration callback — set by NotificationContext bridge
let pushRegistrationCallback: (() => void) | null = null;
export const setPushRegistrationCallback = (cb: (() => void) | null) => {
  pushRegistrationCallback = cb;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Register auth expired callback so 401 responses trigger logout
  useEffect(() => {
    apiService.setOnAuthExpired(() => {
      setUser(null);
    });
  }, []);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (token) {
        const profile = await apiService.getProfile();
        setUser(profile);
        registerPushAfterLogin();
      } else {
        // Access token lost (web page refresh) — try silent refresh
        const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (refreshToken) {
          const response = await apiService.refreshToken(refreshToken);
          await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
          await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
          const profile = await apiService.getProfile();
          setUser(profile);
          registerPushAfterLogin();
        }
      }
    } catch (error) {
      // Auth failed — clear stale tokens and show login screen
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } finally {
      setIsLoading(false);
    }
  };

  const registerPushAfterLogin = () => {
    pushRegistrationCallback?.();
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);

      // Check if 2FA is required
      if ('requiresTwoFactor' in response && response.requiresTwoFactor) {
        throw new TwoFactorRequiredError(response.tempToken);
      }

      const authResponse = response as AuthResponse;

      // Store tokens
      await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.accessToken);
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);

      setUser(authResponse.user);
      trackEvent('login', { method: 'email' });
      registerPushAfterLogin();
    } catch (error) {
      if (error instanceof TwoFactorRequiredError) throw error;
      throw error;
    }
  };

  const completeTwoFactorLogin = async (tempToken: string, code: string) => {
    try {
      const response: AuthResponse = await apiService.verifyTwoFactor(tempToken, code);

      // Store tokens
      await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);

      setUser(response.user);
      trackEvent('login', { method: '2fa' });
      registerPushAfterLogin();
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const response: AuthResponse = await apiService.register(email, password, name);

      // Store tokens
      await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);

      setUser(response.user);
      trackEvent('register', { method: 'email' });
    } catch (error) {
      throw error;
    }
  };

  const handleOAuthResult = async (result: OAuthResult | null) => {
    if (!result) {
      throw new Error('OAuth authentication failed');
    }

    // Exchange the one-time code for JWT tokens via secure API call
    const authResponse: AuthResponse = await apiService.exchangeOAuthCode(result.code);

    // Store tokens
    await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.accessToken);
    await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);

    setUser(authResponse.user);
    registerPushAfterLogin();
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithGoogle();
      await handleOAuthResult(result);
      trackEvent('login', { method: 'google' });
    } catch (error) {
      throw error;
    }
  };

  const loginWithApple = async () => {
    try {
      const result = await signInWithApple();
      await handleOAuthResult(result);
      trackEvent('login', { method: 'apple' });
    } catch (error) {
      throw error;
    }
  };

  const loginWithKakao = async () => {
    try {
      const result = await signInWithKakao();
      await handleOAuthResult(result);
      trackEvent('login', { method: 'kakao' });
    } catch (error) {
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const profile = await apiService.getProfile();
      setUser(profile);
    } catch (error) {
      // Silent fail - UI remains with stale data
    }
  };

  const logout = async () => {
    try {
      // Track logout and flush pending events before clearing auth
      trackEvent('logout');
      flushEvents();

      // Invalidate refresh token on server + remove push token (best-effort)
      const storedRefresh = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      await Promise.allSettled([
        storedRefresh ? apiService.logout(storedRefresh) : Promise.resolve(),
        apiService.removePushToken(),
      ]);

      // Clear tokens and cached data
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await offlineCache.clearAll();

      setUser(null);
    } catch (error) {
      // Silent fail - force clear user state regardless
      setUser(null);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    completeTwoFactorLogin,
    register,
    loginWithGoogle,
    loginWithApple,
    loginWithKakao,
    logout,
    refreshUser,
    registerPushAfterLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
