import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_SCOPE_PENDING_VERIFICATION } from '../constants/auth-error-codes';

/**
 * Guard for the email-verification resume flow.
 *
 * Only accepts JWTs whose payload carries `scope: 'pending_verification'`.
 * Applied to send-verification-code and verify-email-code so a half-registered
 * user can complete signup. Rejects full access tokens to keep the endpoint
 * boundary clean.
 */
@Injectable()
export class PendingVerificationGuard
  extends AuthGuard('jwt')
  implements CanActivate
{
  handleRequest<TUser = { scope?: string }>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired resume token');
    }
    const scope = (user as { scope?: string }).scope;
    if (scope !== JWT_SCOPE_PENDING_VERIFICATION) {
      throw new UnauthorizedException(
        'This endpoint requires a pending-verification token',
      );
    }
    return user;
  }
}
