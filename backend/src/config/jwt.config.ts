import { registerAs } from '@nestjs/config';
import { Logger } from '@nestjs/common';

const logger = new Logger('JwtConfig');

export default registerAs('jwt', () => {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (isProd && !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }

  if (!isProd && !process.env.JWT_SECRET) {
    logger.warn(
      'Using dev fallback JWT_SECRET — set JWT_SECRET env var for production',
    );
  }

  return {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d',
  };
});
