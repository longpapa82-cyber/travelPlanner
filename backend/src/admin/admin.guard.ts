import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

const ADMIN_EMAILS = ['a090723@naver.com', 'longpapa82@gmail.com'];

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
