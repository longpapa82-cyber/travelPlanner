import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

interface GoogleProfile {
  id: string;
  emails: Array<{ value: string }>;
  displayName: string;
  photos?: Array<{ value: string }>;
}

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
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): void {
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
