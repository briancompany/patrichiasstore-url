export const STORAGE_KEYS = {
  shopCart: 'ps_shop_cart_v1',
  uniformCheckout: 'ps_uniform_checkout_v1',
  pendingOrder: 'ps_pending_order_v1',
  pesapalTrackingId: 'ps_pesapal_tracking_id',
  generalProductsCache: 'ps_general_products_cache_v1',
  schoolsCache: 'ps_schools_cache_v1',
  pricingChartCache: 'ps_pricing_chart_cache_v1',
  cacheTimestamp: 'ps_cache_ts_v1',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export function storageGet<T>(key: StorageKey): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSet(key: StorageKey, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (quota, privacy mode)
  }
}

export function storageRemove(key: StorageKey): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
