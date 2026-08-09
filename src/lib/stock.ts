export type StockStatus = 'out' | 'low' | 'few' | 'ok';

export interface StockInfo {
  status: StockStatus;
  label: string;
  orderable: boolean;
  max: number;
}

/**
 * Jumia-style availability. Exact numbers are only exposed when stock is
 * genuinely low, otherwise we keep it vague to avoid revealing inventory.
 */
export function getStockInfo(quantity: number | null | undefined, inStock = true): StockInfo {
  // Unknown quantity (e.g. generated/custom items): fall back to the in_stock flag.
  if (quantity === null || quantity === undefined || !Number.isFinite(Number(quantity))) {
    return inStock
      ? { status: 'ok', label: 'In stock', orderable: true, max: Number.POSITIVE_INFINITY }
      : { status: 'out', label: 'SOLD OUT', orderable: false, max: 0 };
  }

  const qty = Math.max(0, Number(quantity));

  if (!inStock || qty <= 0) {
    return { status: 'out', label: 'SOLD OUT', orderable: false, max: 0 };
  }
  if (qty <= 10) {
    return { status: 'low', label: `Only ${qty} left`, orderable: true, max: qty };
  }
  if (qty <= 25) {
    return { status: 'few', label: 'Few pieces remaining', orderable: true, max: qty };
  }
  return { status: 'ok', label: 'In stock', orderable: true, max: qty };
}