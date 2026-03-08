import { Platform } from 'react-native';

/**
 * Native Google Sign-In for Android/iOS.
 * Uses @react-native-google-signin/google-signin to show native account picker
 * instead of Chrome Custom Tab. Returns an ID token for backend verification.
 */

let GoogleSignin: any = null;
let isConfigured = false;

// Web Client ID from Google Cloud Console (same as backend GOOGLE_CLIENT_ID)
const WEB_CLIENT_ID =
  '48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com';

function ensureConfigured() {
  if (isConfigured || Platform.OS === 'web') return;
  try {
    const mod = require('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
    isConfigured = true;
  } catch {
    // Package not available (web or dev client without native module)
    GoogleSignin = null;
  }
}

export async function nativeGoogleSignIn(): Promise<string | null> {
  ensureConfigured();

  if (!GoogleSignin) {
    throw new Error('Google Sign-In native module not available');
  }

  // Check if Google Play Services are available (Android)
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();

  // Extract ID token from the response
  const idToken = response?.data?.idToken ?? response?.idToken ?? null;

  if (!idToken) {
    // User cancelled or no token returned
    return null;
  }

  return idToken;
}

export async function nativeGoogleSignOut(): Promise<void> {
  ensureConfigured();
  if (GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore sign-out errors
    }
  }
}
