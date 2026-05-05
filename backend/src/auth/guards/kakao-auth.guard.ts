import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';

function extractPlatformFromRequest(request: any): string | undefined {
  const rawState = request.query?.state as string | undefined;
  if (rawState) {
    try {
      const decoded = Buffer.from(rawState, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded) as { platform?: string };
      if (parsed.platform === 'ios' || parsed.platform === 'android') {
        return parsed.platform;
      }
    } catch {
      // Not JSON — fall through
    }
  }
  const platform = request.query?.platform as string | undefined;
  if (platform === 'ios' || platform === 'android') return platform;
  return undefined;
}

@Injectable()
export class KakaoAuthGuard extends AuthGuard('kakao') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const platform = extractPlatformFromRequest(request);
    if (platform && !request.query?.code) {
      const nonce = randomBytes(16).toString('hex');
      if (!request.session) request.session = {} as any;
      request.session['oauth_nonce'] = {
        value: nonce,
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      const payload = JSON.stringify({ nonce, platform });
      return { state: Buffer.from(payload).toString('base64url') };
    }
    return {};
  }
}
