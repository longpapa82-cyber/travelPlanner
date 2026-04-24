import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { SubscriptionStatus } from '../types';
import {
  initRevenueCat,
  logIn,
  logOut as rcLogOut,
  getCustomerInfo,
  addCustomerInfoUpdateListener,
  getActiveEntitlementSnapshot,
  ActiveEntitlementSnapshot,
} from '../services/revenueCat';
import { PREMIUM_ENABLED } from '../constants/config';
import { addBreadcrumb } from '../common/sentry';

const AI_TRIPS_FREE_LIMIT = 3;
/*
 * V115 (M3 fix): keep this list in sync with backend `ADMIN_EMAILS` env var.
 *
 * Why a frontend copy at all? The backend's /subscription/status returns an
 * `isAdmin` boolean that should be the single source of truth, but the UI
 * needs to make admin decisions before that round-trip completes (e.g. to
 * avoid flashing the paywall on cold-start). This fallback list covers the
 * first render; once the API response lands, `user.isAdmin` from the server
 * takes precedence.
 *
 * Must be lowercased — emails in the user profile may come back in any case
 * (the backend normalizes, but client-side we defend). Also includes
 * hoonjae723@gmail.com which was previously missing and caused V114-6a
 * (admin billing datetime) to silently no-op for that account.
 */
const ADMIN_EMAILS = [
  'longpapa82@gmail.com',
  'hoonjae723@gmail.com',
];
const SERVICE_ADMIN_EMAILS = ['longpapa82@gmail.com'];

export type PaywallContext = 'ai_limit' | 'general';

interface PremiumContextType {
  isPremium: boolean;
  subscriptionTier: 'free' | 'premium';
  aiTripsRemaining: number;
  aiTripsUsed: number;
  aiTripsLimit: number;
  isAiLimitReached: boolean;
  isAdmin: boolean;
  isServiceAdmin: boolean;
  expiresAt?: string;
  startedAt?: string;
  planType?: 'monthly' | 'yearly';
  platform?: string;
  isPaywallVisible: boolean;
  paywallContext: PaywallContext;
  showPaywall: (context?: PaywallContext) => void;
  hidePaywall: () => void;
  refreshStatus: () => Promise<void>;
  /**
   * V169: Mark premium locally after purchase (before backend webhook syncs).
   * Returns a promise because we re-query RevenueCat to pull an authoritative
   * snapshot of the purchased plan. Callers typically fire-and-forget.
   */
  markPremium: () => Promise<void>;
  /** Mark logout in progress to suppress ads during transition */
  markLoggingOut: () => void;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within PremiumProvider');
  }
  return context;
};

interface PremiumProviderProps {
  children: ReactNode;
}

/**
 * V169 (F2): Replacement for the boolean `localPremiumOverride`.
 *
 * We keep a snapshot of whatever RevenueCat told us, tagged with the *source*
 * that put it there. `source` is load-bearing: only trustworthy sources
 * (`purchase`, `listener`, `mount-restore`) flip `isPremium` to true in the
 * merge layer. `foreground-sync` is informational only — it must not
 * override a server that says FREE, because the RC local cache can be up to
 * five minutes stale (Google Play License Tester's 30-minute yearly cycle
 * is the canary for this).
 *
 * V155 invariant preserved: when the server confirms the subscription has
 * expired, the snapshot is cleared regardless of source.
 */
type RcEntitlementSource = 'purchase' | 'listener' | 'mount-restore' | 'foreground-sync';

interface RcEntitlementState extends ActiveEntitlementSnapshot {
  source: RcEntitlementSource;
  recordedAtMs: number;
}

