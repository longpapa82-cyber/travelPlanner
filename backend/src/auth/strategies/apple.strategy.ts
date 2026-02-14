import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-apple';
import { AuthService } from '../auth.service';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('oauth.apple.clientId')!,
      teamID: configService.get<string>('oauth.apple.teamId')!,
      keyID: configService.get<string>('oauth.apple.keyId')!,
      key: configService.get<string>('oauth.apple.privateKey')!,
      callbackURL: configService.get<string>('oauth.apple.callbackUrl')!,
      scope: ['email', 'name'],
      passReqToCallback: false,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, email, name } = profile;

    const user = {
      providerId: id,
      email: email,
      name: name ? `${name.firstName} ${name.lastName}` : 'Apple User',
      profileImage: null,
      provider: 'APPLE' as const,
    };

    done(null, user);
  }
}
