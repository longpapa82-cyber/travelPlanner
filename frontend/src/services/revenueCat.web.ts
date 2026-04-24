/**
 * RevenueCat web stub — IAP is not available on web.
 * The web build uses this file instead of revenueCat.ts via
 * React Native's platform-specific module resolution (.web.ts).
 */

export async function initRevenueCat(_userId?: string): Promise<void> {
  // No-op on web
}

export async function getOfferings(): Promise<null> {
  return null;
}

export async function purchasePackage(
  _pkg: any,
  _options?: { oldProductIdentifier?: string },
): Promise<null> {
  return null;
}

export interface ActiveEntitlementSnapshot {
  productIdentifier: string;
  planType?: 'monthly' | 'yearly';
  expiresAtMs: number | null;
}

export function getActiveEntitlementSnapshot(_info: any): ActiveEntitlementSnapshot | null {
  return null;
}

export async function restorePurchases(): Promise<null> {
  return null;
}

export async function getCustomerInfo(): Promise<null> {
  return null;
}

export async function logIn(_userId: string): Promise<void> {
  // No-op on web
}

export async function logOut(): Promise<void> {
  // No-op on web
}

export function addCustomerInfoUpdateListener(_listener: (info: any) => void): void {
  // No-op on web
}
