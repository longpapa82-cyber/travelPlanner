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
 * V176: server isAdmin is now the single source of truth. The previous
 * frontend ADMIN_EMAILS fallback (V115/V114-6a) caused an Alpha-test
 * observation bias — both Alpha test accounts were on the fallback list, so
 * the QA team could not validate the non-admin (free/premium) quota path.
 * Removing the fallback aligns frontend with the V174 backend isAdmin field
 * already returned by /auth/me.
 *
 * SERVICE_ADMIN_EMAILS is kept for the security-admin-only screens (revenue
 * dashboard, manual subscription override). Service admin is a stricter
 * subset of operational admin — it gates the financial controls and is
 * intentionally not derived from the env list.
 */
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

  // V180 (Issue 1, defense-in-depth): when the active user *changes*
  // (delete + re-register on the same device, or account switch), wipe the
  // previous RC snapshot before any new mount-restore can land. Without
  // this, the stale entitlement from the previous identity remained in
  // state long enough for `mount-restore` to be classified as trustworthy
  // and grant phantom premium to the new account.
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentId = user?.id;
    if (prevUserIdRef.current && currentId && prevUserIdRef.current !== currentId) {
      addBreadcrumb({
        category: 'subscription',
        message: 'rc.snapshot.user-changed',
        data: { from: prevUserIdRef.current, to: currentId },
      });
      setRcEntitlement(null);
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

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
    // V180 (Issue 1): `mount-restore` is now gated on the server having
    // explicitly told us this user is premium. This closes the V179
    // "탈퇴-재가입 phantom 구독" path — when register lands the server
    // returns subscriptionTier='free', so even if RC SDK still has stale
    // entitlement from the previous identity, mount-restore cannot grant
    // premium to a fresh account.
    if (rcEntitlement) {
      if (rcEntitlement.source === 'purchase' ||
          rcEntitlement.source === 'listener') {
        if (rcEntitlement.expiresAtMs === null || rcEntitlement.expiresAtMs > Date.now()) {
          return true;
        }
      }
      if (rcEntitlement.source === 'mount-restore' &&
          user?.subscriptionTier === 'premium') {
        if (rcEntitlement.expiresAtMs === null || rcEntitlement.expiresAtMs > Date.now()) {
          return true;
        }
      }
    }
    return false;
  }, [user?.subscriptionTier, user?.subscriptionExpiresAt, rcEntitlement, isLoggingOut]);

  // V176: server `isAdmin` (computed via isOperationalAdmin on the backend)
  // is the only source of truth. The local fallback list was removed because
  // it caused all Alpha test accounts to be classified as admin, hiding the
  // non-admin quota path from QA. The brief flash window before /auth/me
  // lands is harmless — the paywall and aiTripsLimit UI gate on
  // isProfileLoaded, so admins see neutral state during cold start.
  const isAdmin = user?.isAdmin === true;
  const isServiceAdmin = !!(
    user?.email && SERVICE_ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
  const isProfileLoaded = user?.aiTripsUsedThisMonth !== undefined;
  const aiTripsUsed = user?.aiTripsUsedThisMonth ?? 0;
  const AI_TRIPS_PREMIUM_LIMIT = 30;
  // V174 (P0-2): sentinel value for "unlimited" — used by admin accounts.
  // We use a big finite number rather than Infinity so JSON serialization,
  // Number formatting in i18n, and progress bars all behave deterministically.
  const AI_TRIPS_ADMIN_LIMIT = 9999;
  // V174 (P0-2): admin users bypass the quota entirely on the backend
  // (`trips.service.ts` never increments `aiTripsUsedThisMonth` for them),
  // so the V173 UI showing "3/3" (free) while the server allows unlimited
  // generations created a dangerous mismatch — users saw "limit reached"
  // but refresh showed the counter never moved. Explicit branch fixes this.
  const aiTripsLimit = isAdmin
    ? AI_TRIPS_ADMIN_LIMIT
    : isPremium
      ? AI_TRIPS_PREMIUM_LIMIT
      : AI_TRIPS_FREE_LIMIT;
  const aiTripsRemaining = isAdmin
    ? AI_TRIPS_ADMIN_LIMIT
    : isPremium
      ? (isProfileLoaded ? Math.max(0, AI_TRIPS_PREMIUM_LIMIT - aiTripsUsed) : AI_TRIPS_PREMIUM_LIMIT)
      : (isProfileLoaded ? Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed) : -1);
  // Admins never hit the limit — backend also doesn't enforce one for them.
  const isAiLimitReached = !isAdmin && !isPremium && isProfileLoaded && aiTripsRemaining <= 0;

  const showPaywall = useCallback((context: PaywallContext = 'general') => {
    if (!PREMIUM_ENABLED) return;
    // V169 (F1): first-line guard against double-subscribe. The second-line
    // guard in PaywallModal.handlePurchase still runs (it hits RevenueCat
    // directly), but this prevents the paywall from even rendering when the
    // state layer already knows the user is subscribed.
    if (isPremium) return;
    // V184 (Invariant 32): admin accounts MUST be able to enter the paywall
    // for end-to-end payment regression verification. The V182 `if (isAdmin)
    // return` guard was a direct cause of the V183 "buttons do nothing" bug
    // — alpha admins (longpapa82, hoonjae723) couldn't reproduce phantom
    // subscriptions or test new payment flows. The real phantom-subscription
    // defense is the server-tier authoritative gate at PaywallModal:147,
    // which rejects RC SDK stale entitlements regardless of who initiated
    // the purchase. Real money is not at risk because Play Console license
    // tester registration prevents actual charging for these accounts.
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
