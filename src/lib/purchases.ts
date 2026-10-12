import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { config } from './config';
import { logError } from './log';

/** RevenueCat entitlement that unlocks JagKan! Plus (spec 13). */
export const PLUS_ENTITLEMENT = 'plus';

let configuredFor: string | null = null;

function apiKey(): string | null {
  return Platform.OS === 'ios' ? config.revenueCatIosKey : config.revenueCatAndroidKey;
}

export function purchasesAvailable(): boolean {
  return apiKey() !== null;
}

/** The family id is the RevenueCat app user id, so the webhook can update `families.plus_active`. */
export function configurePurchases(familyId: string): void {
  const key = apiKey();
  if (!key || configuredFor === familyId) return;
  try {
    Purchases.configure({ apiKey: key, appUserID: familyId });
    configuredFor = familyId;
  } catch (error) {
    logError('purchases.configure', error);
  }
}

export interface PlusOffer {
  pkg: PurchasesPackage;
  priceString: string;
  period: 'month' | 'year' | 'other';
}

export async function getPlusOffers(): Promise<PlusOffer[]> {
  if (!configuredFor) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    return current.availablePackages.map((pkg) => ({
      pkg,
      priceString: pkg.product.priceString,
      period: pkg.packageType === 'MONTHLY' ? 'month' : pkg.packageType === 'ANNUAL' ? 'year' : 'other',
    }));
  } catch (error) {
    logError('purchases.offers', error);
    return [];
  }
}

export async function purchasePlus(offer: PlusOffer): Promise<boolean> {
  try {
    const result = await Purchases.purchasePackage(offer.pkg);
    return PLUS_ENTITLEMENT in result.customerInfo.entitlements.active;
  } catch (error) {
    logError('purchases.buy', error);
    return false;
  }
}

export async function restorePlus(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return PLUS_ENTITLEMENT in info.entitlements.active;
  } catch (error) {
    logError('purchases.restore', error);
    return false;
  }
}
