import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function triggerReceiptEmail(orderId: string, paymentCode: string) {
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
      body: JSON.stringify({ orderId, paymentCode, paymentMethod: "pesapal" }),
    });
  } catch {
    // Non-fatal
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const orderTrackingId = url.searchParams.get("OrderTrackingId");
  const orderMerchantReference = url.searchParams.get("OrderMerchantReference");
  const orderNotificationType = url.searchParams.get("OrderNotificationType");

  if (!orderTrackingId || !orderMerchantReference) {
    return new Response(JSON.stringify({ status: "error", message: "Missing parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const token = await getAuthToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const statusData = await statusRes.json();

    if (statusData.status_code !== 1) {
      return new Response(
        JSON.stringify({ orderNotificationType, orderTrackingId, status: "received" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const orderId = orderMerchantReference;
    const paymentCode = String(
      statusData.confirmation_code || statusData.payment_account || orderTrackingId,
    )
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12)
      .padEnd(8, "0");
    const amount = Number(statusData.amount || 0);

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ orderNotificationType, orderTrackingId, status: "already_processed" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("orders")
      .update({
        status: "confirmed",
        notes: `Pesapal Auto-Verified | Ref: ${paymentCode} | TrackingId: ${orderTrackingId}`,
      })
      .eq("id", orderId);

    const { data: order } = await supabase
      .from("orders")
      .select("customer_name, customer_phone")
      .eq("id", orderId)
      .maybeSingle();

    await supabase.from("payments").insert({
      order_id: orderId,
      amount,
      mpesa_code: paymentCode,
      customer_name: order?.customer_name || "Pesapal Customer",
      customer_phone: order?.customer_phone || null,
    });

    await triggerReceiptEmail(orderId, paymentCode);

    return new Response(JSON.stringify({ orderNotificationType, orderTrackingId, status: "confirmed" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ status: "error", message: "Unable to process payment" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
