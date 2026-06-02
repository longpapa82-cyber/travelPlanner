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
    //
    // Android uses HTTPS App Links URI instead of the custom scheme because
    // KakaoTalk destroys the Chrome Custom Tab when it launches, cutting off
    // the travelplanner:// redirect chain. HTTPS App Links are delivered by
    // the Android OS directly to the app, bypassing the dead Custom Tab.
    const redirectUri = makeRedirectUri();

    // When KakaoTalk handles the auth, the Custom Tab / SFSafariViewController
    // is dismissed immediately (result.type = 'dismiss') before the callback
    // URL arrives via deep link. We listen for the deep link in parallel so
    // whichever channel delivers the callback URL first resolves the race.
    //
    // Android: callback arrives via App Links (HTTPS) after KakaoTalk destroys
    // the Custom Tab. The OS delivers it to Linking.addEventListener.
    // iOS: callback arrives via travelplanner:// custom scheme.
    const cleanups: Array<() => void> = [];

    let deeplinkResolve: ((v: string | null) => void) | undefined;

    const browserPromise = WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
      showInRecents: false,
    });

    const deeplinkPromise = (Platform.OS === 'android' || Platform.OS === 'ios')
      ? new Promise<string | null>((resolve) => {
          deeplinkResolve = resolve;
          const timer = setTimeout(() => resolve(null), 10_000);

          // Primary: listen for incoming deep link URL
          const sub = Linking.addEventListener('url', ({ url }) => {
            if (url.includes('/auth/callback')) {
              clearTimeout(timer);
              resolve(url);
            }
          });

          // Fallback for Android: the deep link may arrive as the launch Intent
          // when the app is brought to foreground after KakaoTalk finishes.
          if (Platform.OS === 'android') {
            Linking.getInitialURL().then((url) => {
              if (url && url.includes('/auth/callback')) {
                clearTimeout(timer);
                resolve(url);
              }
            }).catch(() => {});
          }

          cleanups.push(() => { sub.remove(); clearTimeout(timer); });
        })
      : Promise.resolve(null);

    // When the browser is dismissed (e.g. KakaoTalk took over the auth flow),
    // keep listening for the deep link.
    //
    // Android: KakaoTalk destroys the Custom Tab, so the callback arrives via
    // App Links (HTTPS) rather than travelplanner://. The OS delivers it to
    // Linking.addEventListener, so we wait longer (6s) for the full round-trip:
    // KakaoTalk auth → kakao server → https://mytravel-planner.com/auth/callback
    // → Android App Links → Linking event.
    //
    // iOS: SFSafariViewController stays alive in background and handles the
    // travelplanner:// redirect itself, so a short wait suffices.
    const dismissWaitMs = Platform.OS === 'android' ? 6_000 : 500;
    browserPromise.then((result) => {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        if (__DEV__) {
          console.log(`[OAuth] Browser ${result.type} on ${Platform.OS}, waiting ${dismissWaitMs}ms for deep link`);
        }
        setTimeout(() => deeplinkResolve?.(null), dismissWaitMs);
      }
    }).catch((err) => {
      if (__DEV__) console.warn('[OAuth] Browser error:', err);
      deeplinkResolve?.(null);
    });

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
 * Creates the redirect URI for OAuth callback.
 *
 * Android production uses HTTPS App Links because KakaoTalk destroys the
 * Chrome Custom Tab, making travelplanner:// unreachable. The HTTPS URI is
 * verified via assetlinks.json and delivered by the Android OS directly.
 *
 * iOS and dev environments use the custom scheme (travelplanner:// or exp://).
 */
function makeRedirectUri(): string {
  if (Platform.OS === 'web') {
    return `${window.location.origin}/auth/callback`;
  }

  // Development: Use Expo Go redirect
  if (__DEV__) {
    const scheme = 'exp';
    const host = 'localhost';
    const port = '8081';
    return `${scheme}://${host}:${port}/auth/callback`;
  }

  // Android production: HTTPS App Links (bypasses destroyed Custom Tab)
  if (Platform.OS === 'android') {
    return 'https://mytravel-planner.com/auth/callback';
  }

  // iOS production: custom scheme (SFSafariViewController handles it)
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
