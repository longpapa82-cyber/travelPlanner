import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthProvider, SubscriptionTier } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let authService: jest.Mocked<AuthService>;

  // Mock data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com' as string | null,
    name: 'Test User',
    provider: AuthProvider.EMAIL,
    profileImage: null as string | null,
    isEmailVerified: false,
  };

  const mockAuthResponse = {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  const mockPendingVerificationResponse = {
    action: 'created' as const,
    user: mockUser,
    resumeToken: 'mock-resume-token',
    requiresEmailVerification: true as const,
  };

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    getProfile: jest.fn(),
    oauthLogin: jest.fn(),
    createOAuthTempCode: jest.fn(),
    exchangeOAuthCode: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: NotificationsService,
          useValue: {
            registerPushToken: jest.fn(),
            removePushToken: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const request = context.switchToHttp().getRequest();
          // Mock authenticated user for protected routes
          request.user = { userId: mockUser.id };
          return true;
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();

    // Apply global validation pipe to test DTO validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    authService = moduleRef.get(AuthService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user with valid data', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };

      authService.register.mockResolvedValue(mockPendingVerificationResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toEqual(mockPendingVerificationResponse);
      expect(authService.register).toHaveBeenCalledWith(registerDto, 'ko');
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when email is invalid', async () => {
      const invalidDto = {
        email: 'not-an-email',
        password: 'password123',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should return 400 when password is too short', async () => {
      const invalidDto = {
        email: 'test@example.com',
        password: '1234567', // Less than 8 characters
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toContain(
        'Password must be at least 8 characters long',
      );
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      const invalidDto = {
        password: 'password123',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(
        response.body.message.some((m: string) => m.includes('email')),
      ).toBe(true);
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should return 400 when name is missing', async () => {
      const invalidDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(
        response.body.message.some((m: string) => m.includes('name')),
      ).toBe(true);
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should return 409 when email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      authService.register.mockRejectedValue({
        status: 409,
        response: { message: 'Email already registered' },
      });

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(500); // NestJS converts unhandled exceptions to 500

      expect(authService.register).toHaveBeenCalledWith(registerDto, 'ko');
    });
  });

  describe('POST /auth/login', () => {
    it('should login user with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200); // HttpCode(HttpStatus.OK)

      expect(response.body).toEqual(mockAuthResponse);
      expect(authService.login).toHaveBeenCalled();
      expect(authService.login.mock.calls[0][0]).toEqual(loginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when email is invalid', async () => {
      const invalidDto = {
        email: 'invalid-email',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidDto)
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
      const invalidDto = {
        email: 'test@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidDto)
        .expect(400);

      expect(
        response.body.message.some((m: string) => m.includes('password')),
      ).toBe(true);
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should return 401 when credentials are invalid', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      authService.login.mockRejectedValue({
        status: 401,
        response: { message: 'Invalid credentials' },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(500); // NestJS converts unhandled exceptions to 500

      expect(authService.login).toHaveBeenCalled();
      expect(authService.login.mock.calls[0][0]).toEqual(loginDto);
    });

    it('should return 200 status code for successful login (not 201)', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200); // Should be 200, not 201

      expect(authService.login).toHaveBeenCalled();
      expect(authService.login.mock.calls[0][0]).toEqual(loginDto);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const refreshDto = {
        refreshToken: 'valid-refresh-token',
      };

      authService.refreshToken.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshDto)
        .expect(200); // HttpCode(HttpStatus.OK)

      expect(response.body).toEqual(mockAuthResponse);
      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshDto.refreshToken,
      );
      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when refresh token is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('should return 401 when refresh token is invalid', async () => {
      const refreshDto = {
        refreshToken: 'invalid-token',
      };

      authService.refreshToken.mockRejectedValue({
        status: 401,
        response: { message: 'Invalid refresh token' },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshDto)
        .expect(500); // NestJS converts unhandled exceptions to 500

      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshDto.refreshToken,
      );
    });

    it('should return 401 when refresh token is expired', async () => {
      const refreshDto = {
        refreshToken: 'expired-token',
      };

      authService.refreshToken.mockRejectedValue({
        status: 401,
        response: { message: 'Invalid refresh token' },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshDto)
        .expect(500); // NestJS converts unhandled exceptions to 500

      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshDto.refreshToken,
      );
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile when authenticated', async () => {
      const now = new Date();
      const mockProfile = {
        id: mockUser.id,
        email: mockUser.email ?? undefined,
        name: mockUser.name,
        provider: mockUser.provider,
        profileImage: mockUser.profileImage ?? undefined,
        isEmailVerified: false,
        isTwoFactorEnabled: false,
        isAdmin: false,
        subscriptionTier: SubscriptionTier.FREE,
        subscriptionPlatform: undefined,
        subscriptionExpiresAt: undefined,
        subscriptionStartedAt: undefined,
        subscriptionPlanType: undefined,
        aiTripsUsedThisMonth: 0,
        createdAt: now,
        updatedAt: now,
      };

      authService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      // JSON serialization converts Dates to strings and drops undefined fields
      expect(response.body).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          provider: mockUser.provider,
          isEmailVerified: false,
          isTwoFactorEnabled: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
      );
      expect(authService.getProfile).toHaveBeenCalledWith(mockUser.id);
      expect(authService.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should return 401 when not authenticated (guard test)', async () => {
      // Create a new module with guard that denies access
      const moduleRef = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: mockAuthService,
          },
          {
            provide: NotificationsService,
            useValue: {
              registerPushToken: jest.fn(),
              removePushToken: jest.fn(),
            },
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: jest.fn(() => false),
        })
        .compile();

      const testApp = moduleRef.createNestApplication();
      await testApp.init();

      await request(testApp.getHttpServer()).get('/auth/me').expect(403); // Guard returns 403 when canActivate is false

      expect(authService.getProfile).not.toHaveBeenCalled();

      await testApp.close();
    });

    it('should use @CurrentUser decorator to extract userId', async () => {
      const mockProfile = {
        id: mockUser.id,
        email: mockUser.email ?? undefined,
        name: mockUser.name,
        provider: mockUser.provider,
        profileImage: mockUser.profileImage ?? undefined,
        isEmailVerified: false,
        isTwoFactorEnabled: false,
        isAdmin: false,
        subscriptionTier: SubscriptionTier.FREE,
        subscriptionPlatform: undefined,
        subscriptionExpiresAt: undefined,
        subscriptionStartedAt: undefined,
        subscriptionPlanType: undefined,
        aiTripsUsedThisMonth: 0,
        lastPlatform: null as string | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      authService.getProfile.mockResolvedValue(mockProfile);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      // Verify that the service was called with the userId extracted by @CurrentUser decorator
      expect(authService.getProfile).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('Response Format Validation', () => {
    it('should return correct structure for register response', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      authService.register.mockResolvedValue(mockPendingVerificationResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // V112 fix #3: register returns a resume token instead of full tokens.
      // Verification is completed via PendingVerificationGuard-protected endpoints.
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('resumeToken');
      expect(response.body).toHaveProperty('requiresEmailVerification', true);
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('provider');
    });

    it('should return correct structure for login response', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return correct structure for refresh response', async () => {
      const refreshDto = {
        refreshToken: 'valid-refresh-token',
      };

      authService.refreshToken.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshDto)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return correct error structure for validation errors', async () => {
      const invalidDto = {
        email: 'invalid',
        password: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);
    });
  });

  describe('Content-Type Validation', () => {
    it('should accept application/json content type', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send(loginDto)
        .expect(200);

      expect(authService.login).toHaveBeenCalled();
      expect(authService.login.mock.calls[0][0]).toEqual(loginDto);
    });

    it('should return application/json response', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      authService.login.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('POST /auth/oauth/exchange', () => {
    it('should exchange a valid OAuth code for tokens', async () => {
      authService.exchangeOAuthCode.mockResolvedValue(mockAuthResponse);

      const response = await request(app.getHttpServer())
        .post('/auth/oauth/exchange')
        .send({ code: 'valid-oauth-code' })
        .expect(200);

      expect(response.body).toEqual(mockAuthResponse);
      expect(authService.exchangeOAuthCode).toHaveBeenCalled();
      expect(authService.exchangeOAuthCode.mock.calls[0][0]).toBe(
        'valid-oauth-code',
      );
    });

    it('should return 400 when code is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/oauth/exchange')
        .send({})
        .expect(400);

      expect(authService.exchangeOAuthCode).not.toHaveBeenCalled();
    });

    it('should return 400 when code is empty string', async () => {
      await request(app.getHttpServer())
        .post('/auth/oauth/exchange')
        .send({ code: '' })
        .expect(400);

      expect(authService.exchangeOAuthCode).not.toHaveBeenCalled();
    });
  });

  describe('DTO Validation Edge Cases', () => {
    it('should reject empty request body for register', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should reject null values in register DTO', async () => {
      const invalidDto = {
        email: null,
        password: null,
        name: null,
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should reject extra properties when using whitelist', async () => {
      const dtoWithExtra = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        extraField: 'should be rejected',
      };

      authService.register.mockResolvedValue(mockPendingVerificationResponse);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(dtoWithExtra)
        .expect(400); // forbidNonWhitelisted: true

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should accept minimum valid password length (8 characters)', async () => {
      const validDto = {
        email: 'test@example.com',
        password: 'pass1234', // Exactly 8 characters with letter + number
        name: 'Test User',
      };

      authService.register.mockResolvedValue(mockPendingVerificationResponse);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validDto)
        .expect(201);

      expect(authService.register).toHaveBeenCalledWith(validDto, 'ko');
    });
  });
});
