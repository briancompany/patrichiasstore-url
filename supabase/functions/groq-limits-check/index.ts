import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
// A ~9k-token prompt forces the 429 that reveals each model's true TPM cap.
const BIG = "word ".repeat(45000) + "\nSay OK.";

Deno.serve(async () => {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no key" }), { headers: corsHeaders });
  const out: Record<string, unknown>[] = [];
  for (const model of MODELS) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: BIG }], max_tokens: 2000 }),
    });
    const text = await res.text();
    out.push({ model, status: res.status, detail: text.slice(0, 400) });
  }
  return new Response(JSON.stringify(out), { headers: corsHeaders });
});
