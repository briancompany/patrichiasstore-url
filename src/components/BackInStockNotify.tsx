import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface BackInStockProps {
  productId: string;
  productName: string;
}

export function BackInStockNotify({ productId, productName }: BackInStockProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async () => {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('stock_subscribers').insert({
      product_id: productId,
      email: email.trim().toLowerCase(),
    });

    if (error) {
      if (error.code === '23505') {
        toast.info("You're already subscribed for this item");
        setSubscribed(true);
      } else {
        toast.error('Failed to subscribe');
      }
    } else {
      toast.success("We'll email you when it's back in stock!");
      setSubscribed(true);
    }
    setSubmitting(false);
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/50 rounded-lg">
        <Check className="h-4 w-4 text-emerald-500" />
        <span>You'll be notified when available</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Bell className="h-3 w-3" />
        Get notified when back in stock
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Your email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={handleSubscribe} disabled={submitting} className="shrink-0">
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Notify Me'}
        </Button>
      </div>
    </div>
  );
}
