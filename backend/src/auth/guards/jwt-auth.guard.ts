import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_SCOPE_PENDING_VERIFICATION } from '../constants/auth-error-codes';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = { scope?: string }>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (err || !user) {
      throw (
        (err as Error) || new UnauthorizedException('Authentication required')
      );
    }
    // V112 fix #3: pending_verification tokens must not unlock normal endpoints.
    // Only PendingVerificationGuard accepts them.
    const scope = (user as { scope?: string }).scope;
    if (scope === JWT_SCOPE_PENDING_VERIFICATION) {
      throw new UnauthorizedException(
        'Pending-verification token cannot access this endpoint',
      );
    }
    return user;
  }
}
