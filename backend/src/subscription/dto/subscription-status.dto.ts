import {
  SubscriptionPlatform,
  SubscriptionTier,
} from '../../users/entities/user.entity';

/**
 * Response shape returned by GET /subscription/status.
 *
 * `aiTripsLimit` is always a real number (free=3, premium=30 by default).
 * The legacy `-1` sentinel has been removed so the frontend can render a
 * uniform "remaining/total" label without hardcoded fallbacks. See
 * `subscription/constants.ts` for the source of truth values.
 */
export interface SubscriptionStatusDto {
  tier: SubscriptionTier;
  isPremium: boolean;
  isAdmin: boolean;
  platform?: SubscriptionPlatform;
  expiresAt?: Date;
  startedAt?: Date;
  planType?: 'monthly' | 'yearly';
  aiTripsUsed: number;
  aiTripsLimit: number;
  aiTripsRemaining: number;
  /**
   * True when the active subscription was created by a Google Play License
   * Tester and uses accelerated cycles (yearly plans cycling every ~30 min).
   * Frontend uses this to display a "(테스트 구매)" badge without masking
   * the real stored timestamps.
   */
  isSandbox: boolean;
}
