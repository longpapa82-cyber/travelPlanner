import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: { findByIdOrNull: jest.Mock };

  const payload = { sub: 'user-1', email: 'test@example.com', scope: 'full' };

  beforeEach(async () => {
    usersService = { findByIdOrNull: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns the auth context for an existing user', async () => {
    // Arrange
    usersService.findByIdOrNull.mockResolvedValue({
      id: 'user-1',
      isEmailVerified: true,
    });

    // Act
    const result = await strategy.validate(payload);

    // Assert
    expect(usersService.findByIdOrNull).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      userId: 'user-1',
      email: 'test@example.com',
      isEmailVerified: true,
      scope: 'full',
    });
  });

  it('throws UnauthorizedException (not 404) when the subject no longer exists', async () => {
    // Arrange: deleted account still holding a valid access token
    usersService.findByIdOrNull.mockResolvedValue(null);

    // Act & Assert
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
    // Regression guard: must NOT leak the 404 that findById would throw,
    // which bypassed the client's token-refresh/logout recovery path.
    await expect(strategy.validate(payload)).rejects.not.toThrow(
      NotFoundException,
    );
  });
});
