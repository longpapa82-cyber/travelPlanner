import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const platform = request.query?.platform;
    if (platform && !request.query?.code) {
      const nonce = randomBytes(16).toString('hex');
      if (!request.session) request.session = {} as any;
      request.session['oauth_nonce'] = {
        value: nonce,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      const payload = JSON.stringify({ nonce, platform: String(platform) });
      return { state: Buffer.from(payload).toString('base64url') };
    }
    return {};
  }
}
