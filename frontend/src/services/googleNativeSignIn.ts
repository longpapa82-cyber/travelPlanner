import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID =
  '48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com';

const IOS_CLIENT_ID =
  process.env.GOOGLE_IOS_CLIENT_ID ||
  '48805541090-9gh3sp9asspe3d1et4er2pqpihm2bg47.apps.googleusercontent.com';

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured || Platform.OS === 'web') return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: Platform.OS === 'ios' ? IOS_CLIENT_ID : undefined,
    offlineAccess: false,
  });
  isConfigured = true;
}

export async function nativeGoogleSignIn(): Promise<string | null> {
  ensureConfigured();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();

  const idToken = response?.data?.idToken ?? null;

  if (!idToken) {
    return null;
  }

  return idToken;
}

export async function nativeGoogleSignOut(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore sign-out errors
  }
}
