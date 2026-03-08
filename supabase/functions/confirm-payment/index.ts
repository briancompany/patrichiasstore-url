import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function triggerReceiptEmail(orderId: string, paymentCode: string, paymentMethod: "pesapal" | "mpesa") {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ orderId, paymentCode, paymentMethod }),
    });
  } catch {
    // Non-fatal
  }
}

// Simple in-memory rate limiter for payment confirmations
const rateLimitMap = new Map<string, { count: number; reset: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10; // max 10 payment attempts per minute per IP
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit check
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Warmup ping — boot the function without doing real work
    if (body.warmup) {
      return new Response(JSON.stringify({ ok: true, warmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, amount, mpesaCode, customerName, customerPhone, paymentMethod } = body;

    if (!orderId || !amount || !mpesaCode || !customerName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(mpesaCode).trim().toUpperCase();
    if (code.length < 8 || code.length > 12) {
      return new Response(JSON.stringify({ error: "Invalid transaction code format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("mpesa_code", code)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "This transaction code has already been used." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderFetchError } = await supabase
      .from("orders")
      .select("id, total_amount, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderFetchError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status === "confirmed" || order.status === "completed") {
      return new Response(JSON.stringify({ error: "Order is already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(amount) !== Number(order.total_amount)) {
      return new Response(JSON.stringify({ error: "Payment amount mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const methodLabel = paymentMethod === "pesapal" ? "Pesapal" : "M-Pesa Paybill";
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        notes: `Payment Method: ${methodLabel} | Ref: ${code}`,
      })
      .eq("id", orderId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update order status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      amount: Number(amount),
      mpesa_code: code,
      customer_name: customerName,
      customer_phone: customerPhone || null,
    });

    if (paymentError) {
      console.error("Payment record error:", paymentError);
    }

    await triggerReceiptEmail(orderId, code, paymentMethod === "pesapal" ? "pesapal" : "mpesa");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
