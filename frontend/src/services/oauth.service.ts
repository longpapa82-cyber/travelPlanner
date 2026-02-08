import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// Enable dismissal of the browser on iOS
WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export type OAuthProvider = 'google' | 'apple' | 'kakao';

export interface OAuthResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Initiates OAuth flow with the specified provider
 */
export async function signInWithOAuth(
  provider: OAuthProvider
): Promise<OAuthResult | null> {
  try {
    // Build OAuth URL
    const authUrl = `${API_URL}/auth/${provider}`;

    // Open browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      makeRedirectUri()
    );

    if (result.type === 'success' && result.url) {
      // Parse tokens from redirect URL
      const tokens = parseTokensFromUrl(result.url);
      return tokens;
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
  // Development: Use Expo Go redirect
  if (__DEV__) {
    const scheme = 'exp';
    const host = 'localhost';
    const port = '8081';
    return `${scheme}://${host}:${port}/auth/callback`;
  }

  // Production: Use app scheme
  return Linking.createURL('/auth/callback');
}

/**
 * Parses access and refresh tokens from OAuth callback URL
 */
function parseTokensFromUrl(url: string): OAuthResult | null {
  try {
    const parsed = Linking.parse(url);
    const accessToken = parsed.queryParams?.accessToken as string;
    const refreshToken = parsed.queryParams?.refreshToken as string;

    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse tokens from URL:', error);
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
  // Apple Sign-In is only available on iOS
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
