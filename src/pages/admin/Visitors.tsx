import { useState, useMemo, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Users, Eye, ShoppingCart, MousePointerClick, RefreshCw,
  Clock, MonitorSmartphone, MessageSquare, Search, School, Package,
  ChevronRight, ArrowLeft, TrendingDown, Zap, Phone, Radio,
} from 'lucide-react';
import { format, subHours } from 'date-fns';

const RANGES = [
  { value: '24h', label: 'Last 24 hours', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { value: '30d', label: 'Last 30 days', hours: 24 * 30 },
];

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page view',
  school_viewed: 'School viewed',
  product_viewed: 'Product viewed',
  search: 'Search',
  add_to_cart: 'Added to cart',
  checkout_started: 'Checkout started',
  order_completed: 'Order placed',
  chatbot_opened: 'Chat opened',
  chatbot_message_sent: 'Chat message',
  whatsapp_click: 'WhatsApp click',
  click: 'Click',
  time_on_page: 'Time on page',
};

const EVENT_STYLES: Record<string, string> = {
  order_completed: 'text-primary border-primary/40 bg-primary/10',
  add_to_cart: 'text-primary border-primary/30 bg-primary/5',
  checkout_started: 'text-primary border-primary/20',
  whatsapp_click: 'text-foreground border-border',
  click: 'text-muted-foreground border-border',
};

type Summary = Record<string, any>;
type FeedRow = {
  created_at: string; device_type: string; event_type: string;
  metadata: any; page: string | null; school: string | null; visitor_id: string;
};
type VisitorRow = {
  visitor_id: string; events: number; sessions: number;
  first_seen: string; last_seen: string; device_type: string;
};
type TimelineRow = {
  created_at: string; event_type: string; metadata: any;
  page: string | null; product_id: string | null; school: string | null; x_pct: number | null; y_pct: number | null;
};
type ClickRow = { x_bucket: number; y_bucket: number; clicks: number };

