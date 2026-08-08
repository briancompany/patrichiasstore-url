import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Loader2, Search } from 'lucide-react';

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  delivery_type: string;
  created_at: string;
}

export default function StaffOrders() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, customer_name, customer_phone, status, total_amount, delivery_type, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows((data as unknown as OrderRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.customer_name.toLowerCase().includes(term) ||
        r.customer_phone.includes(term) ||
        r.id.toLowerCase().includes(term)
    );
  }, [rows, q]);

  return (
    <StaffLayout title="Orders">
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone or order ID..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
              No orders found
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.customer_phone} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize">
                      {r.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="font-semibold">Ksh {r.total_amount.toLocaleString()}</span>
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