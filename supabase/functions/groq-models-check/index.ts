import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async () => {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no key" }), { headers: corsHeaders });
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json();
  const ids = (body.data ?? []).map((m: { id: string }) => m.id);
  return new Response(JSON.stringify({ status: res.status, models: ids }), { headers: corsHeaders });
});
