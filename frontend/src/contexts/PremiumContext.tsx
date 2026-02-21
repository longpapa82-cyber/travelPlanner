import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { SubscriptionStatus } from '../types';
import { initRevenueCat, logIn, logOut as rcLogOut } from '../services/revenueCat';

const AI_TRIPS_FREE_LIMIT = 3;

interface PremiumContextType {
  isPremium: boolean;
  subscriptionTier: 'free' | 'premium';
  aiTripsRemaining: number;
  aiTripsUsed: number;
  aiTripsLimit: number;
  expiresAt?: string;
  isPaywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  refreshStatus: () => Promise<void>;
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

  // Initialize RevenueCat on native platforms when user is available
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user?.id) return;

    initRevenueCat(String(user.id)).then(() => {
      logIn(String(user.id));
    });
  }, [user?.id]);

  const isPremium = useMemo(() => {
    if (!user?.subscriptionTier) return false;
    if (user.subscriptionTier !== 'premium') return false;
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) return false;
    return true;
  }, [user?.subscriptionTier, user?.subscriptionExpiresAt]);

  const aiTripsUsed = user?.aiTripsUsedThisMonth ?? 0;
  const aiTripsLimit = isPremium ? -1 : AI_TRIPS_FREE_LIMIT;
  const aiTripsRemaining = isPremium ? -1 : Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed);

  const showPaywall = useCallback(() => {
    setIsPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setIsPaywallVisible(false);
  }, []);

  const refreshStatus = useCallback(async () => {
    await refreshUser();
  }, [refreshUser]);

  const value = useMemo<PremiumContextType>(() => ({
    isPremium,
    subscriptionTier: isPremium ? 'premium' : 'free',
    aiTripsRemaining,
    aiTripsUsed,
    aiTripsLimit,
    expiresAt: user?.subscriptionExpiresAt,
    isPaywallVisible,
    showPaywall,
    hidePaywall,
    refreshStatus,
  }), [isPremium, aiTripsRemaining, aiTripsUsed, aiTripsLimit, user?.subscriptionExpiresAt, isPaywallVisible, showPaywall, hidePaywall, refreshStatus]);

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};
