import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Enable dismissal of the browser on iOS
WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export type OAuthProvider = 'google' | 'apple' | 'kakao';

export interface OAuthResult {
  code: string;
}

/**
 * Initiates OAuth flow with the specified provider.
 * On web: full-page redirect (handled by WebOAuthCallbackHandler in App.tsx).
 * On mobile: Expo WebBrowser popup.
 */
export async function signInWithOAuth(
  provider: OAuthProvider
): Promise<OAuthResult | null> {
  try {
    // Generate CSRF state parameter
    const state = Crypto.randomUUID();

    // Build OAuth URL with state
    const authUrl = `${API_URL}/auth/${provider}?state=${state}`;

    // Web: redirect the current page. The callback is handled by
    // WebOAuthCallbackHandler in App.tsx when the page reloads at /auth/callback.
    if (Platform.OS === 'web') {
      sessionStorage.setItem('oauth_state', state);
      window.location.href = authUrl;
      // This promise never resolves — the page navigates away.
      return new Promise(() => {});
    }

    // Mobile: use Expo's WebBrowser
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      makeRedirectUri()
    );

    if (result.type === 'success' && result.url) {
      const callbackResult = parseOAuthCallback(result.url, state);
      return callbackResult;
    }

    return null;
  } catch (error) {
    console.error(`OAuth ${provider} error:`, error);
    throw error;
  }
}

/**
 * Creates the redirect URI for OAuth callback
 */
function makeRedirectUri(): string {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/callback`;
  }

  // Mobile development: Use Expo Go redirect
  if (__DEV__) {
    const scheme = 'exp';
    const host = 'localhost';
    const port = '8081';
    return `${scheme}://${host}:${port}/auth/callback`;
  }

  // Mobile production: Use app scheme
  return Linking.createURL('/auth/callback');
}

/**
 * Parses authorization code from OAuth callback URL and validates state
 */
function parseOAuthCallback(url: string, expectedState: string): OAuthResult | null {
  try {
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code as string;
    const returnedState = parsed.queryParams?.state as string;

    if (returnedState && returnedState !== expectedState) {
      console.error('OAuth state mismatch — possible CSRF attack');
      return null;
    }

    if (code) {
      return { code };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse OAuth callback URL:', error);
    return null;
  }
}

/**
 * Google Sign-In
 */
export async function signInWithGoogle(): Promise<OAuthResult | null> {
  return signInWithOAuth('google');
}

/**
 * Apple Sign-In
 */
export async function signInWithApple(): Promise<OAuthResult | null> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }
  return signInWithOAuth('apple');
}

/**
 * Kakao Sign-In
 */
export async function signInWithKakao(): Promise<OAuthResult | null> {
  return signInWithOAuth('kakao');
}
