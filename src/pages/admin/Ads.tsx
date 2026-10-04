import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Pencil, Upload } from 'lucide-react';

type Ad = {
  id: string; advertiser_name: string; title: string | null; image_url: string; link_url: string | null;
  placements: string[]; starts_at: string; ends_at: string; is_active: boolean; price_ksh: number;
  advertiser_phone: string | null; views: number; clicks: number;
};

const PLACEMENTS = [
  { id: 'home', label: 'Homepage' },
  { id: 'shop', label: 'Shop page' },
  { id: 'product', label: 'Product pages' },
];

const toLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const blank = () => ({
  id: '', advertiser_name: '', title: '', image_url: '', link_url: '', placements: ['home'],
  starts_at: toLocal(new Date().toISOString()), ends_at: toLocal(new Date(Date.now() + 30 * 864e5).toISOString()),
  is_active: true, price_ksh: 0, advertiser_phone: '',
});

export default function AdminAds() {
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [today, setToday] = useState<Record<string, { views: number; clicks: number }>>({});
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('ads').select('*').order('created_at', { ascending: false });
    setAds((data as Ad[]) || []);
    const day = new Date().toISOString().slice(0, 10);
    const { data: s } = await supabase.from('ad_daily_stats').select('*').eq('day', day);
    const m: Record<string, { views: number; clicks: number }> = {};
    (s || []).forEach((r) => { m[r.ad_id] = { views: r.views, clicks: r.clicks }; });
    setToday(m);
  };
  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      toast({ title: 'Use an image under 5MB', variant: 'destructive' }); return;
    }
    setUploading(true);
    const path = `ads/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
    const { error } = await supabase.storage.from('store-content').upload(path, file, { upsert: false });
    if (error) toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    else setForm((f) => ({ ...f, image_url: supabase.storage.from('store-content').getPublicUrl(path).data.publicUrl }));
    setUploading(false);
  };

  const save = async () => {
    if (!form.advertiser_name.trim() || !form.image_url) {
      toast({ title: 'Business name and banner are required', variant: 'destructive' }); return;
    }
    if (form.link_url && !/^https?:\/\//i.test(form.link_url)) {
      toast({ title: 'Link must start with http:// or https://', variant: 'destructive' }); return;
    }
    if (!form.placements.length) { toast({ title: 'Pick at least one placement', variant: 'destructive' }); return; }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast({ title: 'End date must be after start date', variant: 'destructive' }); return;
    }
    setSaving(true);
    const payload = {
      advertiser_name: form.advertiser_name.trim(), title: form.title?.trim() || null, image_url: form.image_url,
      link_url: form.link_url?.trim() || null, placements: form.placements,
      starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(),
      is_active: form.is_active, price_ksh: Number(form.price_ksh) || 0,
      advertiser_phone: form.advertiser_phone?.trim() || null, updated_at: new Date().toISOString(),
    };
    const { error } = form.id
      ? await supabase.from('ads').update(payload).eq('id', form.id)
      : await supabase.from('ads').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    toast({ title: form.id ? 'Ad updated' : 'Ad created' });
    setForm(blank()); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this ad?')) return;
    await supabase.from('ads').delete().eq('id', id); load();
  };

  const toggle = async (a: Ad) => {
    await supabase.from('ads').update({ is_active: !a.is_active }).eq('id', a.id); load();
  };

  const status = (a: Ad) => {
    const now = Date.now();
    if (!a.is_active) return <Badge variant="secondary">Paused</Badge>;
    if (now < new Date(a.starts_at).getTime()) return <Badge variant="outline">Scheduled</Badge>;
    if (now > new Date(a.ends_at).getTime()) return <Badge variant="destructive">Ended</Badge>;
    return <Badge>Live</Badge>;
  };

  const totals = ads.reduce((t, a) => ({ v: t.v + a.views, c: t.c + a.clicks, r: t.r + a.price_ksh }), { v: 0, c: 0, r: 0 });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Banner Ads</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[['Ads', ads.length], ['Total views', totals.v], ['Total clicks', totals.c], ['Ad income (Ksh)', totals.r.toLocaleString()]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>{form.id ? 'Edit ad' : 'New ad'}</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div><Label>Business name *</Label><Input value={form.advertiser_name} onChange={(e) => setForm({ ...form, advertiser_name: e.target.value })} /></div>
          <div><Label>Advertiser phone</Label><Input value={form.advertiser_phone || ''} onChange={(e) => setForm({ ...form, advertiser_phone: e.target.value })} /></div>
          <div><Label>Ad title (optional)</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Link (where clicks go)</Label><Input placeholder="https://..." value={form.link_url || ''} onChange={(e) => setForm({ ...form, link_url: e.target.value })} /></div>
          <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
          <div><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          <div><Label>Price charged (Ksh)</Label><Input type="number" min={0} value={form.price_ksh} onChange={(e) => setForm({ ...form, price_ksh: Number(e.target.value) })} /></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
          <div className="md:col-span-2">
            <Label>Show on</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {PLACEMENTS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.placements.includes(p.id)} onCheckedChange={(c) => setForm({ ...form, placements: c ? [...form.placements, p.id] : form.placements.filter((x) => x !== p.id) })} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Banner image * (wide, e.g. 1200×300)</Label>
            <label className="mt-2 flex items-center gap-2 cursor-pointer text-sm text-primary">
              <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload banner'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {form.image_url && <img src={form.image_url} alt="Banner preview" className="mt-3 max-h-40 rounded-lg border" />}
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={save} disabled={saving || uploading}>{saving ? 'Saving…' : form.id ? 'Update ad' : 'Create ad'}</Button>
            {form.id && <Button variant="outline" onClick={() => setForm(blank())}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {ads.length === 0 && <p className="text-muted-foreground">No ads yet.</p>}
        {ads.map((a) => {
          const ctr = a.views ? ((a.clicks / a.views) * 100).toFixed(1) : '0.0';
          return (
            <Card key={a.id}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 md:items-center">
                <img src={a.image_url} alt={a.advertiser_name} className="w-full md:w-48 h-20 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold">{a.advertiser_name}</p>{status(a)}</div>
                  <p className="text-xs text-muted-foreground">{new Date(a.starts_at).toLocaleDateString()} – {new Date(a.ends_at).toLocaleDateString()} · {a.placements.join(', ')} · Ksh {a.price_ksh.toLocaleString()}</p>
                  <p className="text-sm mt-1">{a.views} views · {a.clicks} clicks · {ctr}% click rate · today: {today[a.id]?.views || 0} / {today[a.id]?.clicks || 0}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Switch checked={a.is_active} onCheckedChange={() => toggle(a)} aria-label="Active" />
                  <Button size="icon" variant="outline" aria-label="Edit" onClick={() => { setForm({ ...a, title: a.title || '', link_url: a.link_url || '', advertiser_phone: a.advertiser_phone || '', starts_at: toLocal(a.starts_at), ends_at: toLocal(a.ends_at) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" aria-label="Delete" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}
