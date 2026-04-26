/**
 * V187 P1-A — logout race regression test (Invariants 36, 41).
 *
 * This test exists because of the 4-cycle regression history:
 *
 *   V177: first tap of "logout" only navigates home; second tap actually
 *         logs out. RCA: ProfileScreen ref guard ineffective during the
 *         RC SDK sign-out latency window.
 *   V181: same symptom returns despite the V178 await + ref fix. RCA:
 *         the V178 ref was set AFTER the await on confirm() — the
 *         dialog-open window was unguarded.
 *   V184: 100% reproducible regression. RCA: PremiumContext's AppState
 *         handler fired silentRefresh during the logout chain and
 *         setUser(profile) overrode the in-progress setUser(null).
 *   V186: V185 invariant 36 (cross-context lock) was set from logout()
 *         only. The withdrawAccount path did NOT touch the AuthContext
 *         lock — it only flipped PremiumContext's local
 *         markLoggingOut(). Result: deleteAccount → in-flight 401 →
 *         setUser(null) fired before the explicit logout() entered.
 *
 * Each regression added a fix and shipped without an automated test that
 * proved the race could no longer happen. V187 P0-C closes the code path;
 * this test pins the closure so a 5th regression cannot land silently.
 *
 * The test orchestrates the exact race: a logout (or termination) is
 * initiated, an AppState 'change' fires while the chain is mid-flight,
 * and a stale getProfile() resolution is queued behind the lock release.
 * Pass condition: user remains null and the lock prevents the foreground
 * refresh from leaking a stale profile.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import apiService from '../../services/api';
import { secureStorage } from '../../utils/storage';

// AppState.currentState defaults to 'unknown' in jest-expo; force it to a
// real string so AuthProvider's `appState.current.match(...)` succeeds.
Object.defineProperty(AppState, 'currentState', {
  value: 'active',
  writable: true,
  configurable: true,
});

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
    deleteAccount: jest.fn(),
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
  offlineCache: { clearAll: jest.fn(() => Promise.resolve()), get: jest.fn() },
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

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'email' as const,
  isEmailVerified: true,
  isTwoFactorEnabled: false,
  subscriptionTier: 'free',
  aiTripsUsedThisMonth: 0,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

/**
 * Capture the AppState 'change' listener so the test can fire it
 * synchronously, simulating an OS background→foreground event.
 *
 * Must be installed in beforeEach (BEFORE renderHook) so the
 * AuthProvider's useEffect grabs the spied implementation. Returns a
 * getter — the listener is captured asynchronously when the provider
 * mounts.
 */
const installAppStateCapture = () => {
  const ref: { listener: ((s: string) => void) | null } = { listener: null };
  jest.spyOn(AppState, 'addEventListener').mockImplementation(
    ((event: string, cb: (s: string) => void) => {
      if (event === 'change') ref.listener = cb;
      return { remove: jest.fn() };
    }) as any,
  );
  return ref;
};

describe('logout race regression (V187 P1-A)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (secureStorage.getItem as jest.Mock).mockResolvedValue('refresh-token');
    (apiService.getProfile as jest.Mock).mockResolvedValue(mockUser);
    (apiService.logout as jest.Mock).mockResolvedValue(undefined);
  });

  it('Invariant 36: AppState change during logout does NOT leak a stale profile', async () => {
    const captured = installAppStateCapture();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for initial auth check to seed the user AND for the
    // AppState listener to be registered.
    await waitFor(() => expect(result.current.user).not.toBeNull());
    await waitFor(() => expect(captured.listener).not.toBeNull());

    // Logout call returns slowly enough for the AppState event to race it.
    let releaseLogout: () => void = () => {};
    (apiService.logout as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseLogout = resolve;
        }),
    );

    // Stage a stale profile that would normally win if the lock were broken.
    (apiService.getProfile as jest.Mock).mockResolvedValueOnce({
      ...mockUser,
      name: 'StaleProfile',
    });

    // Start logout but don't await — we want the in-flight window.
    let logoutPromise!: Promise<void>;
    act(() => {
      logoutPromise = result.current.logout();
    });

    // Sanity: lock is engaged immediately.
    await waitFor(() => expect(result.current.isLoggingOut).toBe(true));

    // Fire the AppState foreground transition during the in-flight window.
    act(() => {
      // Drive the appState ref to background then back to active so
      // the inactive→active branch triggers silentRefresh.
      captured.listener!('background');
      captured.listener!('active');
    });

    // Allow logout to complete and the (skipped) silentRefresh to settle.
    act(() => releaseLogout());
    await act(async () => {
      await logoutPromise;
    });

    // Lock release is microtask-deferred; wait for it.
    await waitFor(() => expect(result.current.isLoggingOut).toBe(false));

    // Crucial assertion: user is null. If the AppState handler bypassed
    // the lock, getProfile's 'StaleProfile' would have won.
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('Invariant 41: markAccountTerminating engages the cross-context lock before deleteAccount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.isLoggingOut).toBe(false);

    // Simulate the V187 P0-C ProfileScreen pattern: lock is engaged
    // BEFORE the network call so the entire termination transaction is
    // guarded — not just the trailing logout step.
    act(() => {
      result.current.markAccountTerminating();
    });

    // The lock must be observable to other contexts immediately, not
    // after the eventual logout(). This is the V186 #4 RCA closure:
    // PremiumContext's markLoggingOut was a separate variable, leaving
    // the AuthContext lock un-set during deleteAccount.
    expect(result.current.isLoggingOut).toBe(true);
  });

  it('Invariant 36: silentRefresh during in-flight termination is a no-op', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    // Engage termination lock first (P0-C pattern).
    act(() => result.current.markAccountTerminating());

    // Simulate a stale profile that a leaked silentRefresh would apply.
    (apiService.getProfile as jest.Mock).mockResolvedValueOnce({
      ...mockUser,
      name: 'LeakedProfile',
    });

    // Run logout to completion.
    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => expect(result.current.isLoggingOut).toBe(false));
    expect(result.current.user).toBeNull();
    // refreshUser is the public surface that silentRefresh shares — if
    // it ever fires while the lock is engaged it must not call setUser.
    // Here we explicitly trigger a refresh path to prove the gate holds.
    act(() => result.current.markAccountTerminating());
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.user).toBeNull();
  });
});
