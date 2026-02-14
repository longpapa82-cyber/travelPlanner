import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('oauth.google.clientId')!,
      clientSecret: configService.get<string>('oauth.google.clientSecret')!,
      callbackURL: configService.get<string>('oauth.google.callbackUrl')!,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName, photos } = profile;

    const user = {
      providerId: id,
      email: emails[0].value,
      name: displayName,
      profileImage: photos?.[0]?.value || null,
      provider: 'GOOGLE' as const,
    };

    done(null, user);
  }
}
