// Payment worker (Transactional Outbox). Claims due payment_tasks, asks Pesapal
// for a payment page, records the result, then exits. Never loops or waits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendGmail } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PESAPAL_BASE = "https://pay.pesapal.com/v3/api";

const esc = (v: string) =>
  v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

async function pesapalSession(supabase: ReturnType<typeof createClient>) {
  const res = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: Deno.env.get("PESAPAL_CONSUMER_KEY"),
      consumer_secret: Deno.env.get("PESAPAL_CONSUMER_SECRET"),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    const detail = String(data?.error?.message || data?.message || data?.error || res.statusText || "Unknown response");
    throw new Error(`Pesapal authentication failed (HTTP ${res.status}): ${detail.slice(0, 220)}`);
  }

  // IPN registrations are persistent at Pesapal. Reuse the saved ID to avoid
  // repeated RegisterIPN calls during retries and high checkout traffic.
  const { data: savedSettings } = await supabase
    .from("payment_provider_settings")
    .select("ipn_id")
    .eq("provider", "pesapal")
    .maybeSingle();

  let ipnId = savedSettings?.ipn_id as string | undefined;
  if (!ipnId) {
    const ipnRes = await fetch(`${PESAPAL_BASE}/URLSetup/RegisterIPN`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/pesapal-ipn`, ipn_notification_type: "GET" }),
      signal: AbortSignal.timeout(15000),
    });
    const ipn = await ipnRes.json().catch(() => ({}));
    if (!ipnRes.ok || !ipn.ipn_id) {
      const detail = String(ipn?.error?.message || ipn?.message || ipn?.error || ipnRes.statusText || "Unknown response");
      throw new Error(`Pesapal IPN registration failed (HTTP ${ipnRes.status}): ${detail.slice(0, 220)}`);
    }
    ipnId = ipn.ipn_id as string;
    const { error: saveError } = await supabase.from("payment_provider_settings").upsert({
      provider: "pesapal", ipn_id: ipnId, updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });
    if (saveError) console.error("Could not cache Pesapal IPN registration:", saveError.message);
  }

  return { token: data.token as string, ipnId };
}

function failureEmailHtml(name: string, code: string, total: number, retryUrl: string) {
  return `<div style="max-width:560px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
  <div style="background:#0B1736;color:#fff;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:22px;color:#D4AF37;">Patrichia Kavingo Store</h1>
    <p style="margin:6px 0 0;font-size:14px;">Payment could not be processed</p>
  </div>
  <div style="border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;padding:24px;">
    <p>Hello ${esc(name)},</p>
    <p>Your order <strong>${esc(code)}</strong> (Ksh ${total.toLocaleString()}) is saved and remains active, but we could not start your Pesapal payment. <strong>You have not been charged.</strong></p>
    <p>You do not need to place another order. Return to your saved order to retry Pesapal, switch to M-Pesa Paybill 247247 (account 0726075180), or choose Cash (Pay later).</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${esc(retryUrl)}" style="background:#D4AF37;color:#0B1736;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Retry order</a>
    </p>
    <p style="font-size:13px;color:#666;">Need help? Call or WhatsApp +254 726 075 180.<br/>Uhuru Market, Store F47, Jogoo Road, Nairobi</p>
  </div></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results: Record<string, string> = {};

  try {
    const { data: tasks, error } = await supabase.rpc("claim_payment_tasks", { _limit: 5 });
    if (error) throw error;
    if (!tasks || tasks.length === 0) return json({ processed: 0 });

    let session: { token: string; ipnId: string } | null = null;
    let sessionError: string | null = null;

    for (const task of tasks) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, total_amount, customer_name, customer_phone, status, payment_method, payment_status")
        .eq("id", task.order_id)
        .maybeSingle();

      if (!order) {
        await supabase.from("payment_tasks").update({ status: "dead", error_message: "Order missing" }).eq("id", task.id);
        results[task.id] = "dead";
        continue;
      }
      if (order.payment_status === "paid") {
        await supabase.from("payment_tasks").update({ status: "completed", error_message: null }).eq("id", task.id);
        results[task.id] = "completed";
        continue;
      }
      if (order.payment_method && order.payment_method !== "pesapal") {
        await supabase.from("payment_tasks").update({ status: "dead", error_message: "Order is not using Pesapal" }).eq("id", task.id);
        results[task.id] = "cancelled";
        continue;
      }

      try {
        if (!session && !sessionError) {
          try { session = await pesapalSession(supabase); } catch (e) { sessionError = (e as Error).message; }
        }
        if (!session) throw new Error(sessionError ?? "Pesapal unavailable");

        const name = String(order.customer_name || "Customer");
        const submitRes = await fetch(`${PESAPAL_BASE}/Transactions/SubmitOrderRequest`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({
            id: order.id,
            currency: "KES",
            amount: Number(order.total_amount),
            description: `Patrichia's Store Order - ${String(order.id).slice(0, 8)}`,
            callback_url: task.callback_url,
            notification_id: session.ipnId,
            billing_address: {
              phone_number: order.customer_phone || "",
              first_name: name.split(" ")[0] || name,
              last_name: name.split(" ").slice(1).join(" ") || "",
            },
          }),
          signal: AbortSignal.timeout(20000),
        });
        const submit = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok || !submit.redirect_url) {
          const detail = String(submit?.error?.message || submit?.message || submit?.error || submitRes.statusText || "Pesapal returned no payment link");
          throw new Error(`Pesapal order request failed (HTTP ${submitRes.status}): ${detail.slice(0, 260)}`);
        }

        await supabase.from("payment_tasks").update({
          status: "completed",
          redirect_url: submit.redirect_url,
          pesapal_tracking_id: submit.order_tracking_id ?? null,
          error_message: null,
        }).eq("id", task.id);
        results[task.id] = "completed";
      } catch (e) {
        const message = (e as Error).message?.slice(0, 300) || "Unknown error";
        console.error("Pesapal payment task failed", { orderId: order.id, taskId: task.id, retry: task.retry_count + 1, message });
        const retries = (task.retry_count ?? 0) + 1;

        if (retries < (task.max_retries ?? 3)) {
          const delayMs = 30_000 * Math.pow(4, retries - 1); // 30s, 2m
          await supabase.from("payment_tasks").update({
            status: "pending",
            retry_count: retries,
            error_message: message,
            next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
          }).eq("id", task.id);
          results[task.id] = "retry";
        } else {
          await supabase.from("payment_tasks").update({ status: "dead", retry_count: retries, error_message: message }).eq("id", task.id);
          await supabase.from("system_errors").insert({
            error_type: "PAYMENT_TASK_DEAD",
            error_message: `Pesapal could not start payment for order ${order.id}: ${message}`,
            context: { orderId: order.id, taskId: task.id },
            severity: "error",
            resolved: false,
          });

          const { data: email } = await supabase.rpc("get_order_contact_email", { _order_id: order.id });
          const { data: tracking } = await supabase.from("order_tracking").select("tracking_code").eq("order_id", order.id).maybeSingle();
          if (email) {
            let origin = "https://patrichiasstore-url.vercel.app";
            try { origin = new URL(task.callback_url).origin; } catch { /* keep default */ }
            const code = tracking?.tracking_code ?? String(order.id).slice(0, 8).toUpperCase();
            await sendGmail({
              to: String(email),
              subject: `Payment not processed – order ${code}`,
              html: failureEmailHtml(String(order.customer_name || "Customer"), code, Number(order.total_amount), `${origin}/shop`),
            });
          }
          results[task.id] = "dead";
        }
      }
    }

    return json({ processed: tasks.length, results });
  } catch (e) {
    console.error("process-payment-tasks failed:", e);
    return json({ error: "Worker failed" }, 500);
  }
});
