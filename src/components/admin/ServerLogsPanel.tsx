import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Activity, Clock, RefreshCw, ShieldAlert, type LucideIcon } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { ServerLogRow } from '@/lib/server-log';

export function ServerLogsPanel() {
  const [logs, setLogs] = useState<ServerLogRow[]>([]);
  const [severity, setSeverity] = useState('all');
  const [eventType, setEventType] = useState('all');
  const [period, setPeriod] = useState('24');
  const [search, setSearch] = useState('');
  const alerted = useRef(new Set<string>());

  const load = async () => {
    const since = new Date(Date.now() - Number(period) * 3_600_000).toISOString();
    const { data, error } = await supabase.from('server_logs').select('*').gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(500);
    if (error) toast.error('Could not load server logs'); else setLogs((data || []) as unknown as ServerLogRow[]);
  };
  useEffect(() => { load(); }, [period]);
  useEffect(() => {
    const channel = supabase.channel('admin-server-monitor').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'server_logs' }, (payload) => {
      const row = payload.new as ServerLogRow;
      setLogs((current) => [row, ...current].slice(0, 500));
      if (row.severity === 'critical' && !alerted.current.has(row.id)) { alerted.current.add(row.id); toast.error(`Critical security alert: ${row.message}`); }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const types = Array.from(new Set(logs.map((log) => log.event_type))).sort();
  const filtered = logs.filter((log) => (severity === 'all' || log.severity === severity) && (eventType === 'all' || log.event_type === eventType) && `${log.message} ${log.endpoint || ''} ${log.event_type}`.toLowerCase().includes(search.toLowerCase()));
  const errorCount = logs.filter((log) => log.severity === 'error' || log.severity === 'critical' || (log.status_code || 0) >= 400).length;
  const criticalCount = logs.filter((log) => log.severity === 'critical').length;
  const slow = logs.filter((log) => (log.response_time_ms || 0) >= 2500).length;
  const suspicious = logs.filter((log) => log.event_type.includes('security') || log.event_type.includes('auth_failed')).length;
  const chart = useMemo(() => {
    const buckets = new Map<string, { time: string; traffic: number; errors: number; response: number; samples: number }>();
    [...logs].reverse().forEach((log) => { const time = new Date(log.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const value = buckets.get(time) || { time, traffic: 0, errors: 0, response: 0, samples: 0 }; value.traffic += 1; if ((log.status_code || 0) >= 400 || ['error', 'critical'].includes(log.severity)) value.errors += 1; if (log.response_time_ms !== null) { value.response += log.response_time_ms; value.samples += 1; } buckets.set(time, value); });
    return Array.from(buckets.values()).slice(-30).map((value) => ({ ...value, response: value.samples ? Math.round(value.response / value.samples) : 0 }));
  }, [logs]);
  const badgeClass = (value: string) => value === 'critical' ? 'bg-destructive text-destructive-foreground' : value === 'error' ? 'bg-destructive/15 text-destructive' : value === 'warning' ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary';

  return <div className="space-y-4">
    {criticalCount > 0 && <div className="border border-destructive bg-destructive/10 p-4 rounded-md flex gap-3"><ShieldAlert className="h-5 w-5 text-destructive" /><div><p className="font-bold text-destructive">{criticalCount} critical event{criticalCount === 1 ? '' : 's'} detected</p><p className="text-sm text-foreground">Review the event feed immediately.</p></div></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([
      ['Recent activity', logs.length, Activity], ['Errors', errorCount, AlertTriangle], ['Slow requests', slow, Clock], ['Suspicious', suspicious, ShieldAlert],
    ] as [string, number, LucideIcon][]).map(([label, value, Icon]) => <Card key={label}><CardContent className="p-4 flex justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Traffic, errors & response time</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" /><YAxis /><Tooltip /><Area type="monotone" dataKey="traffic" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" /><Area type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.12)" /><Area type="monotone" dataKey="response" stroke="hsl(var(--accent-foreground))" fill="transparent" /></AreaChart></ResponsiveContainer></CardContent></Card>
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Live event feed</CardTitle><Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs" /><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['all','info','warning','error','critical'].map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All severity' : value.toUpperCase()}</SelectItem>)}</SelectContent></Select><Select value={eventType} onValueChange={setEventType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All event types</SelectItem>{types.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Select value={period} onValueChange={setPeriod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Last hour</SelectItem><SelectItem value="24">Last 24 hours</SelectItem><SelectItem value="168">Last 7 days</SelectItem><SelectItem value="720">Last 30 days</SelectItem></SelectContent></Select></div>
      <div className="max-h-[520px] overflow-auto divide-y divide-border">{filtered.length === 0 ? <p className="py-10 text-center text-muted-foreground">No matching events</p> : filtered.map((log) => <div key={log.id} className="py-3 grid gap-2 md:grid-cols-[150px_100px_1fr_120px] items-start"><span className="text-xs text-muted-foreground">{new Date(log.occurred_at).toLocaleString()}</span><Badge className={badgeClass(log.severity)}>{log.severity.toUpperCase()}</Badge><div><p className="font-medium text-sm">{log.message}</p><p className="text-xs text-muted-foreground">{log.event_type}{log.endpoint ? ` · ${log.method || ''} ${log.endpoint}` : ''}{log.ip_address ? ` · IP ${log.ip_address}` : ''}</p></div><div className="text-xs text-muted-foreground md:text-right">{log.status_code ? `HTTP ${log.status_code}` : ''}{log.response_time_ms !== null ? ` · ${log.response_time_ms}ms` : ''}</div></div>)}</div>
    </CardContent></Card>
  </div>;
}