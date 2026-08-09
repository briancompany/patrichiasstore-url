import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StockControlProps {
  productId: string;
  quantity: number;
  onChange: (newQuantity: number) => void;
}

/** Restock / adjust live stock. Uses secure RPCs so values can never go negative. */
export function StockControl({ productId, quantity, onChange }: StockControlProps) {
  const [value, setValue] = useState(String(quantity));
  const [busy, setBusy] = useState(false);

  const adjust = async (delta: number) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('adjust_product_stock', {
      _product_id: productId,
      _delta: delta,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Could not update stock');
      return;
    }
    const next = Number(data);
    setValue(String(next));
    onChange(next);
    toast.success(`Stock updated to ${next}`);
  };

  const setExact = async () => {
    const qty = parseInt(value, 10);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('set_product_stock', {
      _product_id: productId,
      _quantity: qty,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Could not update stock');
      return;
    }
    const next = Number(data);
    setValue(String(next));
    onChange(next);
    toast.success(`Stock set to ${next}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={busy}
        onClick={() => adjust(-1)}
        aria-label="Reduce stock by one"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
        inputMode="numeric"
        className="h-8 w-16 text-center"
        aria-label="Stock quantity"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={busy}
        onClick={() => adjust(1)}
        aria-label="Increase stock by one"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8 gap-1"
        disabled={busy}
        onClick={setExact}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </Button>
    </div>
  );
}