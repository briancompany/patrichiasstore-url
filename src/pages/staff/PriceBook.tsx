import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Save, Search, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  id: string;
  uniform_type: string;
  size: string;
  price: number;
}

export default function PriceBook() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newType, setNewType] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pricing_chart')
      .select('id,uniform_type,size,price')
      .order('uniform_type')
      .order('size');
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = s
      ? rows.filter((r) => r.uniform_type.toLowerCase().includes(s) || r.size.toLowerCase().includes(s))
      : rows;
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => {
      if (!map.has(r.uniform_type)) map.set(r.uniform_type, []);
      map.get(r.uniform_type)!.push(r);
    });
    return Array.from(map.entries());
  }, [rows, search]);

  const addRow = async () => {
    if (!newType.trim() || !newSize.trim() || newPrice <= 0) {
      return toast.error('Enter product, size and price');
    }
    setSaving(true);
    const { error } = await supabase
      .from('pricing_chart')
      .insert({ uniform_type: newType.trim(), size: newSize.trim(), price: newPrice });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNewSize('');
    setNewPrice(0);
    toast.success('Added to price book');
    load();
  };

  const updateRow = async (r: Row, patch: Partial<Row>) => {
    const merged = { ...r, ...patch };
    setRows((prev) => prev.map((p) => (p.id === r.id ? merged : p)));
    const { error } = await supabase
      .from('pricing_chart')
      .update({ uniform_type: merged.uniform_type, size: merged.size, price: merged.price })
      .eq('id', r.id);
    if (error) toast.error(error.message);
  };

  const removeRow = async (r: Row) => {
    if (!confirm(`Remove ${r.uniform_type} · ${r.size}?`)) return;
    const { error } = await supabase.from('pricing_chart').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success('Removed');
    load();
  };

  return (
    <StaffLayout title="Price Book">
      <div className="space-y-6">
        <Card className="border-gold/40">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-serif text-xl text-navy">Add New Product</h2>
            <div className="gold-divider" />
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <Label>Product / Category</Label>
                <Input placeholder="e.g. Blazer" value={newType} onChange={(e) => setNewType(e.target.value)} />
              </div>
              <div>
                <Label>Size</Label>
                <Input placeholder="e.g. Size 26" value={newSize} onChange={(e) => setNewSize(e.target.value)} />
              </div>
              <div>
                <Label>Price (Ksh)</Label>
                <Input type="number" min={0} value={newPrice || ''} onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={addRow} disabled={saving} className="btn-gold">
                <Plus className="h-4 w-4 mr-1" /> Add Product
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search product or size" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground">Loading price book…</p>}

        {!loading && grouped.length === 0 && (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No products yet. Add your first above.
          </CardContent></Card>
        )}

        {grouped.map(([type, list]) => (
          <Card key={type}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-lg text-navy">{type}</h3>
                <span className="text-xs text-muted-foreground">{list.length} sizes</span>
              </div>
              <div className="gold-divider" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {list.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 border border-border rounded-lg px-2 py-2">
                    <Input
                      className="h-9"
                      defaultValue={r.size}
                      onBlur={(e) => e.target.value !== r.size && updateRow(r, { size: e.target.value })}
                    />
                    <Input
                      className="h-9 w-28"
                      type="number"
                      defaultValue={r.price}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        if (v !== r.price) updateRow(r, { price: v });
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeRow(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </StaffLayout>
  );
}