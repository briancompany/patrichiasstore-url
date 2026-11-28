import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type Announcement = {
  id: string; title: string; message: string; announcement_type: 'maintenance' | 'completed' | 'info';
  starts_at: string; ends_at: string;
};
const DISMISSED_KEY = 'ps_dismissed_announcement_banners_v1';

function readDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') as string[]; } catch { return []; }
}

export function CustomerAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('store_announcements')
      .select('id,title,message,announcement_type,starts_at,ends_at')
      .eq('is_active', true).lte('starts_at', new Date().toISOString())
      .gt('ends_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(20);
    if (!error) setItems((data || []) as Announcement[]);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const banner = useMemo(() => items.find(item => !dismissed.includes(item.id)), [items, dismissed]);
  const dismiss = (id: string) => {
    const next = [...new Set([...dismissed, id])];
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-100))); } catch { /* storage unavailable */ }
  };

  return <>
    {banner && <section aria-label="Store announcement" className="relative z-30 border-b border-primary/15 bg-primary/5 px-4 py-3">
      <div className="container-shop flex items-start gap-3 pr-8">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><p className="font-semibold text-sm text-foreground">{banner.title}</p><p className="mt-1 text-sm text-muted-foreground">{banner.message}</p></div>
        <button type="button" onClick={() => dismiss(banner.id)} aria-label="Dismiss announcement" className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-background"><X className="h-4 w-4" /></button>
      </div>
    </section>}
    <div className="fixed right-3 top-[5.1rem] z-[65]">
      <Button type="button" variant="outline" size="icon" aria-label="Customer notifications" aria-expanded={open}
        className="relative rounded-full bg-background/95 shadow-md" onClick={() => setOpen(value => !value)}>
        <Bell className="h-5 w-5" />
        {items.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{items.length > 9 ? '9+' : items.length}</span>}
      </Button>
      {open && <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] max-h-[65vh] overflow-y-auto rounded-xl border bg-background p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Store notifications</p><button onClick={() => setOpen(false)} aria-label="Close notifications"><X className="h-4 w-4" /></button></div>
        {items.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">You're all caught up.</p> : <div className="space-y-3">
          {items.map(item => <article key={item.id} className="rounded-lg border p-3">
            <div className="flex items-start gap-2"><BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">Until {new Date(item.ends_at).toLocaleString()}</p></div></div>
            {!dismissed.includes(item.id) && <Button type="button" size="sm" variant="ghost" className="mt-2 h-7 px-2" onClick={() => dismiss(item.id)}><Check className="mr-1 h-3 w-3" />Dismiss banner</Button>}
          </article>)}
        </div>}
      </div>}
    </div>
  </>;
}
