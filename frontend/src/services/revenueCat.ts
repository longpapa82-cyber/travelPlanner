/**
 * RevenueCat SDK integration for native (iOS/Android).
 * Web builds use revenueCat.web.ts instead (platform-specific module resolution).
 */
import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PRORATION_MODE,
} from 'react-native-purchases';
import Constants from 'expo-constants';

const REVENUECAT_IOS_KEY = Constants.expoConfig?.extra?.revenueCatIosKey || '';
const REVENUECAT_ANDROID_KEY = Constants.expoConfig?.extra?.revenueCatAndroidKey || '';
import { Platform } from 'react-native';

// V180 (Issue 1): track the configured user so subsequent calls can detect
// a userId change and re-configure the SDK. Without this, the V174 logOut
// fix is undone — the module-level `isInitialized` boolean stayed true
// across logout, so `initRevenueCat(newUserId)` early-returned and the SDK
// remained pinned to the previous user's anonymous device cache. The next
// `Purchases.logIn(newUserId)` then aliased the old entitlement onto the
// new user, surfacing the V179 "탈퇴-재가입 phantom 구독" bug.
let isInitialized = false;
let configuredUserId: string | undefined;

export async function initRevenueCat(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!apiKey) {
    console.warn('[RevenueCat] No API key configured for', Platform.OS);
    return;
  }

  // First-time setup.
  if (!isInitialized) {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: userId || undefined });
    isInitialized = true;
    configuredUserId = userId;
    return;
  }

  // Already initialized but userId changed (different account). RC SDK does
  // not support re-configure on the same instance reliably, so we issue a
  // logIn to alias to the new identity. The SDK guarantees logOut→logIn
  // sequence has been called by AuthContext for fresh-account flows; this
  // path is a defense-in-depth for the rare case where init fires twice
  // with different ids (e.g. fast account-switch on a single device).
  if (userId && userId !== configuredUserId) {
    try {
      await Purchases.logIn(userId);
      configuredUserId = userId;
    } catch (err) {
      console.warn('[RevenueCat] Failed to switch user during init:', err);
    }
  }
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.warn('[RevenueCat] Failed to get offerings:', error);
    return null;
  }
}

/**
 * V169: Purchase a package with optional Google Play plan-switch support.
 *
 * When `oldProductIdentifier` is supplied, RevenueCat will issue a Google
 * Play subscription *replacement* instead of creating a second subscription.
 * We use DEFERRED proration so the user keeps the current plan until the
 * next billing date, avoiding any double-billing window.
 *
 * iOS subscriptions handle plan switching at the App Store level (same
 * subscription group), so `oldProductIdentifier` is a no-op there — passing
 * it is safe because react-native-purchases only honors it on Android.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
  options?: { oldProductIdentifier?: string },
): Promise<CustomerInfo | null> {
  try {
    if (options?.oldProductIdentifier) {
      // react-native-purchases signature:
      //   purchasePackage(pkg, upgradeInfo?, googleProductChangeInfo?, googleIsPersonalizedPrice?)
      // We use the third positional arg (googleProductChangeInfo) — `upgradeInfo`
      // is deprecated and only exposes oldSKU. Pass null for upgradeInfo so
      // the SDK picks up the modern API path.
      const { customerInfo } = await Purchases.purchasePackage(
        pkg,
        null,
        {
          oldProductIdentifier: options.oldProductIdentifier,
          prorationMode: PRORATION_MODE.DEFERRED,
        },
      );
      return customerInfo;
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) return null;
    throw error;
  }
}

/**
 * V169: Derive active subscription snapshot from CustomerInfo.
 * Returns null when there is no active entitlement.
 *
 * Used by PaywallModal as the single source of truth for the "am I already
 * subscribed?" check at purchase time — we never rely on the React state
 * `isPremium`, which can be stale during post-login bootstrap or webhook lag.
 */
export interface ActiveEntitlementSnapshot {
  productIdentifier: string;
  planType?: 'monthly' | 'yearly';
  expiresAtMs: number | null;
}

export function getActiveEntitlementSnapshot(
  info: CustomerInfo | null,
): ActiveEntitlementSnapshot | null {
  const active = info?.entitlements?.active;
  if (!active) return null;
  const entitlement = active['premium'] || Object.values(active)[0];
  if (!entitlement) return null;

  const productIdentifier = entitlement.productIdentifier || '';
  const idLower = productIdentifier.toLowerCase();
  // V169: explicit mapping table — mirror backend B1 fix to stay consistent.
  // Matches known SKUs: premium_monthly, premium_yearly, premium_annual,
  // premium_1y, premium_1m. Add new SKUs here *and* in subscription.service.ts.
  const planType: 'monthly' | 'yearly' | undefined =
    idLower === 'premium_yearly' ||
    idLower === 'premium_annual' ||
    idLower === 'premium_1y' ||
    idLower.endsWith(':premium-yearly') ||
    idLower.endsWith(':premium-annual')
      ? 'yearly'
      : idLower === 'premium_monthly' ||
          idLower === 'premium_1m' ||
          idLower.endsWith(':premium-monthly')
        ? 'monthly'
        : idLower.includes('year') || idLower.includes('annual')
          ? 'yearly'
          : idLower.includes('month')
            ? 'monthly'
            : undefined;

  const expiresAtMs = entitlement.expirationDate
    ? new Date(entitlement.expirationDate).getTime()
    : null;

  return { productIdentifier, planType, expiresAtMs };
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] Failed to restore purchases:', error);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info;
  } catch (error) {
    console.warn('[RevenueCat] Failed to get customer info:', error);
    return null;
  }
}

export async function logIn(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  } catch (error) {
    console.warn('[RevenueCat] Failed to log in:', error);
  }
}

export async function logOut(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn('[RevenueCat] Failed to log out:', error);
  } finally {
    // V180: clear the configured user marker so the next initRevenueCat
    // for a new account is treated as a fresh identity, not as an
    // already-configured no-op. The SDK itself stays initialized
    // (isInitialized remains true) — re-configuring the API key is unsafe.
    configuredUserId = undefined;
  }
}

export function addCustomerInfoUpdateListener(
  listener: (info: CustomerInfo) => void,
): void {
  Purchases.addCustomerInfoUpdateListener(listener);
}
