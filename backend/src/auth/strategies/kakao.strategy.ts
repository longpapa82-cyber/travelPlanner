import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      authorizationURL: 'https://kauth.kakao.com/oauth/authorize',
      tokenURL: 'https://kauth.kakao.com/oauth/token',
      clientID: configService.get<string>('oauth.kakao.clientId')!,
      clientSecret: configService.get<string>('oauth.kakao.clientSecret')!,
      callbackURL: configService.get<string>('oauth.kakao.callbackUrl')!,
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    _profile: Record<string, unknown>,
    done: (error: Error | null, user?: Record<string, unknown>) => void,
  ): Promise<void> {
    try {
      // Kakao API로 사용자 정보 조회
      const response = await axios.get<{
        id: number;
        kakao_account?: {
          email?: string;
          profile?: { nickname?: string; profile_image_url?: string };
        };
      }>('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const { id, kakao_account } = response.data;

      const user = {
        providerId: id.toString(),
        email: kakao_account?.email || null,
        name: kakao_account?.profile?.nickname || 'Kakao User',
        profileImage: kakao_account?.profile?.profile_image_url || null,
        provider: 'KAKAO' as const,
      };

      done(null, user);
    } catch (error) {
      done(
        error instanceof Error ? error : new Error(String(error)),
        undefined,
      );
    }
  }
}
