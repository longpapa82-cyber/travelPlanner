import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
