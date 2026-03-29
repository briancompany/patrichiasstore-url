import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let triggerType = "scheduled";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.trigger) triggerType = body.trigger;
  } catch { /* default to scheduled */ }

  const stages: Array<{ name: string; status: string; duration_ms: number; detail?: string }> = [];
  const faults: Array<{ stage: string; error: string; resolved: boolean; resolution?: string }> = [];

  const runStage = async (name: string, fn: () => Promise<void>) => {
    const s = Date.now();
    try {
      await fn();
      stages.push({ name, status: "ok", duration_ms: Date.now() - s });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      stages.push({ name, status: "fault", duration_ms: Date.now() - s, detail: errMsg });
      
      // Auto-resolve: retry once
      const retryStart = Date.now();
      try {
        await fn();
        stages.push({ name: `${name} (retry)`, status: "ok", duration_ms: Date.now() - retryStart });
        faults.push({ stage: name, error: errMsg, resolved: true, resolution: "Auto-retry succeeded" });
      } catch (retryErr: unknown) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        faults.push({ stage: name, error: retryMsg, resolved: false });
      }
    }
  };

  // Create log entry
  const { data: logEntry } = await supabase
    .from("warmup_logs")
    .insert({ trigger_type: triggerType, status: "running" })
    .select("id")
    .single();

  const logId = logEntry?.id;

  // Stage 1: Database tables
  await runStage("Database tables", async () => {
    await Promise.all([
      supabase.from("orders").select("id").limit(1),
      supabase.from("products").select("id").limit(1),
      supabase.from("schools").select("id").limit(1),
      supabase.from("payments").select("id").limit(1),
      supabase.from("order_items").select("id").limit(1),
      supabase.from("order_tracking").select("id").limit(1),
      supabase.from("pricing_chart").select("id").limit(1),
      supabase.from("profiles").select("id").limit(1),
    ]);
  });

  // Stage 2: Storage buckets
  await runStage("Storage buckets", async () => {
    await Promise.all([
      supabase.storage.from("product-images").list("", { limit: 1 }),
      supabase.storage.from("school-logos").list("", { limit: 1 }),
    ]);
  });

  // Stage 3: Edge functions warm-up
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const fnHeaders = {
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${anonKey}`,
  };

  await runStage("Edge functions", async () => {
    const results = await Promise.allSettled([
      fetch(`${baseUrl}/functions/v1/health-check`, { method: "GET", headers: fnHeaders }),
      fetch(`${baseUrl}/functions/v1/confirm-payment`, {
        method: "POST", headers: fnHeaders, body: JSON.stringify({ warmup: true }),
      }),
      fetch(`${baseUrl}/functions/v1/pesapal-pay`, {
        method: "POST", headers: fnHeaders, body: JSON.stringify({ warmup: true }),
      }),
    ]);
    const failed = results.filter(r => r.status === "rejected");
    if (failed.length > 0) throw new Error(`${failed.length} function(s) failed to warm`);
  });

  // Stage 4: RPC functions
  await runStage("RPC functions", async () => {
    await Promise.allSettled([
      supabase.rpc("is_admin"),
      supabase.rpc("get_order_tracking_public", { _tracking_code: "PS-WARMUP" }),
    ]);
  });

  // Stage 5: Product cache refresh
  await runStage("Product cache", async () => {
    await supabase
      .from("products")
      .select("id, name, type, sizes, in_stock, image_url, stock_quantity")
      .eq("in_stock", true);
  });

  const totalDuration = Date.now() - startTime;
  const hasUnresolved = faults.some(f => !f.resolved);
  const finalStatus = faults.length === 0 ? "success" : hasUnresolved ? "partial" : "success";
  
  const summary = [
    `Warm-up ${finalStatus === "success" ? "completed successfully" : "completed with issues"}.`,
    `${stages.filter(s => s.status === "ok").length}/${stages.length} stages passed.`,
    `Total duration: ${totalDuration}ms.`,
    faults.length > 0 ? `Faults: ${faults.length} (${faults.filter(f => f.resolved).length} auto-resolved).` : "",
    `Triggered: ${triggerType} at ${new Date().toISOString()}.`,
  ].filter(Boolean).join(" ");

  // Update log entry
  if (logId) {
    await supabase
      .from("warmup_logs")
      .update({
        completed_at: new Date().toISOString(),
        status: finalStatus,
        stages: JSON.stringify(stages),
        faults: JSON.stringify(faults),
        summary,
        duration_ms: totalDuration,
      })
      .eq("id", logId);
  }

  return new Response(
    JSON.stringify({
      status: finalStatus,
      duration_ms: totalDuration,
      stages,
      faults,
      summary,
      log_id: logId,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
