import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, FileText, Users, TrendingUp } from 'lucide-react';

export default function Reports() {
  const [stats, setStats] = useState({ quotes: 0, customers: 0, total: 0, thisMonth: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: quotes }, { count: customers }, { data: sums }] = await Promise.all([
        supabase.from('quotations').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('quotations').select('total, created_at'),
      ]);
      const now = new Date();
      const total = (sums || []).reduce((s: number, r: any) => s + (r.total || 0), 0);
      const thisMonth = (sums || [])
        .filter((r: any) => {
          const d = new Date(r.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s: number, r: any) => s + (r.total || 0), 0);
      setStats({ quotes: quotes || 0, customers: customers || 0, total, thisMonth });
    })();
  }, []);

  const items = [
    { icon: FileText, label: 'Total Quotations', value: stats.quotes.toLocaleString() },
    { icon: Users, label: 'Customers', value: stats.customers.toLocaleString() },
    { icon: TrendingUp, label: 'Quoted Value (All Time)', value: `Ksh ${stats.total.toLocaleString()}` },
    { icon: BarChart3, label: 'Quoted Value (This Month)', value: `Ksh ${stats.thisMonth.toLocaleString()}` },
  ];

  return (
    <StaffLayout title="Reports">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it) => (
          <Card key={it.label} className="border-gold/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-lg bg-primary text-gold flex items-center justify-center">
                  <it.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{it.label}</p>
                  <p className="font-serif text-2xl text-navy">{it.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </StaffLayout>
  );
}