import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Timer, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FlashSale {
  id: string;
  sale_price: number;
  original_price: number;
  ends_at: string;
  products: { id: string; name: string; image_url: string | null; type: string } | null;
}

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <span className="font-mono text-sm font-bold text-destructive">{timeLeft}</span>
  );
}

export function FlashSaleBanner() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('flash_sales')
        .select('id, sale_price, original_price, ends_at, products:product_id(id, name, image_url, type)')
        .eq('is_active', true)
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: true })
        .limit(4);
      setSales((data as unknown as FlashSale[]) || []);
    };
    fetch();
  }, []);

  if (sales.length === 0) return null;

  const discount = (sale: FlashSale) =>
    Math.round(((sale.original_price - sale.sale_price) / sale.original_price) * 100);

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-destructive" />
        <h3 className="font-bold text-foreground">Flash Sales</h3>
        <Badge variant="destructive" className="text-xs">Limited Time</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sales.map((sale) => (
          <Card key={sale.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/shop')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {sale.products?.image_url && (
                  <img src={sale.products.image_url} alt="" className="w-12 h-12 rounded object-cover" loading="lazy" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{sale.products?.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-destructive">
                      Ksh {sale.sale_price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground line-through">
                      Ksh {sale.original_price.toLocaleString()}
                    </span>
                    <Badge variant="secondary" className="text-xs">-{discount(sale)}%</Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Timer className="h-3 w-3 text-destructive" />
                    <CountdownTimer endsAt={sale.ends_at} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
