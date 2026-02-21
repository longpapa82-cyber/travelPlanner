/**
 * GDPR Consent Hook (Web Stub)
 *
 * On web, GDPR consent is handled via cookie consent banners
 * (separate from the native UMP SDK). This stub always returns "consented"
 * so AdSense components render normally.
 */

type ConsentStatus = 'unknown' | 'required' | 'not_required' | 'obtained';

interface GDPRConsentResult {
  consentStatus: ConsentStatus;
  canShowPersonalizedAds: boolean;
  isReady: boolean;
}

export function useGDPRConsent(): GDPRConsentResult {
  return {
    consentStatus: 'not_required',
    canShowPersonalizedAds: true,
    isReady: true,
  };
}
