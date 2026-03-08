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

  // Single client instance — reuse for all checks
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Run all checks in PARALLEL instead of sequential
  const [dbResult, storageResult] = await Promise.allSettled([
    (async () => {
      const t = Date.now();
      const { error } = await supabase.from("products").select("id").limit(1);
      return { ok: !error, latencyMs: Date.now() - t, error: error?.message };
    })(),
    (async () => {
      const t = Date.now();
      const { error } = await supabase.storage.from("product-images").list("", { limit: 1 });
      return { ok: !error, latencyMs: Date.now() - t, error: error?.message };
    })(),
  ]);

  const checks = {
    database: dbResult.status === "fulfilled"
      ? dbResult.value
      : { ok: false, latencyMs: Date.now() - start, error: "Promise rejected" },
    storage: storageResult.status === "fulfilled"
      ? storageResult.value
      : { ok: false, latencyMs: Date.now() - start, error: "Promise rejected" },
  };

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
