import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    // Pass platform through OAuth state so the callback knows where to redirect.
    // Only set on the initial request (no 'code' = not a callback).
    const platform = request.query?.platform;
    if (platform && !request.query?.code) {
      return { state: String(platform) };
    }
    return {};
  }
}
