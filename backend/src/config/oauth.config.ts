import { registerAs } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';

const PROD_DOMAIN = 'https://mytravel-planner.com';

/** In production, never allow localhost callback URLs */
function resolveCallbackUrl(envVar: string | undefined, path: string): string {
  if (envVar && !envVar.includes('localhost')) return envVar;
  if (process.env.NODE_ENV === 'production') return `${PROD_DOMAIN}${path}`;
  return envVar || `http://localhost:3000${path}`;
}

export default registerAs('oauth', () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: resolveCallbackUrl(
      process.env.GOOGLE_CALLBACK_URL,
      '/api/auth/google/callback',
    ),
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey:
      process.env.APPLE_PRIVATE_KEY_PATH &&
      existsSync(process.env.APPLE_PRIVATE_KEY_PATH)
        ? readFileSync(process.env.APPLE_PRIVATE_KEY_PATH, 'utf8')
        : process.env.APPLE_PRIVATE_KEY || '',
    callbackUrl: resolveCallbackUrl(
      process.env.APPLE_CALLBACK_URL,
      '/api/auth/apple/callback',
    ),
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    callbackUrl: resolveCallbackUrl(
      process.env.KAKAO_CALLBACK_URL,
      '/api/auth/kakao/callback',
    ),
  },
}));
