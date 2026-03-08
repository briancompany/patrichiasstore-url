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

  const start = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};

  // Database check
  try {
    const t = Date.now();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.from("products").select("id").limit(1);
    checks.database = { ok: !error, latencyMs: Date.now() - t, error: error?.message };
  } catch (e) {
    checks.database = { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }

  // Storage check
  try {
    const t = Date.now();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.storage.from("product-images").list("", { limit: 1 });
    checks.storage = { ok: !error, latencyMs: Date.now() - t, error: error?.message };
  } catch (e) {
    checks.storage = { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return new Response(
    JSON.stringify({
      status: allOk ? "healthy" : "degraded",
      totalLatencyMs: Date.now() - start,
      checks,
      timestamp: new Date().toISOString(),
    }),
    {
      status: allOk ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
