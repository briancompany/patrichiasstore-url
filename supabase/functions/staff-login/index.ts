import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(input: string): string {
  const digits = String(input || "").replace(/[^0-9+]/g, "");
  if (digits.startsWith("+254")) return digits.slice(1);
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

// Basic rate limiter
const rateMap = new Map<string, { count: number; reset: number }>();
function isRateLimited(ip: string) {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now > e.reset) {
    rateMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  e.count++;
  return e.count > 8;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip =
    req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many attempts. Try again shortly." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    if (body?.warmup) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizePhone(String(body.phone || ""));

    if (!email || !phone) {
      return new Response(JSON.stringify({ error: "Email and phone required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: staff } = await admin
      .from("staff_users")
      .select("user_id, email, phone, is_active, role")
      .eq("email", email)
      .eq("phone", phone)
      .maybeSingle();

    if (!staff || !staff.is_active) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mint a magic link server-side, then return the hashed token
    // so the client can exchange it for a real session via verifyOtp.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: "Login unavailable, try again" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        token_hash: linkData.properties.hashed_token,
        email,
        role: staff.role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});