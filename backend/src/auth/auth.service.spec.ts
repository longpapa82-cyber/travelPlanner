import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    provider: AuthProvider.EMAIL,
    profileImage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      validatePassword: jest.fn(),
      findById: jest.fn(),
      findByProviderAndId: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Default config mock responses
    configService.get.mockImplementation((key: string) => {
      const config = {
        'jwt.secret': 'test-secret',
        'jwt.expiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '7d',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'StrongPassword123!',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(usersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(usersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        provider: AuthProvider.EMAIL,
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          provider: mockUser.provider,
          profileImage: null,
        },
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should generate both access and refresh tokens', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      await service.register(registerDto);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: mockUser.id, email: mockUser.email },
        { secret: 'test-secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: mockUser.id, email: mockUser.email },
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        loginDto.password,
      );
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          provider: mockUser.provider,
          profileImage: null,
        },
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(usersService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('refreshToken', () => {
    const validRefreshToken = 'valid-refresh-token';
    const tokenPayload = {
      sub: mockUser.id,
      email: mockUser.email,
    };

    it('should successfully refresh tokens with valid refresh token', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(tokenPayload as any);
      usersService.findById.mockResolvedValue(mockUser as any);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      // Act
      const result = await service.refreshToken(validRefreshToken);

      // Assert
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(validRefreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(usersService.findById).toHaveBeenCalledWith(tokenPayload.sub);
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Token expired'));

      // Act & Assert
      await expect(service.refreshToken(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      // Arrange
      usersService.findById.mockResolvedValue(mockUser as any);

      // Act
      const result = await service.getProfile(mockUser.id);

      // Assert
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        provider: mockUser.provider,
        profileImage: mockUser.profileImage,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      const error = new Error('User with ID invalid-id not found');
      usersService.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getProfile('invalid-id')).rejects.toThrow(error);
      expect(usersService.findById).toHaveBeenCalledWith('invalid-id');
    });
  });

  describe('oauthLogin', () => {
    const oauthUser = {
      providerId: 'google-123',
      email: 'oauth@example.com',
      name: 'OAuth User',
      profileImage: 'https://example.com/image.jpg',
      provider: 'GOOGLE' as const,
    };

    it('should create new user if not exists', async () => {
      // Arrange
      usersService.findByProviderAndId.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.GOOGLE,
        providerId: oauthUser.providerId,
      } as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.oauthLogin(oauthUser);

      // Assert
      expect(usersService.findByProviderAndId).toHaveBeenCalledWith(
        'GOOGLE',
        oauthUser.providerId,
      );
      expect(usersService.create).toHaveBeenCalledWith({
        email: oauthUser.email,
        name: oauthUser.name,
        provider: 'GOOGLE',
        providerId: oauthUser.providerId,
        profileImage: oauthUser.profileImage,
      });
      expect(result.user.provider).toBe(AuthProvider.GOOGLE);
    });

    it('should login existing OAuth user', async () => {
      // Arrange
      const existingOAuthUser = {
        ...mockUser,
        provider: AuthProvider.GOOGLE,
        providerId: oauthUser.providerId,
      };
      usersService.findByProviderAndId.mockResolvedValue(
        existingOAuthUser as any,
      );
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.oauthLogin(oauthUser);

      // Assert
      expect(usersService.findByProviderAndId).toHaveBeenCalledWith(
        'GOOGLE',
        oauthUser.providerId,
      );
      expect(usersService.create).not.toHaveBeenCalled();
      expect(result.accessToken).toBe(mockTokens.accessToken);
    });

    it('should handle OAuth login for all providers', async () => {
      // Test Google
      await testOAuthProvider('GOOGLE');
      // Test Apple
      await testOAuthProvider('APPLE');
      // Test Kakao
      await testOAuthProvider('KAKAO');

      async function testOAuthProvider(provider: 'GOOGLE' | 'APPLE' | 'KAKAO') {
        usersService.findByProviderAndId.mockResolvedValue(null);
        usersService.create.mockResolvedValue({
          ...mockUser,
          provider: AuthProvider[provider],
        } as any);
        jwtService.signAsync
          .mockResolvedValueOnce(mockTokens.accessToken)
          .mockResolvedValueOnce(mockTokens.refreshToken);

        await service.oauthLogin({ ...oauthUser, provider });
        expect(usersService.findByProviderAndId).toHaveBeenCalledWith(
          provider,
          oauthUser.providerId,
        );
      }
    });

    it('should handle Apple OAuth without email', async () => {
      // Arrange
      const appleUser = {
        providerId: 'apple-456',
        name: 'Apple User',
        provider: 'APPLE' as const,
      };
      usersService.findByProviderAndId.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: undefined,
        provider: AuthProvider.APPLE,
        providerId: appleUser.providerId,
      } as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.oauthLogin(appleUser);

      // Assert
      expect(usersService.create).toHaveBeenCalledWith({
        email: undefined,
        name: appleUser.name,
        provider: 'APPLE',
        providerId: appleUser.providerId,
        profileImage: undefined,
      });
      expect(result.user.email).toBeNull();
    });

    it('should handle Kakao OAuth without email', async () => {
      // Arrange
      const kakaoUser = {
        providerId: 'kakao-789',
        name: 'Kakao User',
        profileImage: 'https://kakao.com/image.jpg',
        provider: 'KAKAO' as const,
      };
      usersService.findByProviderAndId.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: undefined,
        provider: AuthProvider.KAKAO,
        providerId: kakaoUser.providerId,
        profileImage: kakaoUser.profileImage,
      } as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.oauthLogin(kakaoUser);

      // Assert
      expect(usersService.create).toHaveBeenCalledWith({
        email: undefined,
        name: kakaoUser.name,
        provider: 'KAKAO',
        providerId: kakaoUser.providerId,
        profileImage: kakaoUser.profileImage,
      });
      expect(result.user.email).toBeNull();
    });

    it('should generate tokens for OAuth login', async () => {
      // Arrange
      usersService.findByProviderAndId.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.GOOGLE,
      } as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      const result = await service.oauthLogin(oauthUser);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBe(mockTokens.refreshToken);
    });
  });

  describe('token generation', () => {
    it('should generate tokens with correct configuration', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      await service.register(registerDto);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('jwt.secret');
      expect(configService.get).toHaveBeenCalledWith('jwt.expiresIn');
      expect(configService.get).toHaveBeenCalledWith('jwt.refreshSecret');
      expect(configService.get).toHaveBeenCalledWith('jwt.refreshExpiresIn');
    });

    it('should create tokens with user payload', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      jwtService.signAsync
        .mockResolvedValueOnce(mockTokens.accessToken)
        .mockResolvedValueOnce(mockTokens.refreshToken);

      // Act
      await service.register(registerDto);

      // Assert
      const expectedPayload = {
        sub: mockUser.id,
        email: mockUser.email,
      };
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expectedPayload,
        expect.objectContaining({ secret: 'test-secret' }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expectedPayload,
        expect.objectContaining({ secret: 'test-refresh-secret' }),
      );
    });

    it('should generate tokens in parallel using Promise.all', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      usersService.validatePassword.mockResolvedValue(true);

      let accessTokenResolve: any;
      let refreshTokenResolve: any;
      const accessTokenPromise = new Promise((resolve) => {
        accessTokenResolve = resolve;
      });
      const refreshTokenPromise = new Promise((resolve) => {
        refreshTokenResolve = resolve;
      });

      jwtService.signAsync
        .mockReturnValueOnce(accessTokenPromise as any)
        .mockReturnValueOnce(refreshTokenPromise as any);

      // Act
      const loginPromise = service.login(loginDto);

      // Resolve tokens in parallel
      accessTokenResolve(mockTokens.accessToken);
      refreshTokenResolve(mockTokens.refreshToken);

      const result = await loginPromise;

      // Assert
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBe(mockTokens.refreshToken);
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });
});
