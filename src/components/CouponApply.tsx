import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface CouponApplyProps {
  cartTotal: number;
  onApply: (discount: { code: string; amount: number; description: string }) => void;
  onRemove: () => void;
  appliedCoupon: { code: string; amount: number; description: string } | null;
}

export function CouponApply({ cartTotal, onApply, onRemove, appliedCoupon }: CouponApplyProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setChecking(true);

    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      toast.error('Invalid or expired discount code');
      setChecking(false);
      return;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error('This discount code has expired');
      setChecking(false);
      return;
    }

    // Check usage
    if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error('This discount code has reached its usage limit');
      setChecking(false);
      return;
    }

    // Check minimum order
    if (data.min_order_amount && cartTotal < data.min_order_amount) {
      toast.error(`Minimum order of Ksh ${data.min_order_amount.toLocaleString()} required`);
      setChecking(false);
      return;
    }

    // Calculate discount
    let amount = 0;
    let description = '';
    if (data.discount_percent > 0) {
      amount = Math.round(cartTotal * (data.discount_percent / 100));
      description = `${data.discount_percent}% off`;
    } else if (data.discount_amount > 0) {
      amount = Math.min(data.discount_amount, cartTotal);
      description = `Ksh ${data.discount_amount} off`;
    }

    if (amount <= 0) {
      toast.error('This discount does not apply to your order');
      setChecking(false);
      return;
    }

    onApply({ code: data.code, amount, description });
    toast.success(`Discount applied: ${description}`);
    setChecking(false);
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-500" />
          <Badge variant="secondary" className="gap-1">
            <Tag className="h-3 w-3" />
            {appliedCoupon.code}
          </Badge>
          <span className="text-sm text-muted-foreground">{appliedCoupon.description}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Discount code"
          className="pl-10"
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      </div>
      <Button variant="outline" onClick={handleApply} disabled={checking}>
        {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
      </Button>
    </div>
  );
}
