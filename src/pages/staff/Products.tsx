import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Search } from 'lucide-react';
import { StockControl } from '@/components/admin/StockControl';

interface Row {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  in_stock: boolean;
  stock_quantity: number;
  schools?: { name: string } | null;
}

export default function StaffProducts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, type, image_url, in_stock, stock_quantity, schools(name)')
        .order('name');
      setRows((data as unknown as Row[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesTerm =
        !term ||
        r.name.toLowerCase().includes(term) ||
        (r.schools?.name || '').toLowerCase().includes(term);
      const matchesView =
        view === 'all' ||
        (view === 'out' && (!r.in_stock || r.stock_quantity <= 0)) ||
        (view === 'low' && r.stock_quantity > 0 && r.stock_quantity <= 10);
      return matchesTerm && matchesView;
    });
  }, [rows, q, view]);

  const updateStock = (id: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, stock_quantity: qty, in_stock: qty > 0 } : r)),
    );
  };

  const stockBadge = (r: Row) => {
    if (!r.in_stock || r.stock_quantity <= 0)
      return <Badge variant="destructive">Sold out</Badge>;
    if (r.stock_quantity <= 10)
      return <Badge className="bg-amber-500 text-white">Only {r.stock_quantity} left</Badge>;
    return <Badge variant="secondary">In stock · {r.stock_quantity}</Badge>;
  };

  return (
    <StaffLayout title="Products & Stock">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product or school..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'low', 'out'] as const).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={view === v ? 'default' : 'outline'}
                onClick={() => setView(v)}
              >
                {v === 'all' ? 'All' : v === 'low' ? 'Low stock' : 'Sold out'}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
              No products found
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-md bg-muted overflow-hidden shrink-0">
                    {r.image_url && (
                      <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.schools?.name || 'General'}
                    </p>
                    <div className="mt-1.5">{stockBadge(r)}</div>
                    <div className="mt-2">
                      <StockControl
                        productId={r.id}
                        quantity={r.stock_quantity}
                        onChange={(qty) => updateStock(r.id, qty)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}