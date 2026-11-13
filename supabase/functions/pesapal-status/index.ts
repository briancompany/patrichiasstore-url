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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderTrackingId, orderId } = await req.json();

    if (!orderTrackingId || !orderId) {
      return new Response(JSON.stringify({ error: "Missing order tracking details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({ status: "confirmed", already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getAuthToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      },
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === 1) {
      const paymentCode = String(
        statusData.confirmation_code || statusData.payment_account || orderTrackingId,
      )
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12)
        .padEnd(8, "0");

      const amount = Number(statusData.amount || 0);
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("customer_name, customer_phone, status, total_amount, payment_status")
        .eq("id", orderId)
        .maybeSingle();
      if (orderError || !order) throw new Error("Pesapal status references an unknown order");
      if (order.payment_status === "paid") {
        return new Response(JSON.stringify({ status: "confirmed", already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isFinite(amount) || Math.round(amount * 100) !== Math.round(Number(order.total_amount) * 100) ||
          (statusData.currency && statusData.currency !== "KES")) {
        throw new Error("Pesapal payment amount or currency does not match the order");
      }

      // Atomically claim stock — the first confirmed payment wins the piece.
      const { data: claim } = await supabase.rpc("claim_order_stock", { _order_id: orderId });
      const claimResult = claim as { ok?: boolean; unavailable?: { product_name?: string }[] } | null;

      if (claimResult && claimResult.ok === false) {
        const names = (claimResult.unavailable || []).map((u) => u.product_name || "item").join(", ");
        await supabase
          .from("orders")
          .update({
            notes: `SOLD OUT before payment cleared | Ref: ${paymentCode} | Items: ${names} | Refund required`,
          })
          .eq("id", orderId);

        return new Response(
          JSON.stringify({
            status: "sold_out",
            message: names
              ? `${names} was bought by another customer moments before your payment cleared. Our team will contact you for a refund or restock.`
              : "This item was just sold out. Our team will contact you.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const nextOrderStatus = ["new_school_setup", "processing", "ready", "out_for_delivery", "delivered", "completed"].includes(order?.status || "")
        ? order.status
        : "pending";
      const { data: updatedOrder, error: updateError } = await supabase.from("orders").update({
        status: nextOrderStatus,
        payment_method: "pesapal",
        payment_status: "paid",
        payment_reference: paymentCode,
        payment_updated_at: new Date().toISOString(),
        notes: `Pesapal Verified (poll) | Ref: ${paymentCode}`,
      }).eq("id", orderId).eq("payment_status", "pending").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updatedOrder) {
        return new Response(JSON.stringify({ status: "confirmed", already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: paymentInsertError } = await supabase.from("payments").insert({
        order_id: orderId,
        amount,
        mpesa_code: paymentCode,
        customer_name: order?.customer_name || "Customer",
        customer_phone: order?.customer_phone || null,
      });
      if (paymentInsertError) {
        await supabase.from("orders").update({
          payment_status: "pending", payment_reference: null, payment_updated_at: null,
        }).eq("id", orderId).eq("payment_reference", paymentCode);
        throw new Error("Could not save verified Pesapal payment record");
      }
      await supabase.from("order_payment_events").insert({
        order_id: orderId, event_type: "payment_recorded", payment_method: "pesapal",
        payment_status: "paid", amount, reference: paymentCode,
      });

      await triggerReceiptEmail(orderId, paymentCode);

      return new Response(JSON.stringify({ status: "confirmed", confirmation_code: paymentCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        status: statusData.status_code === 2 ? "failed" : "pending",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
