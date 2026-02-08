import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, TokenPayload } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create new user
    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      name: registerDto.name,
      provider: AuthProvider.EMAIL,
    });

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id, user.email!);

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id, user.email!);

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token with refresh secret
      const payload = await this.jwtService.verifyAsync<TokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
        },
      );

      // Get user to include in response
      const user = await this.usersService.findById(payload.sub);

      // Generate new tokens
      const tokens = await this.generateTokens(payload.sub, payload.email);

      return {
        user: {
          id: user.id,
          email: user.email ?? null,
          name: user.name,
          provider: user.provider,
          profileImage: user.profileImage ?? null,
        },
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async oauthLogin(oauthUser: {
    providerId: string;
    email?: string;
    name: string;
    profileImage?: string;
    provider: 'GOOGLE' | 'APPLE' | 'KAKAO';
  }): Promise<AuthResponse> {
    // Check if user exists with this provider ID
    let user = await this.usersService.findByProviderAndId(
      oauthUser.provider as any,
      oauthUser.providerId,
    );

    if (!user) {
      // Create new user
      user = await this.usersService.create({
        email: oauthUser.email,
        name: oauthUser.name,
        provider: oauthUser.provider as any,
        providerId: oauthUser.providerId,
        profileImage: oauthUser.profileImage,
      });
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user.id, user.email || '');

    return {
      user: {
        id: user.id,
        email: user.email ?? null,
        name: user.name,
        provider: user.provider,
        profileImage: user.profileImage ?? null,
      },
      ...tokens,
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload: TokenPayload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
