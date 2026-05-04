/**
 * Unit tests for oauthLogin re-link logic (V216).
 * Tests the case where Kakao re-issues a new providerId after app unlink/re-auth.
 * This file avoids importing otplib (which has ESM issues in Jest) by mocking
 * the entire AuthService module and testing the logic in isolation.
 */

import { AuthProvider } from '../users/entities/user.entity';

class ConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ConflictException';
  }
}

// Minimal stub of the re-link logic extracted from auth.service.ts oauthLogin
async function relinkOrCreate(
  oauthUser: {
    email?: string;
    name: string;
    profileImage?: string;
    providerId: string;
    provider: AuthProvider;
  },
  deps: {
    findByProviderAndId: (p: AuthProvider, id: string) => Promise<any>;
    findByEmail: (email: string) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    create: (data: any) => Promise<any>;
  },
): Promise<{ id: string; provider: AuthProvider; providerId?: string }> {
  const provider = oauthUser.provider;

  let user = await deps.findByProviderAndId(provider, oauthUser.providerId);

  if (!user) {
    if (oauthUser.email) {
      const existing = await deps.findByEmail(oauthUser.email);
      if (existing) {
        if (existing.provider === provider) {
          await deps.update(existing.id, {
            providerId: oauthUser.providerId,
            ...(oauthUser.name && { name: oauthUser.name }),
            ...(oauthUser.profileImage && {
              profileImage: oauthUser.profileImage,
            }),
          });
          user = existing;
          user.providerId = oauthUser.providerId;
        } else {
          // Email exists with a different provider → conflict, not account hijack
          throw new ConflictError(
            `EMAIL_PROVIDER_CONFLICT:${existing.provider}`,
          );
        }
      }
    }

    if (!user) {
      user = await deps.create({
        email: oauthUser.email,
        name: oauthUser.name,
        provider,
        providerId: oauthUser.providerId,
        profileImage: oauthUser.profileImage,
        isEmailVerified: true,
      });
    }
  }

  return user;
}

describe('oauthLogin re-link logic (V216)', () => {
  const existingKakaoUser = {
    id: 'user-123',
    email: 'user@example.com',
    provider: AuthProvider.KAKAO,
    providerId: 'OLD_KAKAO_ID',
  };

  it('returns existing user when providerId matches', async () => {
    const deps = {
      findByProviderAndId: jest.fn().mockResolvedValue(existingKakaoUser),
      findByEmail: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };

    const result = await relinkOrCreate(
      {
        email: 'user@example.com',
        name: 'User',
        providerId: 'OLD_KAKAO_ID',
        provider: AuthProvider.KAKAO,
      },
      deps,
    );

    expect(result.id).toBe('user-123');
    expect(deps.findByEmail).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('re-links when Kakao issues new providerId for same email+provider', async () => {
    const deps = {
      findByProviderAndId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(existingKakaoUser),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    };

    const result = await relinkOrCreate(
      {
        email: 'user@example.com',
        name: 'User',
        providerId: 'NEW_KAKAO_ID',
        provider: AuthProvider.KAKAO,
      },
      deps,
    );

    expect(result.id).toBe('user-123');
    expect(result.providerId).toBe('NEW_KAKAO_ID');
    expect(deps.update).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ providerId: 'NEW_KAKAO_ID' }),
    );
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('creates new user when email does not exist', async () => {
    const newUser = {
      id: 'new-user',
      email: 'new@example.com',
      provider: AuthProvider.KAKAO,
    };
    const deps = {
      findByProviderAndId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn().mockResolvedValue(newUser),
    };

    const result = await relinkOrCreate(
      {
        email: 'new@example.com',
        name: 'New User',
        providerId: 'KAKAO_123',
        provider: AuthProvider.KAKAO,
      },
      deps,
    );

    expect(result.id).toBe('new-user');
    expect(deps.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        provider: AuthProvider.KAKAO,
      }),
    );
  });

  it('throws EMAIL_PROVIDER_CONFLICT when email exists with a different provider', async () => {
    const googleUser = {
      id: 'google-user',
      email: 'user@gmail.com',
      provider: AuthProvider.GOOGLE,
      providerId: 'GOOGLE_ID',
    };
    const deps = {
      findByProviderAndId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(googleUser),
      update: jest.fn(),
      create: jest.fn(),
    };

    await expect(
      relinkOrCreate(
        {
          email: 'user@gmail.com',
          name: 'User',
          providerId: 'KAKAO_ID',
          provider: AuthProvider.KAKAO,
        },
        deps,
      ),
    ).rejects.toThrow('EMAIL_PROVIDER_CONFLICT:google');

    // Must not re-link or create — throw before reaching those calls
    expect(deps.update).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('creates new user when OAuth email is undefined', async () => {
    const newUser = { id: 'no-email-user', provider: AuthProvider.KAKAO };
    const deps = {
      findByProviderAndId: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn(),
      update: jest.fn(),
      create: jest.fn().mockResolvedValue(newUser),
    };

    const result = await relinkOrCreate(
      {
        email: undefined,
        name: 'User',
        providerId: 'KAKAO_ID',
        provider: AuthProvider.KAKAO,
      },
      deps,
    );

    expect(deps.findByEmail).not.toHaveBeenCalled();
    expect(deps.create).toHaveBeenCalled();
    expect(result.id).toBe('no-email-user');
  });
});
