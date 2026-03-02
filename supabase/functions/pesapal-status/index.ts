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
  if (!data.token) throw new Error(`Pesapal auth failed`);
  return data.token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderTrackingId, orderId } = await req.json();

    if (!orderTrackingId || !orderId) {
      return new Response(
        JSON.stringify({ error: "Missing orderTrackingId or orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already confirmed in DB first
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingPayment) {
      return new Response(
        JSON.stringify({ status: "confirmed", already_processed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query Pesapal for transaction status
    const token = await getAuthToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      }
    );
    const statusData = await statusRes.json();

    // status_code: 0 = Invalid, 1 = Completed, 2 = Failed, 3 = Reversed
    if (statusData.status_code === 1) {
      // Auto-confirm if IPN missed it
      const mpesaCode = statusData.confirmation_code || statusData.payment_account || orderTrackingId;

      await supabase
        .from("orders")
        .update({
          status: "confirmed",
          notes: `Pesapal Verified (poll) | Ref: ${mpesaCode}`,
        })
        .eq("id", orderId);

      const { data: order } = await supabase
        .from("orders")
        .select("customer_name, customer_phone")
        .eq("id", orderId)
        .maybeSingle();

      await supabase.from("payments").insert({
        order_id: orderId,
        amount: Number(statusData.amount || 0),
        mpesa_code: String(mpesaCode).toUpperCase().slice(0, 12).padEnd(8, "0"),
        customer_name: order?.customer_name || "Customer",
        customer_phone: order?.customer_phone || null,
      });

      return new Response(
        JSON.stringify({ status: "confirmed", confirmation_code: mpesaCode }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: statusData.status_code === 2 ? "failed" : "pending",
        pesapal_status: statusData.payment_status_description || "unknown",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("pesapal-status error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
