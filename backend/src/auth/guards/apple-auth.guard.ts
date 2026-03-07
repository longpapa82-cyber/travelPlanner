import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AppleAuthGuard extends AuthGuard('apple') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const platform = request.query?.platform;
    if (platform && !request.query?.code) {
      return { state: String(platform) };
    }
    return {};
  }
}
