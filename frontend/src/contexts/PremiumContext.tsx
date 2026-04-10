import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { SubscriptionStatus } from '../types';
import { initRevenueCat, logIn, logOut as rcLogOut } from '../services/revenueCat';
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
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id) return;

    initRevenueCat(String(user.id)).then(() => {
      logIn(String(user.id));
    });
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
  // Use conservative default: if profile data is missing, assume limit reached (not available)
  // This prevents showing "3/3 available" when server data hasn't loaded yet
  const aiTripsUsed = user?.aiTripsUsedThisMonth ?? AI_TRIPS_FREE_LIMIT;
  const aiTripsLimit = (isPremium || isAdmin) ? -1 : AI_TRIPS_FREE_LIMIT;
  const aiTripsRemaining = (isPremium || isAdmin) ? -1 : Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed);
  const isAiLimitReached = !isPremium && !isAdmin && aiTripsRemaining <= 0;

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
