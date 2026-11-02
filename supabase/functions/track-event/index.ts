import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

// Anonymous, first-party visitor analytics. Stores NO IPs, phones or emails.
const ALLOWED_TYPES = new Set([
  "page_view",
  "school_viewed",
  "product_viewed",
  "search",
  "add_to_cart",
  "checkout_started",
  "order_completed",
  "chatbot_opened",
  "chatbot_message_sent",
  "whatsapp_click",
  "click",
  "time_on_page",
]);

const RATE_PER_VISITOR_PER_HOUR = 600;
const MAX_BATCH = 40;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const clean = (v: unknown, max: number): string | null => {
  const s = String(v ?? "").replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return s ? s.slice(0, max) : null;
};

const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const MetaSchema = z.record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()]));

const EventSchema = z.object({
  type: z.string(),
  visitorId: IdSchema,
  sessionId: IdSchema,
  page: z.string().max(200).optional(),
  school: z.string().max(120).optional(),
  productId: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  xPct: z.number().min(0).max(100).optional(),
  yPct: z.number().min(0).max(100).optional(),
  deviceType: z.enum(["mobile", "desktop", "tablet"]).optional(),
  referrer: z.string().max(200).optional(),
  seconds: z.number().min(0).max(24 * 3600).optional(),
  scrollPct: z.number().min(0).max(100).optional(),
  meta: MetaSchema.optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: { events?: unknown[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!Array.isArray(payload.events) || payload.events.length === 0 || payload.events.length > MAX_BATCH) {
    return json({ error: "Invalid batch" }, 400);
  }

  const rows: Record<string, unknown>[] = [];
  const perVisitor = new Map<string, number>();
  for (const raw of payload.events) {
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) continue;
    const e = parsed.data;
    if (!ALLOWED_TYPES.has(e.type)) continue;
    perVisitor.set(e.visitorId, (perVisitor.get(e.visitorId) ?? 0) + 1);
    const meta = e.meta ? Object.fromEntries(Object.entries(e.meta).map(([k, v]) => [clean(k, 40) ?? k, typeof v === "string" ? clean(v, 200) : v])) : {};
    rows.push({
      visitor_id: e.visitorId,
      session_id: e.sessionId,
      event_type: e.type,
      page: e.page ? clean(e.page, 200) : null,
      school: e.school ? clean(e.school, 120) : null,
      product_id: e.productId ?? null,
      x_pct: e.xPct ?? null,
      y_pct: e.yPct ?? null,
      device_type: e.deviceType ?? null,
      referrer: e.referrer ? clean(e.referrer, 200) : null,
      metadata: {
        ...meta,
        ...(e.seconds !== undefined ? { seconds: Math.round(e.seconds) } : {}),
        ...(e.scrollPct !== undefined ? { scroll_pct: Math.round(e.scrollPct) } : {}),
      },
    });
  }
  if (!rows.length) return json({ ok: true, stored: 0 });

  // Rate limit: count each visitor's events in the last hour.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const ids = [...perVisitor.keys()];
  const { data: counts, error: countErr } = await admin
    .from("visitor_events")
    .select("visitor_id", { count: "exact", head: false })
    .in("visitor_id", ids)
    .gte("created_at", hourAgo);
  if (countErr) return json({ error: "Storage unavailable" }, 503);
  const seen = new Map<string, number>();
  for (const r of counts ?? []) seen.set(r.visitor_id, (seen.get(r.visitor_id) ?? 0) + 1);

  const toStore = rows.filter((r) => {
    const id = r.visitor_id as string;
    const before = seen.get(id) ?? 0;
    const batch = perVisitor.get(id) ?? 0;
    return before < RATE_PER_VISITOR_PER_HOUR && before + batch <= RATE_PER_VISITOR_PER_HOUR + MAX_BATCH;
  });
  if (!toStore.length) return json({ ok: true, stored: 0, throttled: true });

  const { error } = await admin.from("visitor_events").insert(toStore);
  if (error) return json({ error: "Storage unavailable" }, 503);
  return json({ ok: true, stored: toStore.length });
});
