import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { SubscriptionStatus } from '../types';
import { initRevenueCat, logIn, logOut as rcLogOut, getCustomerInfo, addCustomerInfoUpdateListener } from '../services/revenueCat';
import { PREMIUM_ENABLED } from '../constants/config';

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
  /** Mark premium locally after purchase (before backend webhook syncs) */
  markPremium: () => void;
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

export const PremiumProvider: React.FC<PremiumProviderProps> = ({ children }) => {
  const { user, refreshUser } = useAuth();
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [paywallContext, setPaywallContext] = useState<PaywallContext>('general');
  // Local premium override: set immediately after purchase, before backend syncs
  const [localPremiumOverride, setLocalPremiumOverride] = useState(false);
  // Track logout state to suppress ads during transition
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize RevenueCat on native platforms when user is available
  // After init, check if user has active entitlements and sync premium status
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id) return;

    (async () => {
      await initRevenueCat(String(user.id));
      await logIn(String(user.id));

      // Check RevenueCat for active subscriptions and override if needed
      try {
        let info = await getCustomerInfo();
        let hasActiveEntitlement = info?.entitlements?.active &&
          Object.keys(info.entitlements.active).length > 0;

        // If no active entitlement found, try restoring purchases
        // This handles re-login scenarios where subscription data may not be linked yet
        if (!hasActiveEntitlement) {
          const { restorePurchases } = await import('../services/revenueCat');
          const restored = await restorePurchases();
          if (restored?.entitlements?.active && Object.keys(restored.entitlements.active).length > 0) {
            hasActiveEntitlement = true;
            info = restored;
          }
        }

        if (hasActiveEntitlement && !localPremiumOverride) {
          setLocalPremiumOverride(true);
          refreshUser?.();
        }
      } catch {
        // Silent — premium detection is best-effort
      }

      // Listen for purchase completions (handles app kill during payment flow)
      addCustomerInfoUpdateListener((updatedInfo) => {
        const hasActive = updatedInfo?.entitlements?.active &&
          Object.keys(updatedInfo.entitlements.active).length > 0;
        if (hasActive && !localPremiumOverride) {
          setLocalPremiumOverride(true);
          refreshUser?.();
        }
      });
    })();
  }, [user?.id]);

  // Clear local premium override and logout state when user changes
  useEffect(() => {
    if (!user) {
      setLocalPremiumOverride(false);
      setIsLoggingOut(false);
    }
  }, [user]);

  const isPremium = useMemo(() => {
    // During logout, maintain premium to prevent ad flash
    if (isLoggingOut) return true;
    // Local override from recent purchase (before backend webhook arrives)
    if (localPremiumOverride) return true;
    if (!user?.subscriptionTier) return false;
    if (user.subscriptionTier !== 'premium') return false;
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) return false;
    return true;
  }, [user?.subscriptionTier, user?.subscriptionExpiresAt, localPremiumOverride, isLoggingOut]);

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
  const isAiLimitReached = !isPremium && !isAdmin && isProfileLoaded && aiTripsRemaining <= 0;

  const showPaywall = useCallback((context: PaywallContext = 'general') => {
    if (!PREMIUM_ENABLED) return;
    setPaywallContext(context);
    setIsPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
  }, []);

  const refreshStatus = useCallback(async () => {
    await refreshUser();
  }, [refreshUser]);

  const markPremium = useCallback(() => {
    setLocalPremiumOverride(true);
  }, []);

  const markLoggingOut = useCallback(() => {
    setIsLoggingOut(true);
  }, []);

  const value = useMemo<PremiumContextType>(() => ({
    isPremium,
    isAdmin,
    isServiceAdmin,
    subscriptionTier: isPremium ? 'premium' : 'free',
    aiTripsRemaining,
    aiTripsUsed,
    aiTripsLimit,
    isAiLimitReached,
    expiresAt: user?.subscriptionExpiresAt,
    startedAt: user?.subscriptionStartedAt,
    planType: user?.subscriptionPlanType,
    platform: user?.subscriptionPlatform,
    isPaywallVisible,
    paywallContext,
    showPaywall,
    hidePaywall,
    refreshStatus,
    markPremium,
    markLoggingOut,
  }), [isPremium, isAdmin, isServiceAdmin, aiTripsRemaining, aiTripsUsed, aiTripsLimit, isAiLimitReached, user?.subscriptionExpiresAt, user?.subscriptionStartedAt, user?.subscriptionPlanType, user?.subscriptionPlatform, isPaywallVisible, paywallContext, showPaywall, hidePaywall, refreshStatus, markPremium, markLoggingOut]);

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};
