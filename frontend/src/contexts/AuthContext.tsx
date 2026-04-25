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

/**
 * Thrown by AuthContext.register / AuthContext.login when the email is not
 * yet verified. The caller (RegisterScreen / LoginScreen) should navigate
 * to EmailVerificationCodeScreen with the resumeToken, which is only
 * accepted by the send/verify-email-code endpoints via
 * PendingVerificationGuard (V112 Wave 2).
 */
export class EmailNotVerifiedError extends Error {
  resumeToken: string;
  user: {
    id: string;
    email: string | null;
    name: string;
  };
  /*
   * V115 (V114-8, Gate 5 C1 fix): carry the register-path discriminator on
   * the error instance itself. Reading `pendingVerification.action` from
   * state in the catch handler was captured from a stale render closure
   * and always came back as null — the 2-way dialog never fired. Error
   * objects are synchronous values, so threading `action` through here is
   * the only reliable channel.
   */
  action?: 'created' | 'refreshed';
  constructor(
    resumeToken: string,
    user: { id: string; email: string | null; name: string },
    action?: 'created' | 'refreshed',
  ) {
    super('Email verification required');
    this.name = 'EmailNotVerifiedError';
    this.resumeToken = resumeToken;
    this.user = user;
    this.action = action;
  }
}

export interface PendingVerification {
  resumeToken: string;
  user: {
    id: string;
    email: string | null;
    name: string;
  };
  /*
   * V115 (V114-8 fix): discriminator from the backend response.
   *  - 'created'   → brand-new signup; the code screen is the happy path.
   *  - 'refreshed' → the user previously abandoned verification with this
   *                  email. RegisterScreen should offer a 2-way choice
   *                  (continue vs. start over) before handing off.
   * Absent on legacy responses or login-triggered pending states.
   */
  action?: 'created' | 'refreshed';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // V112 Wave 2: set when register/login hits an unverified email. Nulled
  // again after the verification code flow completes (or on logout/cancel).
  pendingVerification: PendingVerification | null;
  clearPendingVerification: () => void;
  // V112 Wave 5: promote the resume-token session to a full session
  // using the tokens returned by POST /auth/verify-email-code.
  completeEmailVerification: (tokens: {
    accessToken: string;
    refreshToken: string;
    user: any;
  }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  completeTwoFactorLogin: (tempToken: string, code: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  // V115 (V114-8): hard-reset register — deletes a stale unverified row
  // and starts a fresh signup with the same email. Only call after user
  // confirmation.
  registerForce: (email: string, password: string, name: string) => Promise<void>;
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
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const clearPendingVerification = () => setPendingVerification(null);

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

  // T6: Refresh tokens when app returns to foreground.
  // V178 (Issue 5): throttle to at most one refresh per 60s. Without this,
  // rapid background↔foreground toggles (e.g. quickly checking the home
  // screen) hammered /api/auth/me, hit ThrottlerException 429, the 401
  // interceptor treated 429 as auth failure, setUser(null) fired, and the
  // RootNavigator Auth/Main toggle remounted the entire stack — wiping
  // navigation history and dropping the user back to the home tab.
  const lastSilentRefreshAt = useRef<number>(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const now = Date.now();
        if (now - lastSilentRefreshAt.current > 60_000) {
          lastSilentRefreshAt.current = now;
          silentRefresh();
        }
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
  //
  // V178 (Issue 5): two safety nets to prevent navigation-history wipeout.
  //   1. setUser(prev) reference stability — if every field on the profile
  //      matches the previous user, keep the existing reference so deps that
  //      key on `user` (PremiumContext, ConsentContext, navigators) do not
  //      cascade-rerun their effects on every foreground.
  //   2. Treat 429 (rate limit on /auth/me itself) as a "skip", not a fatal
  //      auth failure. The previous code's bare catch silently dropped the
  //      error but the api.ts interceptor's 401 path had already fired
  //      onAuthExpired by that point, so setUser(null) propagated.
  const silentRefresh = async () => {
    try {
      const hasRefresh = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!hasRefresh) return;

      const profile = await apiService.getProfile();
      setUser((prev) => {
        if (!prev || prev.id !== profile.id) return profile;
        // Same user — only swap reference when something visible changed.
        const sameTier =
          prev.subscriptionTier === profile.subscriptionTier &&
          prev.subscriptionExpiresAt === profile.subscriptionExpiresAt &&
          prev.aiTripsUsedThisMonth === profile.aiTripsUsedThisMonth &&
          prev.isAdmin === profile.isAdmin &&
          prev.name === profile.name &&
          prev.profileImage === profile.profileImage;
        return sameTier ? prev : profile;
      });
    } catch (err: any) {
      // Status 429 means we hammered /auth/me — not an auth failure. Don't
      // let the bare catch mask the distinction; treat 429 as a no-op so
      // the navigator stack stays mounted.
      const status = err?.response?.status;
      if (status === 429) return;
      // Any other error (network, 500, etc.) — silent fail per existing
      // contract. The 401 interceptor handles token expiry separately.
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
    } catch (error: any) {
      if (error instanceof TwoFactorRequiredError) throw error;

      // V112 Wave 2: unverified-email login returns 401 with a structured
      // body carrying a pending_verification-scoped resumeToken. Promote it
      // to a typed error so the login screen can navigate to verification
      // without having to parse HTTP status codes inline.
      const status = error?.response?.status;
      const body = error?.response?.data;
      if (status === 401 && body?.code === 'EMAIL_NOT_VERIFIED' && body?.resumeToken) {
        setPendingVerification({
          resumeToken: body.resumeToken,
          user: body.user,
        });
        throw new EmailNotVerifiedError(body.resumeToken, body.user);
      }

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

      // Fetch full profile to populate subscription fields
      try {
        const profile = await apiService.getProfile();
        if (profile) setUser(profile);
      } catch {
        // Best-effort — profile will be fetched on next app focus
      }
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      // V112 Wave 2: register no longer returns access/refresh tokens. It
      // returns { user, resumeToken, requiresEmailVerification } — the user
      // has to complete email verification before a full session exists.
      // We surface this as EmailNotVerifiedError so the caller is funneled
      // into the same verification screen as the unverified-login branch.
      const response = await apiService.register(email, password, name);

      trackEvent('register', { method: 'email' });

      if (response?.resumeToken && response?.user) {
        const action = response.action;
        setPendingVerification({
          resumeToken: response.resumeToken,
          user: response.user,
          action,
        });
        // V115 (V114-8, Gate 5 C1 fix): thread `action` through the error
        // so catch handlers read a synchronous value instead of reaching
        // into state that hasn't flushed yet.
        throw new EmailNotVerifiedError(response.resumeToken, response.user, action);
      }

      // Backwards-compat: if an older backend still returns full tokens,
      // keep the legacy path alive so a staged rollout does not brick clients.
      // The legacy payload carries a richer User shape; the getProfile() call
      // below replaces it with the canonical one regardless, so the cast is
      // a controlled narrowing of the transitional state.
      if (response?.accessToken && response?.refreshToken) {
        await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        setUser(response.user as unknown as User);
        await setSessionFlag(true);
        registerPushAfterLogin();
        try {
          const profile = await apiService.getProfile();
          if (profile) setUser(profile);
        } catch {
          // Best-effort — profile will be fetched on next app focus
        }
      }
    } catch (error) {
      throw error;
    }
  };

  /*
   * V115 (V114-8 fix): hard-reset register path.
   *
   * Only call this after the user confirmed "start over" in the RegisterScreen
   * 2-way dialog. Mirrors register() but hits /auth/register-force, which
   * deletes the existing unverified row server-side before re-creating.
   */
  const registerForce = async (email: string, password: string, name: string) => {
    try {
      const response = await apiService.registerForce(email, password, name);
      // Reuse 'register' event with a different method tag — the analytics
      // schema has a fixed event set and a new name would be rejected.
      trackEvent('register', { method: 'email_force' });
      if (response?.resumeToken && response?.user) {
        const action: 'created' | 'refreshed' = response.action ?? 'created';
        setPendingVerification({
          resumeToken: response.resumeToken,
          user: response.user,
          action,
        });
        throw new EmailNotVerifiedError(response.resumeToken, response.user, action);
      }

      // Backwards-compat: if an older backend still returns full tokens,
      // keep the legacy path alive so a staged rollout does not brick clients.
      // The legacy payload carries a richer User shape; the getProfile() call
      // below replaces it with the canonical one regardless, so the cast is
      // a controlled narrowing of the transitional state.
      if (response?.accessToken && response?.refreshToken) {
        await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        setUser(response.user as unknown as User);
        await setSessionFlag(true);
        registerPushAfterLogin();

        // Profile fetch is only safe on the legacy (full-token) path. A
        // resume token is scope-restricted and would 401 against /auth/me.
        try {
          const profile = await apiService.getProfile();
          if (profile) setUser(profile);
        } catch {
          // Best-effort — profile will be fetched on next app focus
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleOAuthResult = async (result: OAuthResult | null) => {
    if (!result) {
      throw new Error('OAUTH_FAILED');
    }

    // Exchange the one-time code for JWT tokens via secure API call
    const authResponse: AuthResponse = await apiService.exchangeOAuthCode(result.code);

    // Store tokens
    await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.accessToken);
    await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);

    setUser(authResponse.user);
    await setSessionFlag(true);
    registerPushAfterLogin();

    // Fetch full profile to populate aiTripsUsedThisMonth, subscriptionTier, etc.
    // OAuth login responses do not include subscription fields by default.
    try {
      const profile = await apiService.getProfile();
      if (profile) setUser(profile);
    } catch {
      // Best-effort — profile will be fetched on next app focus
    }
  };

  const loginWithGoogle = async () => {
    // Native mobile: use Google Sign-In SDK (no browser)
    if (Platform.OS !== 'web') {
      try {
        const idToken = await nativeGoogleSignIn();
        if (!idToken) throw new Error('GOOGLE_SIGNIN_CANCELLED');

        const authResponse: AuthResponse = await apiService.exchangeGoogleIdToken(idToken);
        await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authResponse.accessToken);
        await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);
        setUser(authResponse.user);
        await setSessionFlag(true);
        registerPushAfterLogin();
        trackEvent('login', { method: 'google_native' });

        // Fetch full profile to populate subscriptionTier and aiTripsUsedThisMonth
        // (native Google Sign-In response excludes these fields).
        try {
          const profile = await apiService.getProfile();
          if (profile) setUser(profile);
        } catch {
          // Best-effort — profile will be fetched on next app focus
        }
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

  const completeEmailVerification = async (tokens: {
    accessToken: string;
    refreshToken: string;
    user: any;
  }) => {
    await secureStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken);
    await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    setUser(tokens.user);
    await setSessionFlag(true);
    setPendingVerification(null);
    registerPushAfterLogin();

    try {
      const profile = await apiService.getProfile();
      if (profile) setUser(profile);
    } catch {
      // Best-effort
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

      // V174 (P0-1): Sign out from RevenueCat so the SDK's device-level
      // anonymous appUserID cache is reset. Without this, the next user's
      // `Purchases.logIn(newId)` aliases against the prior session — which
      // in sandbox flows reproducibly causes the V173 "이미 연간 플랜
      // 구독 중" phantom entitlement even after account deletion. Dynamic
      // require mirrors the Google sign-out pattern above so the web build
      // (which uses revenueCat.web.ts) stays safe.
      // V178 (Issue 1): cap RC sign-out at 5s so a hung SDK call cannot
      // delay setUser(null) — the V174 logOut introduced 200~800ms latency
      // and produced an "intermittent double-logout" race where the user
      // tapped logout twice because the first tap appeared to do nothing.
      try {
        const { logOut: rcLogOut } = require('../services/revenueCat');
        const rcTimeout = new Promise<void>((resolve) =>
          setTimeout(resolve, 5000),
        );
        await Promise.race([rcLogOut(), rcTimeout]);
      } catch {
        // Silent — RC sign-out is best-effort; the next mount effect will
        // re-configure with the new user anyway.
      }

      // Clear tokens and cached data
      await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await setSessionFlag(false);
      await offlineCache.clearAll();

      setUser(null);
      setPendingVerification(null);
    } catch (error) {
      // Silent fail - force clear user state regardless
      await setSessionFlag(false);
      setUser(null);
      setPendingVerification(null);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    pendingVerification,
    clearPendingVerification,
    completeEmailVerification,
    login,
    completeTwoFactorLogin,
    register,
    registerForce,
    loginWithGoogle,
    loginWithApple,
    loginWithKakao,
    logout,
    refreshUser,
    registerPushAfterLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
