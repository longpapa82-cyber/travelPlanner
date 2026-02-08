import { registerAs } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';

export default registerAs('oauth', () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
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
    callbackUrl: process.env.APPLE_CALLBACK_URL,
  },
  kakao: {
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    callbackUrl: process.env.KAKAO_CALLBACK_URL,
  },
}));
