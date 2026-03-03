/**
 * GDPR Consent Hook (Web)
 *
 * Manages cookie consent state via localStorage for web platform.
 * Shows a consent banner when no prior consent decision exists.
 * Compatible with the native useGDPRConsent interface.
 */

import { useState, useEffect, useCallback } from 'react';

type ConsentStatus = 'unknown' | 'required' | 'not_required' | 'obtained';

interface GDPRConsentResult {
  consentStatus: ConsentStatus;
  canShowPersonalizedAds: boolean;
  isReady: boolean;
}

const STORAGE_KEY = 'gdpr_consent';

interface StoredConsent {
  hasConsent: boolean;
  timestamp: number;
}

function getStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.hasConsent !== 'boolean') return null;
    return parsed as StoredConsent;
  } catch {
    return null;
  }
}

export function setConsent(hasConsent: boolean): void {
  try {
    const data: StoredConsent = {
      hasConsent,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (e.g. private browsing quota exceeded)
  }
}

/**
 * Event-based communication between hook and banner component.
 * The banner calls setConsent() + dispatches this event,
 * and useGDPRConsent re-reads the stored value.
 */
const CONSENT_CHANGE_EVENT = 'gdpr_consent_change';

export function dispatchConsentChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  }
}

export function useGDPRConsent(): GDPRConsentResult {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('unknown');
  const [canShowPersonalizedAds, setCanShowPersonalizedAds] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const readConsent = useCallback(() => {
    const stored = getStoredConsent();
    if (stored) {
      // User has previously made a choice
      setConsentStatus('obtained');
      setCanShowPersonalizedAds(stored.hasConsent);
      setIsReady(true);
    } else {
      // No prior consent — banner needs to be shown
      setConsentStatus('required');
      setCanShowPersonalizedAds(false);
      setIsReady(false);
    }
  }, []);

  useEffect(() => {
    readConsent();

    // Listen for consent changes from the banner component
    const handleChange = () => readConsent();
    window.addEventListener(CONSENT_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handleChange);
  }, [readConsent]);

  return { consentStatus, canShowPersonalizedAds, isReady };
}
