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
  if (!data.token) throw new Error(`Pesapal auth failed: ${JSON.stringify(data)}`);
  return data.token as string;
}

Deno.serve(async (req) => {
  // Pesapal sends IPN as GET with query params
  const url = new URL(req.url);
  const orderTrackingId = url.searchParams.get("OrderTrackingId");
  const orderMerchantReference = url.searchParams.get("OrderMerchantReference");
  const orderNotificationType = url.searchParams.get("OrderNotificationType");

  console.log("IPN received:", { orderTrackingId, orderMerchantReference, orderNotificationType });

  if (!orderTrackingId || !orderMerchantReference) {
    return new Response(JSON.stringify({ status: "error", message: "Missing parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Get transaction status from Pesapal
    const token = await getAuthToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const statusData = await statusRes.json();
    console.log("Transaction status:", statusData);

    // status_code: 0 = Invalid, 1 = Completed, 2 = Failed, 3 = Reversed
    if (statusData.status_code !== 1) {
      console.log("Payment not completed, status_code:", statusData.status_code);
      return new Response(
        JSON.stringify({ orderNotificationType, orderTrackingId, status: "received" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Payment is completed — update order
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderId = orderMerchantReference;
    const mpesaCode = statusData.confirmation_code || statusData.payment_account || orderTrackingId;
    const amount = statusData.amount || 0;

    // Check if already processed
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      console.log("Payment already recorded for order:", orderId);
      return new Response(
        JSON.stringify({ orderNotificationType, orderTrackingId, status: "already_processed" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Update order to confirmed
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        notes: `Pesapal Auto-Verified | Ref: ${mpesaCode} | TrackingId: ${orderTrackingId}`,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Order update error:", updateError);
    }

    // Fetch order for customer details
    const { data: order } = await supabase
      .from("orders")
      .select("customer_name, customer_phone")
      .eq("id", orderId)
      .maybeSingle();

    // Record payment
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      amount: Number(amount),
      mpesa_code: String(mpesaCode).toUpperCase().slice(0, 12).padEnd(8, "0"),
      customer_name: order?.customer_name || "Pesapal Customer",
      customer_phone: order?.customer_phone || null,
    });

    if (paymentError) {
      console.error("Payment record error:", paymentError);
    }

    console.log("Order confirmed via IPN:", orderId);

    return new Response(
      JSON.stringify({ orderNotificationType, orderTrackingId, status: "confirmed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("IPN processing error:", err);
    return new Response(
      JSON.stringify({ status: "error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
