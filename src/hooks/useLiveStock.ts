import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveStockUpdate {
  id: string;
  stock_quantity: number;
  in_stock: boolean;
}

/**
 * Live stock listener. Whenever any product's stock changes (e.g. another
 * shopper's payment is confirmed first) the handler fires so the UI can update
 * instantly — no page reload required.
 */
export function useLiveStock(onChange: (update: LiveStockUpdate) => void) {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    const channel = supabase
      .channel('live-product-stock')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const row = payload.new as { id?: string; stock_quantity?: number; in_stock?: boolean };
          if (!row?.id) return;
          handlerRef.current({
            id: row.id,
            stock_quantity: Number(row.stock_quantity ?? 0),
            in_stock: Boolean(row.in_stock),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}

export interface StockCheckResult {
  ok: boolean;
  unavailable: {
    product_id: string;
    product_name: string;
    requested: number;
    available: number;
  }[];
}

/** Server-side availability check right before payment. */
export async function checkStockAvailability(
  items: { product_id: string; quantity: number }[],
): Promise<StockCheckResult> {
  if (items.length === 0) return { ok: true, unavailable: [] };
  const { data, error } = await supabase.rpc('check_stock_availability', {
    _items: items as unknown as never,
  });
  if (error) return { ok: true, unavailable: [] };
  const result = data as unknown as StockCheckResult | null;
  return { ok: result?.ok !== false, unavailable: result?.unavailable ?? [] };
}