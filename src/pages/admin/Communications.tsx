import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BellRing, CalendarClock, Megaphone, PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type AnnouncementType = 'maintenance' | 'completed';
type Announcement = {
  id: string; title: string; message: string; announcement_type: AnnouncementType;
  starts_at: string; ends_at: string; is_active: boolean;
};

const templates: Record<AnnouncementType, { title: string; message: string }> = {
  maintenance: {
    title: 'We’re Improving Your Patrichia Experience',
    message: 'Dear Customer, we’re currently making improvements to Patrichia Store to serve you better. You may notice occasional interruptions while this work is underway. We sincerely apologise for any inconvenience and appreciate your patience and understanding.',
  },
  completed: {
    title: 'Great News! Improvements Are Complete',
    message: 'We’re delighted to let you know that our scheduled improvements are complete. You can now enjoy the enhanced Patrichia Store experience. Thank you for your patience, continued support and for choosing Patrichia.',
  },
};

const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export default function AdminCommunications() {
  const [type, setType] = useState<AnnouncementType>('maintenance');
  const [title, setTitle] = useState(templates.maintenance.title);
  const [message, setMessage] = useState(templates.maintenance.message);
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [items, setItems] = useState<Announcement[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any).from('store_announcements')
      .select('id,title,message,announcement_type,starts_at,ends_at,is_active')
      .order('created_at', { ascending: false }).limit(30);
    if (error) { toast.error('Could not load announcements. Apply the latest database migration first.'); return; }
    setItems((data || []) as Announcement[]);
  };

  useEffect(() => { void load(); }, []);

  const chooseType = (next: AnnouncementType) => {
    setType(next); setTitle(templates[next].title); setMessage(templates[next].message);
  };

  const publish = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Add a title and message first.'); return; }
    const start = new Date(startsAt); const end = new Date(endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      toast.error('The end time must be later than the start time.'); return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('store_announcements').insert({
      title: title.trim(), message: message.trim(), announcement_type: type,
      starts_at: start.toISOString(), ends_at: end.toISOString(), is_active: true,
    });
    setSaving(false);
    if (error) { toast.error('Could not publish announcement. Check that the announcement migration is applied.'); return; }
    toast.success('Customer announcement scheduled successfully.');
    await load();
  };

  const toggle = async (item: Announcement) => {
    const { error } = await (supabase as any).from('store_announcements')
      .update({ is_active: !item.is_active }).eq('id', item.id);
    if (error) { toast.error('Could not update announcement.'); return; }
    await load();
  };

  return <AdminLayout>
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-bold">Customer Communications</h1>
        <p className="text-muted-foreground">Schedule non-intrusive store announcements for customers.</p></div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Create announcement</CardTitle>
          <CardDescription>Customers can dismiss the banner; the message remains available from the notification bell until it expires.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant={type === 'maintenance' ? 'default' : 'outline'} onClick={() => chooseType('maintenance')}>Maintenance in progress</Button>
            <Button type="button" variant={type === 'completed' ? 'default' : 'outline'} onClick={() => chooseType('completed')}>Work completed</Button>
          </div>
          <div><Label>Announcement title</Label><Input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} /></div>
          <div><Label>Message</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={600} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Show from</Label><Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></div>
            <div><Label>Show until</Label><Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></div>
          </div>
          <Button onClick={publish} disabled={saving} className="w-full"><CalendarClock className="mr-2 h-4 w-4" />{saving ? 'Scheduling…' : 'Schedule announcement'}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Recent announcements</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No announcements have been created yet.</p>}
          {items.map(item => <div key={item.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.announcement_type === 'maintenance' ? 'Maintenance' : 'Completed'} · {new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()}</p></div>
              <Button size="sm" variant="outline" onClick={() => void toggle(item)}>{item.is_active ? <><PauseCircle className="mr-1 h-4 w-4" />Deactivate</> : <><PlayCircle className="mr-1 h-4 w-4" />Activate</>}</Button></div>
            <p className="text-sm text-muted-foreground">{item.message}</p>
          </div>)}
        </CardContent>
      </Card>
    </div>
  </AdminLayout>;
}
