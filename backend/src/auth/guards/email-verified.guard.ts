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
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!user.isEmailVerified) {
      const lang = parseLang(request.headers['accept-language']);
      throw new ForbiddenException(t('email.verification.required', lang));
    }

    return true;
  }
}
