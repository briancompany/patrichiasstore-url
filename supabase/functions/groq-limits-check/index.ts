import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

Deno.serve(async () => {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no key" }), { headers: corsHeaders });
  const out: Record<string, unknown>[] = [];
  for (const model of MODELS) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
    });
    out.push({
      model,
      status: res.status,
      tpm: res.headers.get("x-ratelimit-limit-tpm"),
      rpd: res.headers.get("x-ratelimit-limit-rpd") ?? res.headers.get("x-ratelimit-limit-requests"),
      body: res.ok ? undefined : (await res.text()).slice(0, 120),
    });
  }
  return new Response(JSON.stringify(out), { headers: corsHeaders });
});
