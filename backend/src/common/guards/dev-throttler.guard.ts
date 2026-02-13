import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that skips rate limiting in development/test environments.
 * In production, it delegates to the standard ThrottlerGuard behavior.
 */
@Injectable()
export class DevThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const env = process.env.NODE_ENV;
    if (env === 'development' || env === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}
