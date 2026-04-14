/**
 * Shared subscription quota constants.
 *
 * Single source of truth for AI trip generation limits. Frontend reads the
 * actual limit from the backend response (see getSubscriptionStatus), so these
 * values must match the numeric quotas advertised to users in marketing copy
 * and i18n strings.
 */
export const AI_TRIPS_FREE_LIMIT = 3;
export const AI_TRIPS_PREMIUM_LIMIT = 30;
