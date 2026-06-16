import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: { sub: string; email: string; scope?: string }) {
    // Use the non-throwing lookup so a token whose subject no longer exists
    // (e.g. deleted account still holding a valid access token) returns 401
    // Unauthorized — not the 404 that findById would throw. The 401 lets the
    // client's interceptor refresh/clear tokens and log out cleanly.
    const user = await this.usersService.findByIdOrNull(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      isEmailVerified: user.isEmailVerified,
      // V112 fix #3: propagate scope so PendingVerificationGuard / normal
      // auth guards can distinguish resume tokens from full access tokens.
      scope: payload.scope,
    };
  }
}
