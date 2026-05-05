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
 * On mobile: Expo WebBrowser popup that returns to the app via custom scheme.
 */
export async function signInWithOAuth(
  provider: OAuthProvider
): Promise<OAuthResult | null> {
  try {
    // Generate CSRF nonce and encode state as base64url JSON { nonce, platform }
    // so the backend's extractAndVerifyOAuthState() can read both fields from
    // the single `state` param (the old ?platform=ios query param is ignored
    // by the backend callback handler).
    const nonce = Crypto.randomUUID();
    const statePayload = btoa(JSON.stringify({ nonce, platform: Platform.OS }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const authUrl = `${API_URL}/auth/${provider}?state=${statePayload}`;

    // Web: redirect the current page. The callback is handled by
    // WebOAuthCallbackHandler in App.tsx when the page reloads at /auth/callback.
    if (Platform.OS === 'web') {
      sessionStorage.setItem('oauth_state', nonce);
      window.location.href = authUrl;
      // This promise never resolves — the page navigates away.
      return new Promise(() => {});
    }

    // Android: warm up the browser for faster Custom Tab launch
    if (Platform.OS === 'android') {
      await WebBrowser.warmUpAsync();
    }

    // Mobile: use Expo's WebBrowser — the redirect URI tells the browser
    // which URL scheme to watch for to auto-dismiss.
    const redirectUri = makeRedirectUri();

    // Android + iOS + Kakao: when the Kakao native app handles the auth, the
    // Custom Tab / SFSafariViewController is dismissed immediately
    // (result.type = 'dismiss') before the callback URL arrives via deeplink.
    // We listen for the deeplink in parallel so whichever channel delivers
    // the callback URL first resolves the race. A 30s timeout guards against hangs.
    const cleanups: Array<() => void> = [];

    const browserPromise = WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
      showInRecents: false,
    });

    const deeplinkPromise = (Platform.OS === 'android' || Platform.OS === 'ios')
      ? new Promise<string | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 30_000);
          const sub = Linking.addEventListener('url', ({ url }) => {
            if (url.includes('/auth/callback')) {
              clearTimeout(timer);
              resolve(url);
            }
          });
          cleanups.push(() => sub.remove());
        })
      : Promise.resolve(null);

    const [result, deeplinkUrl] = await Promise.all([browserPromise, deeplinkPromise]);

    cleanups.forEach((fn) => fn());

    // Android: clean up browser connection
    if (Platform.OS === 'android') {
      await WebBrowser.coolDownAsync();
    }

    // Prefer deeplink URL (arrives even when Custom Tab was dismissed by native app)
    const callbackUrl =
      deeplinkUrl ??
      (result.type === 'success' && result.url ? result.url : null);

    if (callbackUrl) {
      return parseOAuthCallback(callbackUrl, nonce);
    }

    return null;
  } catch (error) {
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

  // Mobile production: Use app scheme (travelplanner:///auth/callback)
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
      if (__DEV__) console.warn('OAuth state mismatch — possible CSRF attack');
      return null;
    }

    if (code) {
      return { code };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Google Sign-In
 */
export async function signInWithGoogle(): Promise<OAuthResult | null> {
  return signInWithOAuth('google');
}

export interface AppleNativeResult {
  identityToken: string;
  fullName?: string;
}

/**
 * Apple Sign-In — uses native expo-apple-authentication SDK on iOS.
 * Returns identityToken directly so the backend can verify it via
 * POST /auth/apple/token without a web OAuth redirect flow.
 */
export async function signInWithAppleNative(): Promise<AppleNativeResult | null> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }

  const AppleAuthentication = await import('expo-apple-authentication');

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Apple Sign-In is not available on this device');
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return null;
    }

    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return { identityToken: credential.identityToken, fullName };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      throw new Error('APPLE_SIGNIN_CANCELLED');
    }
    throw error;
  }
}

/**
 * Apple Sign-In (kept for web compatibility)
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
