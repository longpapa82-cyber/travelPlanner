import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { SubscriptionStatus } from '../types';
import { initRevenueCat, logIn, logOut as rcLogOut, getCustomerInfo } from '../services/revenueCat';
import { PREMIUM_ENABLED } from '../constants/config';

const AI_TRIPS_FREE_LIMIT = 3;
const ADMIN_EMAILS = ['a090723@naver.com', 'longpapa82@gmail.com'];

export type PaywallContext = 'ai_limit' | 'general';

interface PremiumContextType {
  isPremium: boolean;
  subscriptionTier: 'free' | 'premium';
  aiTripsRemaining: number;
  aiTripsUsed: number;
  aiTripsLimit: number;
  isAiLimitReached: boolean;
  isAdmin: boolean;
  expiresAt?: string;
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
        const info = await getCustomerInfo();
        const hasActiveEntitlement = info?.entitlements?.active &&
          Object.keys(info.entitlements.active).length > 0;
        if (hasActiveEntitlement && !localPremiumOverride) {
          setLocalPremiumOverride(true);
          // Also refresh backend user data to sync subscription status
          refreshUser?.();
        }
      } catch {
        // Silent — premium detection is best-effort
      }
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

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));
  // Use actual server value; default to 0 (not used) when profile is loaded with aiTripsUsedThisMonth present
  // Only show limit reached when we have confirmed data from the server
  const aiTripsUsed = user?.aiTripsUsedThisMonth ?? 0;
  const aiTripsLimit = (isPremium || isAdmin) ? -1 : AI_TRIPS_FREE_LIMIT;
  const aiTripsRemaining = (isPremium || isAdmin) ? -1 : Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed);
  const isAiLimitReached = !isPremium && !isAdmin && user?.aiTripsUsedThisMonth !== undefined && aiTripsRemaining <= 0;

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
    subscriptionTier: isPremium ? 'premium' : 'free',
    aiTripsRemaining,
    aiTripsUsed,
    aiTripsLimit,
    isAiLimitReached,
    expiresAt: user?.subscriptionExpiresAt,
    isPaywallVisible,
    paywallContext,
    showPaywall,
    hidePaywall,
    refreshStatus,
    markPremium,
    markLoggingOut,
  }), [isPremium, isAdmin, aiTripsRemaining, aiTripsUsed, aiTripsLimit, isAiLimitReached, user?.subscriptionExpiresAt, isPaywallVisible, paywallContext, showPaywall, hidePaywall, refreshStatus, markPremium, markLoggingOut]);

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};
