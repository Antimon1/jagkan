/** In-app purchases only exist in the iOS/Android apps; the web preview uses demo Plus. */
export const PLUS_ENTITLEMENT = 'plus';

export interface PlusOffer {
  pkg: unknown;
  priceString: string;
  period: 'month' | 'year' | 'other';
}

export function purchasesAvailable(): boolean {
  return false;
}

export function configurePurchases(_familyId: string): void {}

export async function getPlusOffers(): Promise<PlusOffer[]> {
  return [];
}

export async function purchasePlus(_offer: PlusOffer): Promise<boolean> {
  return false;
}

export async function restorePlus(): Promise<boolean> {
  return false;
}
