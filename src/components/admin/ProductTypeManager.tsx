import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Pencil, Check, X } from 'lucide-react';

type ProductType = { slug: string; name: string; is_active: boolean; sort_order: number };
const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function ProductTypeManager() {
  const [items, setItems] = useState<ProductType[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const load = async () => {
    const { data, error } = await supabase.from('product_types').select('*').order('sort_order').order('name');
    if (error) { toast.error('Could not load product catalogue'); return; }
    setItems((data || []) as ProductType[]);
  };
  useEffect(() => { void load(); }, []);
  const add = async () => {
    const slug = slugify(name);
    if (!slug) return;
    const { error } = await supabase.from('product_types').insert({ slug, name: name.trim(), sort_order: items.length + 1 });
    if (error) { toast.error(error.message); return; }
    setName(''); toast.success('Product type added'); await load();
  };
  const rename = async (slug: string) => {
    const next = slugify(editName);
    if (!next) return;
    if (next !== slug) {
      const { data: products } = await supabase.from('products').select('id').eq('type', slug as Database['public']['Enums']['uniform_type']).limit(1);
      const { data: charts } = await supabase.from('pricing_chart').select('id').eq('uniform_type', slug).limit(1);
      if ((products?.length || 0) + (charts?.length || 0)) { toast.error('This type is already used. Keep its code and change only its display name.'); return; }
    }
    const { error } = await supabase.from('product_types').update({ name: editName.trim() }).eq('slug', slug);
    if (error) { toast.error(error.message); return; }
    setEditing(null); toast.success('Product type updated'); await load();
  };
  const toggle = async (item: ProductType) => {
    const { error } = await supabase.from('product_types').update({ is_active: !item.is_active }).eq('slug', item.slug);
    if (error) { toast.error(error.message); return; }
    await load();
  };
  return <Card><CardHeader><CardTitle>Product List</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex gap-2"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Add a product type, e.g. Scrubs" onKeyDown={e => { if (e.key === 'Enter') void add(); }} /><Button onClick={() => void add()} disabled={!slugify(name)}><Plus className="h-4 w-4 mr-1" />Add</Button></div>
    <div className="divide-y">{items.map(item => <div key={item.slug} className="flex items-center gap-2 py-2">
      {editing === item.slug ? <><Input value={editName} onChange={e => setEditName(e.target.value)} /><Button size="icon" onClick={() => void rename(item.slug)}><Check className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button></> :
      <><div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.slug}</p></div><span className="text-xs text-muted-foreground">{item.is_active ? 'Active' : 'Hidden'}</span><Button size="icon" variant="ghost" onClick={() => { setEditing(item.slug); setEditName(item.name); }}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => void toggle(item)}>{item.is_active ? 'Hide' : 'Show'}</Button></>}
    </div>)}</div>
  </CardContent></Card>;
}
