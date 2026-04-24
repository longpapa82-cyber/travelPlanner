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

/**
 * V169 (B1): Authoritative SKU → plan type mapping.
 *
 * Replaces the `product_id.includes('year')` substring heuristic, which
 * silently dropped planType updates for SKUs like `premium_annual` and
 * `premium_1y`. When Play Console or App Store Connect adds a new SKU,
 * add the lowercase product_id here AND mirror the change in
 * `frontend/src/services/revenueCat.ts` → `getActiveEntitlementSnapshot`.
 *
 * Keys are lowercased product IDs. Values are the canonical plan types we
 * store in the DB. Anything not in this table is considered "unknown" and
 * triggers a warning so we can add it without silently shipping wrong data.
 */
export const PLAN_TYPE_BY_PRODUCT_ID: Record<string, 'monthly' | 'yearly'> = {
  premium_monthly: 'monthly',
  premium_1m: 'monthly',
  'mytravel.premium.monthly': 'monthly',
  premium_yearly: 'yearly',
  premium_annual: 'yearly',
  premium_1y: 'yearly',
  'mytravel.premium.yearly': 'yearly',
  'mytravel.premium.annual': 'yearly',
};
