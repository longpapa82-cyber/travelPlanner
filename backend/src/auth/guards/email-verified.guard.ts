import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { t, parseLang } from '../../common/i18n';

/**
 * Guard that requires the authenticated user to have a verified email.
 * Must be used after JwtAuthGuard, which populates req.user.
 * OAuth users (Google/Apple/Kakao) are auto-verified at registration.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { isEmailVerified?: boolean };
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!request.user.isEmailVerified) {
      const lang = parseLang(
        request.headers['accept-language'] as string | undefined,
      );
      throw new ForbiddenException(t('email.verification.required', lang));
    }

    return true;
  }
}
