/**
 * JIT (Just-In-Time) Consent Utility
 *
 * Records consent for location, notification, and photo permissions
 * when the user grants them at feature use time (not on initial consent screen).
 * Fire-and-forget: failures do not block functionality.
 */

import api from '../services/api';

type JitConsentType = 'location' | 'notification' | 'photo';

export const recordJitConsent = async (type: JitConsentType): Promise<void> => {
  try {
    await api.updateConsents({
      consents: [{ type, version: '1.0.0', isConsented: true }],
    });
  } catch (error) {
    // Fire-and-forget: JIT consent recording failure should never block functionality
    console.warn(`[JIT Consent] Failed to record ${type}:`, error);
  }
};
