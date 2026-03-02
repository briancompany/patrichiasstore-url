import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, amount, mpesaCode, customerName, customerPhone, paymentMethod } =
      await req.json();

    // Validate inputs
    if (!orderId || !amount || !mpesaCode || !customerName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = String(mpesaCode).trim().toUpperCase();
    if (code.length < 8 || code.length > 12) {
      return new Response(
        JSON.stringify({ error: "Invalid transaction code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for duplicate code
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("mpesa_code", code)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "This transaction code has already been used." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify order exists
    const { data: order, error: orderFetchError } = await supabase
      .from("orders")
      .select("id, total_amount, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderFetchError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.status === "confirmed" || order.status === "completed") {
      return new Response(
        JSON.stringify({ error: "Order is already paid" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update order status
    const methodLabel = paymentMethod === "pesapal" ? "Pesapal" : "M-Pesa Paybill";
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        notes: `Payment Method: ${methodLabel} | Ref: ${code}`,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Order update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update order status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record payment
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      amount: Number(amount),
      mpesa_code: code,
      customer_name: customerName,
      customer_phone: customerPhone || null,
    });

    if (paymentError) {
      console.error("Payment record error:", paymentError);
      // Non-fatal: order is already confirmed
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("confirm-payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
