import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Flame, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type ProductOption = { id: string; name: string; sizes: { price: number }[] };
type SaleRow = {
  id: string; product_id: string; title: string | null; sale_price: number; original_price: number;
  stock_allocated: number; stock_sold: number; starts_at: string; ends_at: string; is_active: boolean;
  products: { name: string } | null;
};

const localDate = (offsetHours: number) => {
  const date = new Date(Date.now() + offsetHours * 3_600_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function FlashSaleManager({ products }: { products: ProductOption[] }) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: '', title: '', salePrice: '', originalPrice: '', stock: '', startsAt: localDate(0), endsAt: localDate(24) });

  const load = async () => {
    const { data, error } = await supabase.from('flash_sales').select('*, products(name)').order('starts_at', { ascending: false });
    if (error) toast.error('Could not load flash sales');
    else setSales((data || []) as unknown as SaleRow[]);
  };

  useEffect(() => {
    load();
    const channel = supabase.channel('admin-flash-sales').on('postgres_changes', { event: '*', schema: 'public', table: 'flash_sales' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const selected = products.find((product) => product.id === form.productId);
  const suggestedOriginal = selected?.sizes?.length ? Math.min(...selected.sizes.map((size) => Number(size.price))) : 0;
  const discount = Number(form.originalPrice) > 0 ? Math.max(0, Math.round((1 - Number(form.salePrice) / Number(form.originalPrice)) * 100)) : 0;

  const grouped = useMemo(() => {
    const now = Date.now();
    return {
      active: sales.filter((sale) => sale.is_active && new Date(sale.starts_at).getTime() <= now && new Date(sale.ends_at).getTime() > now && (sale.stock_allocated <= 0 || sale.stock_sold < sale.stock_allocated)),
      scheduled: sales.filter((sale) => sale.is_active && new Date(sale.starts_at).getTime() > now),
      expired: sales.filter((sale) => !sale.is_active || new Date(sale.ends_at).getTime() <= now || (sale.stock_allocated > 0 && sale.stock_sold >= sale.stock_allocated)),
    };
  }, [sales]);

  const save = async () => {
    if (!form.productId || Number(form.salePrice) <= 0 || Number(form.originalPrice) <= Number(form.salePrice) || !form.startsAt || !form.endsAt || new Date(form.endsAt) <= new Date(form.startsAt)) {
      toast.error('Choose a product and enter a valid lower sale price and time range'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('flash_sales').insert({
      product_id: form.productId, title: form.title.trim() || null, sale_price: Number(form.salePrice), original_price: Number(form.originalPrice),
      stock_allocated: Math.max(0, Number(form.stock) || 0), starts_at: new Date(form.startsAt).toISOString(), ends_at: new Date(form.endsAt).toISOString(), is_active: true,
    });
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success('Flash sale scheduled'); setOpen(false); await load(); }
  };

  const toggle = async (sale: SaleRow) => {
    const { error } = await supabase.from('flash_sales').update({ is_active: !sale.is_active }).eq('id', sale.id);
    if (error) toast.error(error.message); else await load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from('flash_sales').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Flash sale deleted'); await load(); }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-destructive" />Flash Sales</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New Sale</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {(['active', 'scheduled', 'expired'] as const).map((status) => (
          <div key={status}>
            <h3 className="mb-2 text-sm font-bold capitalize">{status} ({grouped[status].length})</h3>
            {grouped[status].length === 0 ? <p className="text-sm text-muted-foreground">No {status} sales</p> : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{grouped[status].map((sale) => (
                <div key={sale.id} className="border border-border p-3 rounded-md space-y-2">
                  <div className="flex justify-between gap-2"><p className="font-semibold truncate">{sale.products?.name || 'Product'}</p><Badge variant={status === 'active' ? 'default' : 'secondary'}>{status}</Badge></div>
                  <p className="text-sm">Ksh {sale.sale_price.toLocaleString()} <span className="line-through text-muted-foreground">Ksh {sale.original_price.toLocaleString()}</span></p>
                  <p className="text-xs text-muted-foreground">{new Date(sale.starts_at).toLocaleString()} – {new Date(sale.ends_at).toLocaleString()}</p>
                  <p className="text-xs font-medium">{sale.stock_allocated > 0 ? `${Math.max(0, sale.stock_allocated - sale.stock_sold)} of ${sale.stock_allocated} sale units left` : 'Unlimited sale stock'}</p>
                  <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => toggle(sale)}><Power className="h-3.5 w-3.5 mr-1" />{sale.is_active ? 'Disable' : 'Enable'}</Button><Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => remove(sale.id)} aria-label="Delete flash sale"><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              ))}</div>
            )}
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Schedule Flash Sale</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Product</Label><Select value={form.productId} onValueChange={(productId) => setForm((value) => ({ ...value, productId, originalPrice: String(products.find((p) => p.id === productId)?.sizes?.reduce((min, s) => Math.min(min, Number(s.price)), Infinity) || '') }))}><SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-2 space-y-2"><Label>Sale title (optional)</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Back to School Deal" /></div>
            <div className="space-y-2"><Label>Original price</Label><Input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} placeholder={String(suggestedOriginal || '')} /></div>
            <div className="space-y-2"><Label>Flash price</Label><Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} /></div>
            <div className="space-y-2"><Label>Discount</Label><Input readOnly value={`${discount}%`} /></div>
            <div className="space-y-2"><Label>Allocated stock (0 = unlimited)</Label><Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            <div className="space-y-2"><Label>Starts</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></div>
            <div className="space-y-2"><Label>Ends</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Schedule Sale'}</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}