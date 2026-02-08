import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, AuthProvider } from './entities/user.entity';

// Mock bcrypt
jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    provider: AuthProvider.EMAIL,
    providerId: null,
    profileImage: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    trips: [],
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));

    // Reset bcrypt mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with email and password', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        password: 'PlainPassword123!',
        name: 'New User',
        provider: AuthProvider.EMAIL,
      };

      const hashedPassword = 'hashed-PlainPassword123!';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const createdUser = {
        ...mockUser,
        email: userData.email,
        name: userData.name,
        passwordHash: hashedPassword,
      };

      repository.create.mockReturnValue(createdUser);
      repository.save.mockResolvedValue(createdUser);

      // Act
      const result = await service.create(userData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(repository.create).toHaveBeenCalledWith({
        email: userData.email,
        passwordHash: hashedPassword,
        name: userData.name,
        provider: AuthProvider.EMAIL,
        providerId: undefined,
        profileImage: undefined,
      });
      expect(repository.save).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });

    it('should create a new OAuth user without password', async () => {
      // Arrange
      const oauthData = {
        email: 'oauth@example.com',
        name: 'OAuth User',
        provider: AuthProvider.GOOGLE,
        providerId: 'google-123',
        profileImage: 'https://example.com/image.jpg',
      };

      const createdUser = {
        ...mockUser,
        ...oauthData,
        passwordHash: null,
      };

      repository.create.mockReturnValue(createdUser as any);
      repository.save.mockResolvedValue(createdUser as any);

      // Act
      const result = await service.create(oauthData);

      // Assert
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith({
        email: oauthData.email,
        passwordHash: undefined,
        name: oauthData.name,
        provider: AuthProvider.GOOGLE,
        providerId: oauthData.providerId,
        profileImage: oauthData.profileImage,
      });
      expect(result.passwordHash).toBeNull();
    });

    it('should hash password with bcrypt salt rounds of 10', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword',
        name: 'Test',
        provider: AuthProvider.EMAIL,
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      repository.create.mockReturnValue(mockUser);
      repository.save.mockResolvedValue(mockUser);

      // Act
      await service.create(userData);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith('TestPassword', 10);
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(mockUser.id);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      const userId = 'non-existent-id';
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      await expect(service.findById(userId)).rejects.toThrow(
        `User with ID ${userId} not found`,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user if found by email', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmail(mockUser.email!);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle email case sensitivity', async () => {
      // Arrange
      const email = 'Test@Example.COM';
      repository.findOne.mockResolvedValue(mockUser);

      // Act
      await service.findByEmail(email);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
    });
  });

  describe('findByProviderAndId', () => {
    it('should return user if found by provider and providerId', async () => {
      // Arrange
      const googleUser = {
        ...mockUser,
        provider: AuthProvider.GOOGLE,
        providerId: 'google-123',
      };
      repository.findOne.mockResolvedValue(googleUser);

      // Act
      const result = await service.findByProviderAndId(
        AuthProvider.GOOGLE,
        'google-123',
      );

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { provider: AuthProvider.GOOGLE, providerId: 'google-123' },
      });
      expect(result).toEqual(googleUser);
    });

    it('should return null if user not found', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByProviderAndId(
        AuthProvider.APPLE,
        'apple-456',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should work with all OAuth providers', async () => {
      // Test all providers
      const providers = [AuthProvider.GOOGLE, AuthProvider.APPLE, AuthProvider.KAKAO];

      for (const provider of providers) {
        repository.findOne.mockResolvedValue({
          ...mockUser,
          provider,
          providerId: `${provider.toLowerCase()}-id`,
        });

        const result = await service.findByProviderAndId(
          provider,
          `${provider.toLowerCase()}-id`,
        );

        expect(result?.provider).toBe(provider);
      }
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      // Arrange
      const password = 'CorrectPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.validatePassword(mockUser, password);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(
        password,
        mockUser.passwordHash,
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      // Arrange
      const password = 'WrongPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await service.validatePassword(mockUser, password);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(
        password,
        mockUser.passwordHash,
      );
      expect(result).toBe(false);
    });

    it('should return false if user has no password hash (OAuth user)', async () => {
      // Arrange
      const oauthUser = { ...mockUser, passwordHash: null };

      // Act
      const result = await service.validatePassword(oauthUser as any, 'anypassword');

      // Assert
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should handle bcrypt comparison errors gracefully', async () => {
      // Arrange
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Bcrypt error'),
      );

      // Act & Assert
      await expect(
        service.validatePassword(mockUser, 'password'),
      ).rejects.toThrow('Bcrypt error');
    });
  });

  describe('update', () => {
    it('should update user and return updated user', async () => {
      // Arrange
      const userId = mockUser.id;
      const updateData = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };

      repository.update.mockResolvedValue(undefined as any);
      repository.findOne.mockResolvedValue(updatedUser);

      // Act
      const result = await service.update(userId, updateData);

      // Assert
      expect(repository.update).toHaveBeenCalledWith(userId, updateData);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException if user not found after update', async () => {
      // Arrange
      const userId = 'non-existent-id';
      repository.update.mockResolvedValue(undefined as any);
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(userId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow partial updates', async () => {
      // Arrange
      const userId = mockUser.id;
      const partialUpdate = { profileImage: 'https://new-image.jpg' };

      repository.update.mockResolvedValue(undefined as any);
      repository.findOne.mockResolvedValue({
        ...mockUser,
        ...partialUpdate,
      });

      // Act
      const result = await service.update(userId, partialUpdate);

      // Assert
      expect(repository.update).toHaveBeenCalledWith(userId, partialUpdate);
      expect(result.profileImage).toBe(partialUpdate.profileImage);
    });
  });

  describe('remove', () => {
    it('should delete user', async () => {
      // Arrange
      const userId = mockUser.id;
      repository.delete.mockResolvedValue(undefined as any);

      // Act
      await service.remove(userId);

      // Assert
      expect(repository.delete).toHaveBeenCalledWith(userId);
    });

    it('should not throw error if user does not exist', async () => {
      // Arrange
      repository.delete.mockResolvedValue({ affected: 0 } as any);

      // Act & Assert
      await expect(service.remove('non-existent-id')).resolves.not.toThrow();
    });
  });
});
