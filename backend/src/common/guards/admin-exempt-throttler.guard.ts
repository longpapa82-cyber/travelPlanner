import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that exempts admin users from rate limiting.
 * Admin users have unlimited access to AI trip generation and other throttled endpoints.
 */
@Injectable()
export class AdminExemptThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Exempt admin users from throttling
    if (user?.role === 'admin') {
      return true;
    }

    // For non-admin users, apply standard throttling rules
    return super.canActivate(context);
  }
}