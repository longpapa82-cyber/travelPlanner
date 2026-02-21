/**
 * RevenueCat SDK integration for native (iOS/Android).
 * Web builds use revenueCat.web.ts instead (platform-specific module resolution).
 */
import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import Constants from 'expo-constants';

const REVENUECAT_IOS_KEY = Constants.expoConfig?.extra?.revenueCatIosKey || '';
const REVENUECAT_ANDROID_KEY = Constants.expoConfig?.extra?.revenueCatAndroidKey || '';
import { Platform } from 'react-native';

let isInitialized = false;

export async function initRevenueCat(userId?: string): Promise<void> {
  if (isInitialized) return;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!apiKey) {
    console.warn('[RevenueCat] No API key configured for', Platform.OS);
    return;
  }

  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey, appUserID: userId || undefined });
  isInitialized = true;
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

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) return null;
    throw error;
  }
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
  } catch (error) {
    console.warn('[RevenueCat] Failed to log in:', error);
  }
}

export async function logOut(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn('[RevenueCat] Failed to log out:', error);
  }
}
