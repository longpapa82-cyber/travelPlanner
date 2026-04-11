import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthResponse } from '../types';
import { STORAGE_KEYS } from '../constants/config';
import apiService from '../services/api';
import { secureStorage } from '../utils/storage';
import { offlineCache } from '../services/offlineCache';
import { trackEvent, flushEvents } from '../services/eventTracker';
import {
  signInWithGoogle as signInWithGoogleWeb,
  signInWithApple,
  signInWithKakao,
  OAuthResult,
} from '../services/oauth.service';
import { nativeGoogleSignIn } from '../services/googleNativeSignIn';

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
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Session flag helpers — AsyncStorage is more reliable than Keychain for simple flags
  const setSessionFlag = async (loggedIn: boolean) => {
    try {
      if (loggedIn) {
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION_FLAG, 'true');
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_FLAG);
      }
    } catch {
      // Best-effort — non-critical
    }
  };

  const getSessionFlag = async (): Promise<boolean> => {
    try {
      return (await AsyncStorage.getItem(STORAGE_KEYS.SESSION_FLAG)) === 'true';
    } catch {
      return false;
    }
  };

  // Register auth expired callback so 401 responses trigger logout
  useEffect(() => {
    apiService.setOnAuthExpired(() => {
      setUser(null);
      setSessionFlag(false);
    });
  }, []);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // T6: Refresh tokens when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        silentRefresh();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Pick up OAuth bridge tokens left by WebOAuthCallbackHandler.
      // On web, secureStorage uses in-memory Map (cleared on page reload),
      // so OAuth stores tokens in sessionStorage to survive the redirect.
      if (typeof sessionStorage !== 'undefined') {
        const bridgeAccess = sessionStorage.getItem('__oauth_access_token');
        const bridgeRefresh = sessionStorage.getItem('__oauth_refresh_token');
        if (bridgeAccess && bridgeRefresh) {
          sessionStorage.removeItem('__oauth_access_token');
          sessionStorage.removeItem('__oauth_refresh_token');
          await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, bridgeAccess);
          await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, bridgeRefresh);
        }
      }

      const token = await secureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (token) {
        try {
          const profile = await apiService.getProfile();
          setUser(profile);
          setSessionFlag(true);
          registerPushAfterLogin();
          return;
        } catch (profileError: any) {
          // 401 = token expired → fall through to refresh
          // Network error = offline → try cached profile
          if (profileError?.response?.status !== 401) {
            const cached = await offlineCache.get('profile');
            if (cached) {
              setUser(cached as User);
              return;
            }
          }
          // Fall through to refresh attempt
        }
      }

      // Access token missing or expired — try refresh via getProfile().
      // Delegates to the interceptor's 401 auto-refresh, which serializes
      // concurrent refresh attempts through its isRefreshing lock.
      const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (refreshToken) {
        try {
          // getProfile() will trigger the interceptor's auto-refresh on 401,
          // which handles token storage and retry atomically.
          const profile = await apiService.getProfile();
          setUser(profile);
          setSessionFlag(true);
          registerPushAfterLogin();
          return;
        } catch (refreshError: any) {
          const status = refreshError?.response?.status;
          // Only clear tokens on explicit server rejection (401/403)
          // Network errors → keep tokens, user can retry next time
          if (status === 401 || status === 403) {
            await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
            await setSessionFlag(false);
            return;
          }
        }
      }

      // T4+T5: Last resort — if session flag says we were logged in,
      // serve cached profile (keychain may have lost both tokens)
      const wasLoggedIn = await getSessionFlag();
      if (wasLoggedIn) {
        const cached = await offlineCache.get('profile');
        if (cached) {
          setUser(cached as User);
          return;
        }
        // Session flag set but no cache — clear stale flag
        await setSessionFlag(false);
      }
    } catch (error) {
      // Unexpected error in keychain access itself
      console.warn('[AuthContext] checkAuthStatus unexpected error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // T6: Silent refresh on foreground — keeps 15min token fresh.
  // Delegates to getProfile() which triggers the interceptor's auto-refresh
  // if the access token is expired. This avoids a race condition where
  // silentRefresh and the interceptor both consume the one-time-use refresh token.
  const silentRefresh = async () => {
    try {
      const hasRefresh = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!hasRefresh) return;

      // getProfile() will auto-refresh via the 401 interceptor if needed.
      // The interceptor handles token storage and retry atomically.
      const profile = await apiService.getProfile();
      setUser(profile);
    } catch {
      // Silent fail — don't disrupt the user on foreground
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
      await setSessionFlag(true);
      trackEvent('login', { method: 'email' });
      registerPushAfterLogin();

      // Fetch full profile to populate aiTripsUsedThisMonth, subscriptionTier, etc.
      try {
        const profile = await apiService.getProfile();
        if (profile) setUser(profile);
      } catch {
        // Best-effort — profile will be fetched on next app focus
      }
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
      await setSessionFlag(true);
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
      await setSessionFlag(true);
      trackEvent('register', { method: 'email' });
      registerPushAfterLogin();
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
    await setSessionFlag(true);
    registerPushAfterLogin();
  };

  const loginWithGoogle = async () => {
    // Native mobile: use Google Sign-In SDK (no browser)
    if (Platform.OS !== 'web') {
      try {
        const idToken = await nativeGoogleSignIn();
        if (!idToken) throw new Error('Google Sign-In cancelled');

        const authResponse: AuthResponse = await apiService.exchangeGoogleIdToken(idToken);
        await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.accessToken);
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);
        setUser(authResponse.user);
        await setSessionFlag(true);
        registerPushAfterLogin();
        trackEvent('login', { method: 'google_native' });
        return;
      } catch (error) {
        throw error;
      }
    }
    // Web: use OAuth redirect flow
    try {
      const result = await signInWithGoogleWeb();
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

      // Sign out from Google (so next login shows account picker)
      try {
        const { nativeGoogleSignOut } = require('../services/googleNativeSignIn');
        await nativeGoogleSignOut();
      } catch {
        // Silent — Google sign-out is best-effort
      }

      // Clear tokens and cached data
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await setSessionFlag(false);
      await offlineCache.clearAll();

      setUser(null);
    } catch (error) {
      // Silent fail - force clear user state regardless
      await setSessionFlag(false);
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
