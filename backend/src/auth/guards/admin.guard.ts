import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

/*
 * V115 (Gate 7 H-1 fix): admin email list.
 *
 * Previously the fallback hardcoded real production emails in source, which
 * exposed admin identities to anyone with repo read access and meant a missing
 * env var on deploy would silently reinstate stale admins. Now the list comes
 * strictly from ADMIN_EMAILS; an empty or missing env var yields an empty
 * allowlist (admin-by-email disabled) and logs a loud startup warning so
 * operators notice the misconfiguration.
 */
const ADMIN_EMAILS_RAW = process.env.ADMIN_EMAILS ?? '';
const ADMIN_EMAILS: string[] = ADMIN_EMAILS_RAW.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const _adminGuardLogger = new Logger('AdminGuard');
if (ADMIN_EMAILS.length === 0) {
  _adminGuardLogger.warn(
    'ADMIN_EMAILS env var is empty or unset. Admin-by-email disabled. Only users with role=admin in the DB will be recognized.',
  );
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check both role and email-based admin access
    // Priority: role=admin > email in ADMIN_EMAILS list
    const isAdminByRole =
      user?.role === UserRole.ADMIN || user?.role === 'admin';
    const isAdminByEmail =
      user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

    if (!isAdminByRole && !isAdminByEmail) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
