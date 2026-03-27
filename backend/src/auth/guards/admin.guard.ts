import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS || 'a090723@naver.com,longpapa82@gmail.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check both role and email-based admin access
    // Priority: role=admin > email in ADMIN_EMAILS list
    const isAdminByRole = user?.role === UserRole.ADMIN || user?.role === 'admin';
    const isAdminByEmail = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

    if (!isAdminByRole && !isAdminByEmail) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
