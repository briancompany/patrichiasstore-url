import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PESAPAL_BASE = "https://pay.pesapal.com/v3/api";

async function getAuthToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: Deno.env.get("PESAPAL_CONSUMER_KEY"),
      consumer_secret: Deno.env.get("PESAPAL_CONSUMER_SECRET"),
    }),
  });
  const data = await res.json();
  if (!data.token) throw new Error("Pesapal auth failed");
  return data.token as string;
}

async function registerIPN(token: string, ipnUrl: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  const data = await res.json();
  if (!data.ipn_id) throw new Error("IPN registration failed");
  return data.ipn_id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Warmup ping — boot the function without doing real work
    if (body.warmup) {
      return new Response(JSON.stringify({ ok: true, warmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, amount, customerName, customerPhone, callbackUrl } = body;

    if (!orderId || !amount || !customerName || !callbackUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic input validation to prevent abuse
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 1_000_000) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: if order already paid, reject. If already has tracking, do not duplicate.
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, status, notes")
      .eq("id", orderId)
      .maybeSingle();

    if (!existingOrder) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingOrder.status === "confirmed") {
      return new Response(JSON.stringify({ error: "Order already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getAuthToken();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const ipnUrl = `${supabaseUrl}/functions/v1/pesapal-ipn`;
    const ipnId = await registerIPN(token, ipnUrl);

    const orderPayload = {
      id: orderId,
      currency: "KES",
      amount: Number(amount),
      description: `Patrichia's Store Order - ${orderId.slice(0, 8)}`,
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: {
        phone_number: customerPhone || "",
        first_name: customerName.split(" ")[0] || customerName,
        last_name: customerName.split(" ").slice(1).join(" ") || "",
      },
    };

    const submitRes = await fetch(`${PESAPAL_BASE}/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const submitData = await submitRes.json();

    if (!submitData.redirect_url) {
      return new Response(JSON.stringify({ error: "Failed to create Pesapal payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("orders")
      .update({
        notes: `Pesapal Tracking: ${submitData.order_tracking_id}`,
        status: "awaiting_payment",
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        redirect_url: submitData.redirect_url,
        order_tracking_id: submitData.order_tracking_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ error: "Unable to initiate payment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
