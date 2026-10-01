import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function ChatbotAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['chatbot-analytics'],
    queryFn: async () => {
      const [{ count: total }, { count: resolvedCount }, { data: logs }, { data: leads }] = await Promise.all([
        supabase.from('chat_sessions').select('id', { count: 'exact', head: true }).gt('message_count', 0),
        supabase.from('chat_sessions').select('id', { count: 'exact', head: true }).gt('message_count', 0).eq('resolved', true),
        supabase.from('chat_logs').select('response_ms, schools_queried, failed, error, query_preview, created_at').order('created_at', { ascending: false }).limit(1000),
        supabase.from('chat_leads').select('name, phone, school, interest, created_at').order('created_at', { ascending: false }).limit(20),
      ]);
      const ok = (logs ?? []).filter((l) => !l.failed && l.response_ms);
      const avg = ok.length ? Math.round(ok.reduce((a, l) => a + (l.response_ms ?? 0), 0) / ok.length) : 0;
      const schools = new Map<string, number>();
      (logs ?? []).forEach((l) => (l.schools_queried ?? []).forEach((s: string) => schools.set(s, (schools.get(s) ?? 0) + 1)));
      return {
        total: total ?? 0,
        avg,
        rate: total ? Math.round(((resolvedCount ?? 0) / total) * 100) : 0,
        top: [...schools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
        failed: (logs ?? []).filter((l) => l.failed).slice(0, 20),
        leads: leads ?? [],
      };
    },
    refetchInterval: 60000,
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading chatbot data…</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total conversations</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Average response time</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{(data.avg / 1000).toFixed(1)}s</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Resolution rate</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.rate}%</CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top queried schools</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {data.top.length ? data.top.map(([s, n]) => (
              <div key={s} className="flex justify-between capitalize"><span>{s}</span><Badge variant="secondary">{n}</Badge></div>
            )) : <p className="text-muted-foreground">No school searches yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Failed queries</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.failed.length ? data.failed.map((f, i) => (
              <div key={i} className="border-b pb-1">
                <p className="font-medium">{f.query_preview}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(f.created_at), 'PPp')} · {f.error}</p>
              </div>
            )) : <p className="text-muted-foreground">No failures.</p>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Interested customers (leads)</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.leads.length ? data.leads.map((l, i) => (
            <div key={i} className="border-b pb-1">
              <p className="font-medium">{l.name ?? 'Unknown'} {l.phone ? `· ${l.phone}` : ''} {l.school ? `· ${l.school}` : ''}</p>
              <p className="text-xs text-muted-foreground">{l.interest} · {format(new Date(l.created_at), 'PPp')}</p>
            </div>
          )) : <p className="text-muted-foreground">No leads yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
