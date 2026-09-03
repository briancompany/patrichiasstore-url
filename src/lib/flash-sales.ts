import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FlashSale {
  flash_sale_id: string;
  product_id: string;
  title: string | null;
  sale_price: number;
  original_price: number;
  starts_at: string;
  ends_at: string;
  stock_allocated: number;
  stock_sold: number;
  /** Remaining flash-sale units. Unlimited allocations report a huge number. */
  remaining: number;
}

export const UNLIMITED_FLASH_STOCK = 2147483647;

export function flashDiscount(sale: Pick<FlashSale, 'sale_price' | 'original_price'>): number {
  if (!sale.original_price || sale.original_price <= 0) return 0;
  return Math.max(
    0,
    Math.round(((sale.original_price - sale.sale_price) / sale.original_price) * 100),
  );
}

export function isLimitedFlashStock(sale: FlashSale): boolean {
  return sale.stock_allocated > 0 && sale.remaining < UNLIMITED_FLASH_STOCK;
}

export function flashStockLabel(sale: FlashSale): string | null {
  if (!isLimitedFlashStock(sale)) return null;
  if (sale.remaining <= 0) return 'Sale stock finished';
  return `Only ${sale.remaining} left at this price`;
}

/** Percentage of the flash allocation already claimed (for progress bars). */
export function flashSoldPercent(sale: FlashSale): number {
  if (!isLimitedFlashStock(sale)) return 0;
  const total = sale.stock_allocated;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((sale.stock_sold / total) * 100));
}

export async function fetchActiveFlashSales(): Promise<FlashSale[]> {
  const { data, error } = await supabase.rpc('get_active_flash_sales');
  if (error || !data) return [];
  return (data as unknown as FlashSale[]).filter((s) => s.remaining > 0);
}

/**
 * Live flash sales. Refreshes on realtime flash_sales changes and on a slow
 * poll so a sale flips live/expired without the shopper reloading the page.
 */
export function useFlashSales() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const fresh = await fetchActiveFlashSales();
    setSales(fresh);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const fresh = await fetchActiveFlashSales();
      if (!cancelled) {
        setSales(fresh);
        setLoaded(true);
      }
    };
    run();

    const interval = setInterval(run, 60_000);
    const channel = supabase
      .channel('live-flash-sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flash_sales' }, () => {
        run();
      })
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const byProduct = new Map<string, FlashSale>();
  sales.forEach((s) => {
    if (!byProduct.has(s.product_id)) byProduct.set(s.product_id, s);
  });

  return { sales, byProduct, loaded, refresh };
}

/** Countdown text for a flash sale end time. Returns null once it has ended. */
export function formatCountdown(endsAt: string): string | null {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}
