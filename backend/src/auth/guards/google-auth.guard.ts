import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const platform = request.query?.platform;
    if (platform && !request.query?.code) {
      // Encode nonce + platform together so the callback can both verify CSRF
      // and determine the redirect destination from a single state value.
      // The nonce is a 16-byte CSPRNG value stored in the session for 5 min.
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
