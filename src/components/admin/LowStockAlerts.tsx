import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface LowStockProduct {
  id: string;
  name: string;
  stock_quantity: number;
  in_stock: boolean;
}

export function LowStockAlerts() {
  const [products, setProducts] = useState<LowStockProduct[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, stock_quantity, in_stock')
        .lt('stock_quantity', 20)
        .order('stock_quantity', { ascending: true })
        .limit(10);
      setProducts(data || []);
    };
    fetch();
  }, []);

  if (products.length === 0) return null;

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Low Stock Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{p.name}</span>
              <Badge variant={p.stock_quantity === 0 ? 'destructive' : 'secondary'}>
                {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
