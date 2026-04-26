/**
 * V187 P1-A — preflight + webhook idempotency regression test.
 *
 * Pins the V187 P0-B and P0-D fixes:
 *
 *   P0-B (Invariants 32 + 43): admin must NOT be blocked at preflight.
 *         V186 introduced an `isOperationalAdmin` early-return that
 *         resurrected the V183 "admin payment unresponsive" bug
 *         server-side. Single-flag overload is forbidden — admin status
 *         governs quota/ad-suppression, NOT payment entry. Real charging
 *         is gated by Google Play license tester registration (single
 *         responsibility, single guard).
 *
 *   P0-D (Invariant 40 강화): idempotency table failure must throw 5xx,
 *         not silently fall through. The V186 catch block downgraded
 *         transient DB errors into a permanent dedup bypass — every
 *         retry that hit a hiccup re-applied the entitlement.
 *
 * Both regressions shipped at least once because no test pinned the
 * intent. This file is the closure.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SubscriptionService } from './subscription.service';
import {
  User,
  SubscriptionTier,
  UserRole,
} from '../users/entities/user.entity';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';

describe('SubscriptionService — V187 P1-A regression pins', () => {
  let service: SubscriptionService;
  let userRepo: jest.Mocked<Repository<User>>;
  let processedRepo: { createQueryBuilder: jest.Mock };

  const baseUser: Partial<User> = {
    id: 'user-1',
    email: 'free@example.com',
    role: UserRole.USER,
    subscriptionTier: SubscriptionTier.FREE,
    subscriptionPlanType: undefined,
    subscriptionExpiresAt: undefined,
  };

  beforeEach(async () => {
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
    processedRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(insertChain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProcessedWebhookEvent),
          useValue: processedRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => {
              if (k === 'AI_TRIPS_FREE_LIMIT') return '3';
              if (k === 'AI_TRIPS_PREMIUM_LIMIT') return '30';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(SubscriptionService);
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('preflightPurchase — P0-B (V184 invariant 32 server-side)', () => {
    it('admin user (free tier) MUST be allowed to enter the purchase flow', async () => {
      // Admin email pattern matched by `isOperationalAdmin`. The exact
      // emails are env-driven, so we set the env for the duration of the
      // test to make the result deterministic.
      const original = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = 'admin@example.com';
      try {
        userRepo.findOne.mockResolvedValue({
          ...baseUser,
          email: 'admin@example.com',
        } as User);

        const result = await service.preflightPurchase('user-1');

        // The V186 regression returned canPurchase=false for admins.
        // V187 restores the V184 invariant 32 contract.
        expect(result.canPurchase).toBe(true);
        expect(result.reason).toBe('free_tier');
      } finally {
        process.env.ADMIN_EMAILS = original;
      }
    });

    it('free non-admin user is allowed', async () => {
      userRepo.findOne.mockResolvedValue(baseUser as User);
      const result = await service.preflightPurchase('user-1');
      expect(result.canPurchase).toBe(true);
      expect(result.reason).toBe('free_tier');
    });

    it('premium user is blocked with currentPlan populated (no double charge)', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        subscriptionTier: SubscriptionTier.PREMIUM,
        subscriptionPlanType: 'yearly',
      } as User);
      const result = await service.preflightPurchase('user-1');
      expect(result.canPurchase).toBe(false);
      expect(result.reason).toBe('already_subscribed');
      expect(result.currentPlan).toBe('yearly');
    });

    it('unknown user is blocked', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.preflightPurchase('ghost');
      expect(result.canPurchase).toBe(false);
      expect(result.reason).toBe('user_not_found');
    });
  });

  describe('handleRevenueCatEvent — P0-D (Invariant 40 atomic idempotency)', () => {
    it('throws 5xx when the dedup INSERT itself fails (RC will retry)', async () => {
      // V186 catch block silently fell through here, defeating dedup.
      // V187 raises so RevenueCat retries the webhook.
      const chain = processedRepo.createQueryBuilder();
      chain.execute.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.handleRevenueCatEvent({
          id: 'evt_123',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user-1',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('skips when ON CONFLICT yields zero inserted rows (duplicate event)', async () => {
      const chain = processedRepo.createQueryBuilder();
      // Empty array = ON CONFLICT path took effect.
      chain.execute.mockResolvedValue({ raw: [] });

      // userRepo.findOne returns null so any downstream work would
      // fail loudly — but the duplicate-event short-circuit must
      // prevent that path entirely.
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleRevenueCatEvent({
          id: 'evt_dup',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user-1',
        }),
      ).resolves.toBeUndefined();

      // findOne must NOT have been called — short-circuit fired first.
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('handles pg driver returning {rowCount} instead of an array', async () => {
      // TypeORM 0.3 + some pg configurations return `{ rowCount }`
      // instead of `[]`. The V187 raw-shape check must accept both.
      const chain = processedRepo.createQueryBuilder();
      chain.execute.mockResolvedValue({ raw: { rowCount: 0 } });
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.handleRevenueCatEvent({
          id: 'evt_alt_driver',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user-1',
        }),
      ).resolves.toBeUndefined();
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
