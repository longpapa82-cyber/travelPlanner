import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';
import { AuthService } from '../auth.service';

interface AppleProfile {
  id: string;
  email?: string;
  name?: { firstName?: string; lastName?: string };
}

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clientID = configService.get<string>('oauth.apple.clientId') || 'placeholder';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- passport-apple Strategy constructor is untyped
    super({
      clientID,
      teamID: configService.get<string>('oauth.apple.teamId') || 'placeholder',
      keyID: configService.get<string>('oauth.apple.keyId') || 'placeholder',
      key: configService.get<string>('oauth.apple.privateKey') || 'placeholder-key',
      callbackURL: configService.get<string>('oauth.apple.callbackUrl')!,
      scope: ['email', 'name'],
      passReqToCallback: false,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: AppleProfile,
    done: VerifyCallback,
  ): void {
    const { id, email, name } = profile;

    const user = {
      providerId: id,
      email: email,
      name: name ? `${name.firstName} ${name.lastName}` : 'Apple User',
      profileImage: null,
      provider: 'APPLE' as const,
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- passport VerifyCallback typing mismatch
    done(null, user);
  }
}
