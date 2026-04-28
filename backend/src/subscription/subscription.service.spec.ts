/**
 * V187 P1-A — preflight + webhook idempotency regression test.
 * V196       — TRANSFER event handling + userId backfill regression test.
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
 * Pins the V196 (Invariant 48) fix:
 *
 *   TRANSFER event: RC fires this when a purchase moves from one
 *         appUserID to another — 탈퇴→재가입 scenario. Before V196
 *         the handler fell into `default:log`, leaving the entitlement
 *         bound to the old anonymous alias. The 7th phantom-subscription
 *         recurrence (hoonjae723) was the smoking gun.
 *
 *   userId backfill: processedWebhookEvent rows were inserted with
 *         userId=null because the user lookup happens after the INSERT.
 *         V196 adds a follow-up UPDATE once user.id is known.
 *
 * Both V196 regressions shipped because no test pinned the intent.
 * This file is the closure for both.
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

  // Separate mocks for INSERT vs UPDATE chains so tests can verify each.
  let insertChainExecute: jest.Mock;
  let updateChainExecute: jest.Mock;

  const baseUser: Partial<User> = {
    id: 'user-1',
    email: 'free@example.com',
    role: UserRole.USER,
    subscriptionTier: SubscriptionTier.FREE,
    subscriptionPlanType: undefined,
    subscriptionExpiresAt: undefined,
  };

  beforeEach(async () => {
    insertChainExecute = jest.fn();
    updateChainExecute = jest.fn().mockResolvedValue({ affected: 1 });

    // Each call to createQueryBuilder() returns a full chain object that
    // supports BOTH insert AND update operations. The service uses .insert()
    // for the dedup row and .update() for the userId backfill. Having both
    // methods on a single chain object avoids call-count ordering issues.
    const makeChain = (executeImpl: jest.Mock) => ({
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: executeImpl,
    });

    // First call = dedup INSERT; second call = userId backfill UPDATE.
    processedRepo = {
      createQueryBuilder: jest
        .fn()
        .mockImplementationOnce(() => makeChain(insertChainExecute))
        .mockImplementation(() => makeChain(updateChainExecute)),
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
      insertChainExecute.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.handleRevenueCatEvent({
          id: 'evt_123',
          type: 'INITIAL_PURCHASE',
          app_user_id: 'user-1',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('skips when ON CONFLICT yields zero inserted rows (duplicate event)', async () => {
      // Empty array = ON CONFLICT path took effect.
      insertChainExecute.mockResolvedValue({ raw: [] });

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
      // TypeORM 0.3 + some pg configurations return `{ rowCount: 0 }`
      // instead of `[]`. The V187 raw-shape check must accept both.
      insertChainExecute.mockResolvedValue({ raw: { rowCount: 0 } });
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

  describe('handleRevenueCatEvent — V197 (Invariant 49) TRANSFER via transferred_to + userId backfill', () => {
    // V197 root cause: RC TRANSFER events have no app_user_id field.
    // They use transferred_to (array of new RC appUserIds) instead.
    // V196 fix added a TRANSFER case inside the switch but it was gated
    // behind the app_user_id null-check, so it was never reached.

    it('TRANSFER with active entitlement: resolves user via transferred_to rcId and sets premium', async () => {
      // V197: TRANSFER has no app_user_id; uses transferred_to array.
      // RC uses a custom rcId as appUserId. We find the user by matching
      // revenuecatAppUserId in DB (createQueryBuilder path).
      const futureMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      insertChainExecute.mockResolvedValue({ raw: [{}] });

      const newUser = { ...baseUser } as User;

      // userRepo.createQueryBuilder → hit by revenuecatAppUserId match
      (userRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(newUser),
      });

      await service.handleRevenueCatEvent({
        id: 'evt_transfer_v197',
        type: 'TRANSFER',
        transferred_to: ['new-rc-app-user-id'],
        transferred_from: ['old-anon-rc-id'],
        product_id: 'premium_yearly',
        expiration_at_ms: String(futureMs),
      });

      expect(userRepo.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ subscriptionTier: SubscriptionTier.PREMIUM }),
      );
    });

    it('TRANSFER with expired entitlement: downgrades receiving user to FREE', async () => {
      const pastMs = Date.now() - 60 * 1000;
      insertChainExecute.mockResolvedValue({ raw: [{}] });

      const freeUser = { ...baseUser } as User;
      (userRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(freeUser),
      });

      await service.handleRevenueCatEvent({
        id: 'evt_transfer_expired_v197',
        type: 'TRANSFER',
        transferred_to: ['new-rc-app-user-id-2'],
        transferred_from: ['old-anon-rc-id-2'],
        product_id: 'premium_monthly',
        expiration_at_ms: String(pastMs),
      });

      expect(userRepo.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ subscriptionTier: SubscriptionTier.FREE }),
      );
    });

    it('TRANSFER with no transferred_to: logs warning and does not call update', async () => {
      insertChainExecute.mockResolvedValue({ raw: [{}] });

      await service.handleRevenueCatEvent({
        id: 'evt_transfer_no_target',
        type: 'TRANSFER',
        transferred_to: [],
        transferred_from: ['old-id'],
      });

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('userId backfill UPDATE is called after successful event processing', async () => {
      // V196: processed_webhook_events.userId was permanently NULL before
      // this fix because the INSERT happened before the user lookup.
      // The follow-up UPDATE must be called for every successfully processed
      // event that has an event ID.
      insertChainExecute.mockResolvedValue({ raw: [{}] }); // new row inserted

      const user = { ...baseUser } as User;
      (userRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      });

      await service.handleRevenueCatEvent({
        id: 'evt_backfill_check',
        type: 'EXPIRATION',
        app_user_id: 'user-1',
      });

      // The second createQueryBuilder call is the UPDATE backfill
      expect(processedRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
      expect(updateChainExecute).toHaveBeenCalled();
    });

    it('userId backfill is skipped when event has no id', async () => {
      // Events without an id skip dedup entirely and therefore there is
      // no idempotency row to backfill — the UPDATE must not be attempted.
      const user = { ...baseUser } as User;
      (userRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      });

      await service.handleRevenueCatEvent({
        // No `id` field — malformed/test payload
        type: 'EXPIRATION',
        app_user_id: 'user-1',
      });

      // Only the user lookup createQueryBuilder was called; no dedup calls.
      expect(processedRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(updateChainExecute).not.toHaveBeenCalled();
    });
  });
});
