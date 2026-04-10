/**
 * ConsentContext - Phase 0b
 *
 * 사용자 동의 상태 관리 및 ConsentScreen 표시 제어
 *
 * Features:
 * - 로그인 후 자동으로 동의 상태 확인
 * - needsConsent 또는 needsUpdate 시 ConsentScreen 표시
 * - 동의 완료 후 자동으로 메인 화면 진입
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { ConsentsStatus } from '../types';
import apiService from '../services/api';
import { useAuth } from './AuthContext';

interface ConsentContextType {
  consentsStatus: ConsentsStatus | null;
  isCheckingConsent: boolean;
  needsConsentScreen: boolean;
  checkConsentStatus: () => Promise<void>;
  markConsentComplete: () => void;
}

const ConsentContext = createContext<ConsentContextType | undefined>(undefined);

export const useConsent = () => {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within ConsentProvider');
  }
  return context;
};

interface ConsentProviderProps {
  children: ReactNode;
}

export const ConsentProvider: React.FC<ConsentProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [consentsStatus, setConsentsStatus] = useState<ConsentsStatus | null>(null);
  const [isCheckingConsent, setIsCheckingConsent] = useState(false);
  const [needsConsentScreen, setNeedsConsentScreen] = useState(false);

  // Check consent status when user becomes authenticated
  // Use user?.id (stable scalar) instead of user (object reference)
  // to prevent re-firing on every refreshUser() call
  useEffect(() => {
    if (isAuthenticated && user) {
      checkConsentStatus();
    } else {
      // Reset consent state when logged out
      setConsentsStatus(null);
      setNeedsConsentScreen(false);
    }
  }, [isAuthenticated, user?.id]);

  const checkConsentStatus = async () => {
    try {
      setIsCheckingConsent(true);
      const status = await apiService.getConsentsStatus();
      setConsentsStatus(status);

      // Show ConsentScreen if user needs to consent or update consents
      if (status.needsConsent || status.needsUpdate) {
        setNeedsConsentScreen(true);
      } else {
        setNeedsConsentScreen(false);
      }
    } catch (error) {
      console.error('[ConsentContext] Failed to check consent status:', error);
      // On error, don't block the user from using the app
      setNeedsConsentScreen(false);
    } finally {
      setIsCheckingConsent(false);
    }
  };

  const markConsentComplete = () => {
    setNeedsConsentScreen(false);
    // Do not re-check immediately — the POST was just accepted.
    // Re-checking can cause a race condition where stale backend data
    // re-shows the consent screen briefly after completion.
  };

  return (
    <ConsentContext.Provider
      value={{
        consentsStatus,
        isCheckingConsent,
        needsConsentScreen,
        checkConsentStatus,
        markConsentComplete,
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
};