export const PremiumProvider: React.FC<PremiumProviderProps> = ({ children }) => {
  const { user, refreshUser } = useAuth();
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [paywallContext, setPaywallContext] = useState<PaywallContext>('general');
  // V169 (F2): Replaces `localPremiumOverride: boolean`.
  const [rcEntitlement, setRcEntitlement] = useState<RcEntitlementState | null>(null);
  // Track logout state to suppress ads during transition
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // V169 (F5): stable ref for refreshUser so Sentry breadcrumbs and listener
  // callbacks don't go stale. AuthContext.refreshUser is not memoized.
  const refreshUserRef = useRef(refreshUser);
  useEffect(() => {
    refreshUserRef.current = refreshUser;
  }, [refreshUser]);

  const captureRcSnapshot = useCallback(
    (snapshot: ActiveEntitlementSnapshot | null, source: RcEntitlementSource) => {
      if (!snapshot) {
        // No active entitlement — only clear if the existing snapshot is from
        // a lower-trust source. A 'purchase' snapshot should survive a
        // momentary 'foreground-sync' miss (RC caches can return empty
        // briefly after network blips).
        setRcEntitlement((prev) => {
          if (!prev) return null;
          if (source === 'foreground-sync' && prev.source === 'purchase') {
            return prev;
          }
          return null;
        });
        return;
      }
      setRcEntitlement({
        ...snapshot,
        source,
        recordedAtMs: Date.now(),
      });
      addBreadcrumb({
        category: 'subscription',
        message: 'rc.snapshot.capture',
        data: {
          source,
          productIdentifier: snapshot.productIdentifier,
          planType: snapshot.planType,
          expiresAtMs: snapshot.expiresAtMs,
        },
      });
    },
    [],
  );

  // Initialize RevenueCat on native platforms when user is available
  // After init, check if user has active entitlements and sync premium status
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id) return;

    (async () => {
      await initRevenueCat(String(user.id));
      await logIn(String(user.id));

      try {
        let info = await getCustomerInfo();
        let snapshot = getActiveEntitlementSnapshot(info);

        // Re-login / reinstall case: RC hasn't linked the receipt yet.
        // Restore before falling back to "no subscription" so we don't
        // mis-classify a real subscriber as free.
        if (!snapshot) {
          const { restorePurchases } = await import('../services/revenueCat');
          const restored = await restorePurchases();
          const restoredSnapshot = getActiveEntitlementSnapshot(restored);
          if (restoredSnapshot) {
            snapshot = restoredSnapshot;
            info = restored;
          }
        }

        captureRcSnapshot(snapshot, 'mount-restore');

        // Always refresh server state so isPremium can reconcile
        refreshUserRef.current?.();
      } catch {
        // Silent — premium detection is best-effort
      }

      // Listen for purchase completions (handles app kill during payment flow)
      addCustomerInfoUpdateListener((updatedInfo) => {
        const snapshot = getActiveEntitlementSnapshot(updatedInfo);
        captureRcSnapshot(snapshot, 'listener');
        refreshUserRef.current?.();
      });
    })();
    // `captureRcSnapshot` is stable via useCallback; only re-run on user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // V165 + V169 (F3): Re-check RevenueCat AND refresh the server profile
  // when the app returns to foreground. Previously this only hit RC, so the
  // server profile stayed stale for up to 5 min — that's exactly the window
  // where V169's "subscription missing then suddenly appears" repro lives.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id) return;

    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        try {
          const info = await getCustomerInfo();
          const snapshot = getActiveEntitlementSnapshot(info);
          captureRcSnapshot(snapshot, 'foreground-sync');
        } catch {
          // Silent — RevenueCat check is best-effort
        }
        // V169 (F3): also pull the canonical server state. Without this the
        // server profile stays stale until next full auth cycle.
        refreshUserRef.current?.();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Clear snapshot + logout flag when the user logs out
  useEffect(() => {
    if (!user) {
      setRcEntitlement(null);
      setIsLoggingOut(false);
    }
  }, [user]);

  // V155 downgrade reconciliation (preserved): if the server reports the
  // subscription as expired or free, drop the local snapshot so RC's stale
  // cache can't keep premium alive.
  useEffect(() => {
    if (!rcEntitlement || !user) return;
    const serverExpired =
      user.subscriptionTier === 'free' ||
      (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date());
    if (serverExpired) {
      addBreadcrumb({
        category: 'subscription',
        message: 'rc.snapshot.server-downgrade',
        data: {
          source: rcEntitlement.source,
          serverTier: user.subscriptionTier,
          serverExpiresAt: user.subscriptionExpiresAt,
        },
      });
      setRcEntitlement(null);
    }
  }, [user?.subscriptionTier, user?.subscriptionExpiresAt, rcEntitlement]);

  const isPremium = useMemo(() => {
    // During logout, maintain premium to prevent ad flash
    if (isLoggingOut) return true;
    // V169 (F2): server is the highest-trust source. Always honor it.
    if (user?.subscriptionTier === 'premium') {
      if (!user.subscriptionExpiresAt) return true;
      if (new Date(user.subscriptionExpiresAt) >= new Date()) return true;
    }
    // Server says free or not-yet-loaded. RC snapshot can still grant
    // premium *only* if the source is trustworthy (actual purchase or
    // RC listener push). `foreground-sync` is intentionally excluded —
    // its stale cache was the root cause of V169 "갑자기 월간 결제" flips.
    if (rcEntitlement) {
      if (rcEntitlement.source === 'purchase' ||
          rcEntitlement.source === 'listener' ||
          rcEntitlement.source === 'mount-restore') {
        if (rcEntitlement.expiresAtMs === null || rcEntitlement.expiresAtMs > Date.now()) {
          return true;
        }
      }
    }
    return false;
  }, [user?.subscriptionTier, user?.subscriptionExpiresAt, rcEntitlement, isLoggingOut]);

  // V115 (M3 fix): lowercase both sides before compare. The old path
  // `ADMIN_EMAILS.includes(user.email)` silently failed for any profile that
  // arrived with a differently-cased email (e.g. "Hoonjae723@gmail.com").
  const isAdmin = !!(
    user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
  const isServiceAdmin = !!(
    user?.email && SERVICE_ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
  const isProfileLoaded = user?.aiTripsUsedThisMonth !== undefined;
  const aiTripsUsed = user?.aiTripsUsedThisMonth ?? 0;
  const AI_TRIPS_PREMIUM_LIMIT = 30;
  const aiTripsLimit = isPremium ? AI_TRIPS_PREMIUM_LIMIT : AI_TRIPS_FREE_LIMIT;
  const aiTripsRemaining = isPremium
    ? (isProfileLoaded ? Math.max(0, AI_TRIPS_PREMIUM_LIMIT - aiTripsUsed) : AI_TRIPS_PREMIUM_LIMIT)
    : (isProfileLoaded ? Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed) : -1);
  const isAiLimitReached = !isPremium && isProfileLoaded && aiTripsRemaining <= 0;

  const showPaywall = useCallback((context: PaywallContext = 'general') => {
    if (!PREMIUM_ENABLED) return;
    // V169 (F1): first-line guard against double-subscribe. The second-line
    // guard in PaywallModal.handlePurchase still runs (it hits RevenueCat
    // directly), but this prevents the paywall from even rendering when the
    // state layer already knows the user is subscribed.
    if (isPremium) return;
    setPaywallContext(context);
    setIsPaywallVisible(true);
  }, [isPremium]);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
  }, []);

  const refreshStatus = useCallback(async () => {
    await refreshUser();
  }, [refreshUser]);

  /**
   * V169 (F2): Called by PaywallModal immediately after a successful purchase.
   *
   * We re-query RevenueCat rather than synthesizing a snapshot from
   * selectedPlan, because the SDK's post-purchase CustomerInfo is
   * authoritative about which SKU was actually bought (plan switches and
   * Google Play cross-grades can mean the purchased package != what the
   * user originally selected).
   */
  const markPremium = useCallback(async () => {
    addBreadcrumb({
      category: 'subscription',
      message: 'paywall.purchase.success',
    });
    try {
      const info = await getCustomerInfo();
      const snapshot = getActiveEntitlementSnapshot(info);
      if (snapshot) {
        setRcEntitlement({
          ...snapshot,
          source: 'purchase',
          recordedAtMs: Date.now(),
        });
      }
    } catch {
      // If RC lookup fails, fall back to a best-effort snapshot so the UI
      // still reflects the purchase. Expiry is unknown, so treat as "active
      // with no known expiry" (null) — V155 downgrade reconciliation will
      // clean this up when the server eventually reports expiry.
      setRcEntitlement({
        productIdentifier: '',
        planType: undefined,
        expiresAtMs: null,
        source: 'purchase',
        recordedAtMs: Date.now(),
      });
    }
  }, []);

  const markLoggingOut = useCallback(() => {
    setIsLoggingOut(true);
  }, []);

  // V169 (F2): prefer server metadata (canonical), but fall back to the RC
  // snapshot while the server webhook is still propagating. This closes the
  // gap where a fresh subscriber saw `planType=undefined` in the UI until
  // the RevenueCat → backend webhook round-trip completed.
  const expiresAt =
    user?.subscriptionExpiresAt ??
    (rcEntitlement?.expiresAtMs
      ? new Date(rcEntitlement.expiresAtMs).toISOString()
      : undefined);
  const planType = user?.subscriptionPlanType ?? rcEntitlement?.planType;

  const value = useMemo<PremiumContextType>(() => ({
    isPremium,
    isAdmin,
    isServiceAdmin,
    subscriptionTier: isPremium ? 'premium' : 'free',
    aiTripsRemaining,
    aiTripsUsed,
    aiTripsLimit,
    isAiLimitReached,
    expiresAt,
    startedAt: user?.subscriptionStartedAt,
    planType,
    platform: user?.subscriptionPlatform,
    isPaywallVisible,
    paywallContext,
    showPaywall,
    hidePaywall,
    refreshStatus,
    markPremium,
    markLoggingOut,
  }), [isPremium, isAdmin, isServiceAdmin, aiTripsRemaining, aiTripsUsed, aiTripsLimit, isAiLimitReached, expiresAt, user?.subscriptionStartedAt, planType, user?.subscriptionPlatform, isPaywallVisible, paywallContext, showPaywall, hidePaywall, refreshStatus, markPremium, markLoggingOut]);

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};
