import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || 'placeholder_rc_key';
const ENTITLEMENT_ID = 'premium'; // must match the entitlement identifier in RevenueCat dashboard

export async function configureBilling(userId: string) {
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
  } catch (err: any) {
    console.error('RevenueCat configure error:', err.message);
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (err: any) {
    console.error('RevenueCat getOfferings error:', err.message);
    return null;
  }
}

export async function purchasePackage(pkg: any): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function isPremiumActive(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (err: any) {
    console.error('RevenueCat getCustomerInfo error:', err.message);
    return false;
  }
}