function ago(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function shortDevice(d: string | null): string {
  if (!d) return '—';
  return d === 'mobile' ? '📱 mobile' : d === 'tablet' ? '📺 tablet' : '💻 desktop';
}

function pctBar(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export default function Visitors() {
  const [range, setRange] = useState('24h');
  const [tab, setTab] = useState('overview');
  const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null);
  const [clickPage, setClickPage] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();

  const { _from, _to } = useMemo(() => {
    const hours = RANGES.find((r) => r.value === range)?.hours ?? 24;
    return { _from: subHours(new Date(), hours).toISOString(), _to: new Date().toISOString() };
  }, [range]);

  const summaryQ = useQuery({
    queryKey: ['visitors-summary', range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visitor_summary', { _from, _to });
      if (error) throw error;
      return (data ?? {}) as Summary;
    },
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const feedQ = useQuery({
    queryKey: ['visitors-feed', range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visitor_feed', { _since: _from, _limit: 80 });
      if (error) throw error;
      return (data ?? []) as FeedRow[];
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const listQ = useQuery({
    queryKey: ['visitors-list', range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visitor_list', { _from, _to, _limit: 100 });
      if (error) throw error;
      return (data ?? []) as VisitorRow[];
    },
  });

  const pagesQ = useQuery({
    queryKey: ['visitors-pages', range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visitor_pages', { _from, _to });
      if (error) throw error;
      return (data ?? []) as { page: string; clicks: number }[];
    },
  });

  const clickMapQ = useQuery({
    queryKey: ['visitors-clickmap', range, clickPage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visitor_clickmap', { _from, _to, _page: clickPage });
      if (error) throw error;
      return (data ?? []) as ClickRow[];
    },
    enabled: clickPage !== '',
  });

  const timelineQ = useQuery({
    queryKey: ['visitors-timeline', selectedVisitor, range],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visitor_timeline', { _visitor_id: selectedVisitor!, _from, _to });
      if (error) throw error;
      return (data ?? []) as TimelineRow[];
    },
    enabled: selectedVisitor !== null,
  });

  // Refresh everything when the range changes
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['visitors-'] });
  }, [range, queryClient]);

  const s = summaryQ.data ?? {};
  const funnel = Array.isArray(s.funnel) ? s.funnel : [];
  const heatmap: { dow: number; hour: number; count: number }[] = Array.isArray(s.heatmap) ? s.heatmap : [];
  const heatMax = Math.max(1, ...heatmap.map((h) => h.count));
  const daily: { day: string; count: number }[] = Array.isArray(s.daily) ? s.daily : [];
  const deviceSplit: Record<string, number> = s.device_split ?? {};
  const topSchools: Record<string, number> = s.top_schools ?? {};
  const topProducts: Record<string, number> = s.top_products ?? {};
  const topSearches: Record<string, number> = s.top_searches ?? {};
  const topReferrers: Record<string, number> = s.top_referrers ?? {};
  const vnb: { page: string; label: string; views: number; last_seen: string }[] = s.viewed_not_bought ?? [];
  const clickMax = Math.max(1, ...(clickMapQ.data ?? []).map((c) => c.clicks));
  const pageClickMax = Math.max(1, ...(pagesQ.data ?? []).map((p) => p.clicks));

  const liveCount = feedQ.data?.filter((f) => Date.now() - new Date(f.created_at).getTime() < 5 * 60000).length ?? 0;

  const stats = [
    { icon: Users, label: 'Visitors', value: s.visitors ?? 0, sub: `${s.returning ?? 0} returning` },
    { icon: Radio, label: 'Live now', value: s.live_now ?? 0, sub: `${liveCount} active in feed` },
    { icon: Eye, label: 'Page views', value: s.pageviews ?? 0, sub: `${s.today ?? 0} today · ${s.week ?? 0} this week` },
    { icon: ShoppingCart, label: 'Conversion', value: `${s.conversion ?? 0}%`, sub: `${s.abandoned ?? 0} abandoned carts` },
    { icon: Phone, label: 'WhatsApp clicks', value: s.whatsapp_clicks ?? 0, sub: 'tap-to-chat interest' },
    { icon: MessageSquare, label: 'Chatbot', value: s.chatbot_messages ?? 0, sub: `${s.chatbot_opened ?? 0} chats opened` },
  ];

  return (
    <AdminLayout>
      <div className="font-mono w-full min-w-0">
        {/* Terminal header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              VISITOR TRACKING
              <span className="inline-block h-3 w-2 bg-primary animate-pulse" aria-hidden />
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              &gt; anonymous first-party analytics · no cookies · no third parties
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
              className="gap-1.5"
            >
              <Radio className="h-3.5 w-3.5" />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['visitors-'] })}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3 mb-4">
          {summaryQ.isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            : stats.map((st) => (
              <Card key={st.label} className="border-border">
                <CardContent className="p-3">
                  <st.icon className="h-4 w-4 text-primary mb-1.5" />
                  <div className="text-lg md:text-2xl font-bold text-foreground leading-none">{st.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{st.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{st.sub}</div>
                </CardContent>
              </Card>
            ))}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="feed">Live Feed{liveCount > 0 ? ` (${liveCount})` : ''}</TabsTrigger>
            <TabsTrigger value="clicks">Click Map</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
            <TabsTrigger value="vnb">Didn't Buy</TabsTrigger>
          </TabsList>

          {/* ================= OVERVIEW ================= */}
          <TabsContent value="overview" className="mt-3 space-y-4 w-full min-w-0">
            {/* Funnel */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-primary" />BUYING FUNNEL — sessions</CardTitle>
                <CardDescription>Where shoppers drop off, from first look to paid order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {funnel.map((step: { step: string; count: number }, i: number) => {
                  const prev = i > 0 ? funnel[i - 1].count : null;
                  const drop = prev !== null && prev > 0 ? Math.round(100 - (step.count / prev) * 100) : null;
                  const width = Math.min(100, funnel[0]?.count ? (step.count / funnel[0].count) * 100 : 0);
                  return (
                    <div key={step.step} className="flex items-center gap-3 min-w-0">
                      <div className="w-28 md:w-36 shrink-0 text-xs text-foreground">{step.step}</div>
                      <div className="flex-1 min-w-0 h-7 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{ width: `${Math.max(1.5, width)}%`, backgroundColor: 'hsl(var(--primary) / 0.75)' }}
                        />
                      </div>
                      <div className="w-24 md:w-32 shrink-0 text-right">
                        <span className="text-sm font-bold text-foreground">{step.count}</span>
                        {drop !== null && <span className="text-[10px] text-muted-foreground ml-1.5">-{drop}%</span>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2 w-full min-w-0">
              {/* Day × hour heatmap */}
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />TRAFFIC — day × hour (Nairobi time)</CardTitle>
                  <CardDescription>When shoppers visit — plan stock alerts and sales around peak hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="border-separate border-spacing-px">
                      <tbody>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dow) => (
                          <tr key={day}>
                            <td className="text-[9px] text-muted-foreground pr-1">{day}</td>
                            {Array.from({ length: 24 }).map((_, hour) => {
                              const cell = heatmap.find((h) => h.dow === dow && h.hour === hour);
                              const a = cell ? 0.08 + (cell.count / heatMax) * 0.9 : 0;
                              return (
                                <td key={hour}>
                                  <div
                                    title={cell ? `${day} ${hour}:00 — ${cell.count} events` : `${day} ${hour}:00`}
                                    className="h-3.5 w-3.5 rounded-sm border border-border/40"
                                    style={{ backgroundColor: `hsl(var(--primary) / ${a.toFixed(2)})` }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr>
                          <td />
                          {[0, 6, 12, 18, 23].map((h) => (
                            <td key={h} className="text-[8px] text-muted-foreground text-center" colSpan={h === 0 ? 1 : h === 23 ? 1 : undefined}>
                              {h === 0 ? '0h' : h === 6 ? '6h' : h === 12 ? '12h' : h === 18 ? '18h' : '23h'}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Daily visitors */}
                  {daily.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily visitors</div>
                      {daily.slice(-14).map((d) => (
                        <div key={d.day} className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-muted-foreground w-20 shrink-0">{d.day}</span>
                          <div className="flex-1 min-w-0 h-2.5 rounded bg-muted overflow-hidden">
                            <div
                              className="h-full rounded"
                              style={{ width: `${Math.max(2, (d.count / Math.max(1, ...daily.map((x) => x.count))) * 100)}%`, backgroundColor: 'hsl(var(--primary) / 0.7)' }}
                            />
                          </div>
                          <span className="text-[10px] text-foreground w-8 text-right">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tops + devices */}
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4 text-primary" />WHAT PEOPLE LOOK AT</CardTitle>
                  <CardDescription>Top schools, products, searches and devices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TopList icon={<School className="h-3 w-3" />} title="Top schools" data={topSchools} />
                  <TopList icon={<Package className="h-3 w-3" />} title="Top products" data={topProducts} />
                  <TopList icon={<Search className="h-3 w-3" />} title="Top searches" data={topSearches} />
                  <TopList icon={<MonitorSmartphone className="h-3 w-3" />} title="Devices" data={deviceSplit} />
                  <TopList icon={<Activity className="h-3 w-3" />} title="Referrers" data={topReferrers} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================= LIVE FEED ================= */}
          <TabsContent value="feed" className="mt-3 w-full min-w-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />LIVE ACTIVITY
                  <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" aria-hidden />
                </CardTitle>
                <CardDescription>Every tracked action, newest first — like a threat log</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded border border-border divide-y divide-border max-h-[70vh] overflow-y-auto">
                  {feedQ.isLoading && <div className="p-4 text-xs text-muted-foreground">loading…</div>}
                  {feedQ.data?.length === 0 && <div className="p-4 text-xs text-muted-foreground">No activity yet in this range.</div>}
                  {feedQ.data?.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-[11px] min-w-0">
                      <span className="text-muted-foreground shrink-0 w-16">{format(new Date(f.created_at), 'HH:mm:ss')}</span>
                      <Badge variant="outline" className={`shrink-0 text-[9px] px-1.5 ${EVENT_STYLES[f.event_type] ?? 'text-muted-foreground border-border'}`}>
                        {(EVENT_LABELS[f.event_type] ?? f.event_type).toUpperCase()}
                      </Badge>
                      <span className="text-foreground truncate flex-1 min-w-0">
                        {f.metadata?.name || f.metadata?.query || f.page?.replace(/\?.*/, '') || '—'}
                        {f.metadata?.size ? ` · size ${f.metadata.size}` : ''}
                        {f.metadata?.quantity ? ` · ×${f.metadata.quantity}` : ''}
                      </span>
                      {f.school && <span className="text-muted-foreground truncate hidden md:inline max-w-32">{f.school}</span>}
                      <span className="text-muted-foreground shrink-0 hidden sm:inline">{shortDevice(f.device_type)}</span>
                      <span className="text-muted-foreground shrink-0 w-14 text-right">{ago(f.created_at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= CLICK MAP ================= */}
          <TabsContent value="clicks" className="mt-3 w-full min-w-0">
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-primary" />CLICK HEATMAP</CardTitle>
                <CardDescription>Pick a page to see where people tap — hot spots earn your buttons</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                <Select
                  value={clickPage}
                  onValueChange={setClickPage}
                >
                  <SelectTrigger className="w-full md:w-96 mb-4"><SelectValue placeholder="Choose a page…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(pagesQ.data ?? []).map((p) => (
                      <SelectItem key={p.page} value={p.page}>
                        {p.page || '/'} — {p.clicks} clicks
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {clickPage === '' && (
                  <div className="text-xs text-muted-foreground">
                    No page chosen yet. Pages with the most clicks:{' '}
                    <span className="inline-flex flex-wrap gap-1.5 mt-2">
                      {(pagesQ.data ?? []).slice(0, 12).map((p) => (
                        <Badge key={p.page} variant="outline" className="text-[10px] cursor-pointer" onClick={() => setClickPage(p.page)}>
                          {p.page || '/'} · {p.clicks}
                        </Badge>
                      ))}
                    </span>
                  </div>
                )}

                {clickPage !== '' && (
                  <>
                    <div className="relative w-full max-w-2xl aspect-video rounded border border-border bg-muted/40 overflow-hidden">
                      {clickMapQ.isLoading && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">loading clicks…</div>}
                      {clickMapQ.data?.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No clicks recorded on this page in this range.</div>}
                      {(clickMapQ.data ?? []).map((c) => {
                        const a = 0.15 + (c.clicks / clickMax) * 0.85;
                        return (
                          <div
                            key={`${c.x_bucket}-${c.y_bucket}`}
                            title={`${c.clicks} clicks`}
                            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${(c.x_bucket / 20) * 100 + 2.5}%`,
                              top: `${(c.y_bucket / 20) * 100 + 2.5}%`,
                              width: '10%',
                              height: '10%',
                              backgroundColor: `hsl(var(--primary) / ${a.toFixed(2)})`,
                              filter: 'blur(2px)',
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      {clickPage || '/'} · {(clickMapQ.data ?? []).reduce((t, c) => t + c.clicks, 0)} clicks mapped
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= VISITORS ================= */}
          <TabsContent value="visitors" className="mt-3 w-full min-w-0">
            {selectedVisitor === null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />VISITORS ({listQ.data?.length ?? 0})</CardTitle>
                  <CardDescription>Tap a visitor to see everything they did</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded border border-border divide-y divide-border max-h-[65vh] overflow-y-auto">
                    {listQ.data?.length === 0 && <div className="p-4 text-xs text-muted-foreground">No visitors in this range.</div>}
                    {listQ.data?.map((v) => (
                      <button
                        key={v.visitor_id}
                        onClick={() => setSelectedVisitor(v.visitor_id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-muted/60 min-w-0"
                      >
                        <span className="font-mono text-muted-foreground shrink-0">{v.visitor_id.slice(0, 8)}…</span>
                        <span className="text-foreground">{shortDevice(v.device_type)}</span>
                        <span className="text-muted-foreground">{v.events} events · {v.sessions} session{v.sessions === 1 ? '' : 's'}</span>
                        <span className="flex-1" />
                        <span className="text-muted-foreground hidden sm:inline">last seen {ago(v.last_seen)}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedVisitor(null)} className="gap-1">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                    <CardTitle className="text-sm font-mono">{selectedVisitor.slice(0, 12)}…</CardTitle>
                  </div>
                  <CardDescription>Full timeline — everything this visitor did in the range</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-l-2 border-primary/30 ml-2 pl-4 space-y-2 max-h-[65vh] overflow-y-auto">
                    {timelineQ.isLoading && <div className="text-xs text-muted-foreground">loading…</div>}
                    {timelineQ.data?.length === 0 && <div className="text-xs text-muted-foreground">No events in this range.</div>}
                    {timelineQ.data?.map((t, i) => (
                      <div key={i} className="relative text-[11px] min-w-0">
                        <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-primary border border-background" />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-muted-foreground">{format(new Date(t.created_at), 'MMM d HH:mm:ss')}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 ${EVENT_STYLES[t.event_type] ?? 'text-muted-foreground border-border'}`}>
                            {(EVENT_LABELS[t.event_type] ?? t.event_type).toUpperCase()}
                          </Badge>
                          {t.page && <span className="text-foreground">{t.page.replace(/\?.*/, '')}</span>}
                          {t.metadata?.name && <span className="text-muted-foreground truncate max-w-48">{t.metadata.name}</span>}
                          {t.metadata?.query && <span className="text-muted-foreground">"{t.metadata.query}"</span>}
                          {t.metadata?.size && <span className="text-muted-foreground">size {t.metadata.size}</span>}
                          {t.metadata?.seconds !== undefined && <span className="text-muted-foreground">{Math.round(t.metadata.seconds / 60)}m on page</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ================= VIEWED BUT DIDN'T BUY ================= */}
          <TabsContent value="vnb" className="mt-3 w-full min-w-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" />VIEWED BUT DIDN'T BUY</CardTitle>
                <CardDescription>Products shoppers looked at but never ordered — follow up or run a flash sale</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded border border-border divide-y divide-border">
                  {vnb.length === 0 && <div className="p-4 text-xs text-muted-foreground">Nothing here yet — every product viewer placed an order, or there were no views.</div>}
                  {vnb.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-[11px] min-w-0">
                      <span className="text-foreground truncate flex-1 min-w-0">{p.label || p.page}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{p.views} views</Badge>
                      <span className="text-muted-foreground shrink-0 hidden sm:inline w-20 text-right">{ago(p.last_seen)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function TopList({ icon, title, data }: { icon: React.ReactNode; title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">{icon} {title}</div>
      {entries.length === 0 && <div className="text-[11px] text-muted-foreground">— nothing yet</div>}
      <div className="space-y-1">
        {entries.slice(0, 6).map(([k, n]) => (
          <div key={k} className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-foreground truncate flex-1 min-w-0">{k}</span>
            <div className="w-16 shrink-0 h-2 rounded bg-muted overflow-hidden">
              <div className="h-full rounded" style={{ width: `${Math.max(4, (n / max) * 100)}%`, backgroundColor: 'hsl(var(--primary) / 0.6)' }} />
            </div>
            <span className="text-[11px] text-muted-foreground w-10 text-right shrink-0">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

