import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const escapeHtml = (value: string) => 
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function logError(supabase: ReturnType<typeof createClient>, errorType: string, errorMessage: string, context: Record<string, unknown>, severity = 'error') {
  try {
    await supabase.from('system_errors').insert({ error_type: errorType, error_message: errorMessage, context, severity, resolved: false });
  } catch (e) {
    console.error('Failed to log error:', e);
  }
}

async function sendViaResend(to: string, subject: string, html: string, text: string, resendApiKey: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Patrichia Kavingo Store <onboarding@resend.dev>',
      reply_to: 'patrichiakavingo@gmail.com',
      to: [to],
      subject,
      html,
      text,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!resendApiKey) {
      await logError(supabase, 'EMAIL_SERVICE_UNAVAILABLE', 'RESEND_API_KEY not configured', {}, 'critical');
      return new Response(JSON.stringify({ success: false, error: 'Email service unavailable' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { orderId, paymentCode, paymentMethod } = await req.json();
    if (!orderId || !paymentCode || !paymentMethod) return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: order, error: orderError } = await supabase.from('orders').select('id, customer_name, total_amount, status, created_at, delivery_type, delivery_location, scheduled_delivery_date').eq('id', orderId).maybeSingle();
    if (orderError || !order) {
      await logError(supabase, 'RECEIPT_ORDER_NOT_FOUND', `Order ${orderId} not found`, { orderId }, 'error');
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (order.status !== 'confirmed' && order.status !== 'completed') return new Response(JSON.stringify({ success: false, error: 'Order not paid' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: existingLog } = await supabase.from('receipt_emails').select('id').eq('order_id', orderId).maybeSingle();
    if (existingLog) return new Response(JSON.stringify({ success: true, alreadySent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: emailValue, error: emailError } = await supabase.rpc('get_order_contact_email', { _order_id: orderId });
    if (emailError || !emailValue) {
      await logError(supabase, 'RECEIPT_EMAIL_LOOKUP_FAILED', `No email found for order ${orderId}`, { orderId }, 'error');
      return new Response(JSON.stringify({ success: false, error: 'Customer email unavailable' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const customerEmail = String(emailValue).trim().toLowerCase();
    const { data: items, error: itemsError } = await supabase.from('order_items').select('product_name, size, quantity, price_at_purchase, color').eq('order_id', orderId);

    if (itemsError || !items || items.length === 0) {
      await logError(supabase, 'RECEIPT_ITEMS_MISSING', `Order ${orderId} has no items`, { orderId }, 'warning');
    }

    const itemRows = (items ?? []).map((item) => {
      const qty = item.quantity ?? 1;
      const price = Number(item.price_at_purchase ?? 0);
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${escapeHtml(item.product_name ?? 'Item')}${item.color ? ` - ${escapeHtml(item.color)}` : ''}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(item.size ?? '-')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">Ksh ${price.toLocaleString()}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">Ksh ${(price * qty).toLocaleString()}</td>
      </tr>`;
    }).join('');

    const isDelivery = order.delivery_type === 'delivery';
    const scheduledDate = order.scheduled_delivery_date ? new Date(order.scheduled_delivery_date).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

    const deliverySection = isDelivery
      ? `<div style="background:#eff6ff;border-radius:8px;padding:16px;margin-bottom:20px;"><h3 style="margin:0 0 6px;color:#1d4ed8;">🚚 Delivery Details</h3><p style="margin:0;font-size:14px;color:#333;">To: <strong>${escapeHtml(order.delivery_location || 'TBD')}</strong></p>${scheduledDate ? `<p style="margin:6px 0 0;font-size:14px;">Estimated: <strong>${scheduledDate}</strong></p>` : '<p style="margin:6px 0 0;font-size:12px;color:#666;">Date to be confirmed.</p>'}</div>`
      : `<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;"><h3 style="margin:0 0 6px;color:#166534;">📍 Store Pickup</h3><p style="margin:0;font-size:14px;color:#333;"><strong>Uhuru Market, Store F47, Jogoo Road, Nairobi</strong></p><p style="margin:6px 0 0;font-size:12px;color:#666;">Open Mon–Sat 8am–6pm · Call +254 726 075 180</p></div>`;

    const html = `<div style="max-width:560px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <h1 style="color:white;margin:0;font-size:22px;">✅ Payment Confirmed!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Patrichia Kavingo Uniform Store</p>
      </div>
      <p style="font-size:15px;color:#333;">Hello <strong>${escapeHtml(order.customer_name ?? 'Customer')}</strong>,</p>
      <p style="font-size:14px;color:#555;">Your payment has been received. Here are your order details:</p>
      <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#888;">ORDER REFERENCE</p>
        <p style="margin:4px 0;font-size:20px;font-weight:bold;color:#7c3aed;letter-spacing:2px;">${order.id.slice(0, 8).toUpperCase()}</p>
        <p style="margin:4px 0;font-size:13px;color:#555;">Payment Code: <strong>${paymentCode}</strong></p>
        <p style="margin:4px 0;font-size:13px;color:#555;">Method: <strong>${paymentMethod === 'mpesa' ? 'M-Pesa' : 'PesaPal'}</strong></p>
      </div>
      ${items && items.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#555;">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#555;">Size</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#555;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:13px;color:#555;">Price</th>
          <th style="padding:10px 12px;text-align:right;font-size:13px;color:#555;">Subtotal</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot><tr style="background:#f9f5ff;">
          <td colspan="4" style="padding:12px;font-weight:bold;text-align:right;">Total Paid:</td>
          <td style="padding:12px;font-weight:bold;text-align:right;color:#7c3aed;font-size:16px;">Ksh ${Number(order.total_amount).toLocaleString()}</td>
        </tr></tfoot>
      </table>` : `<div style="background:#fefce8;border:1px solid #fbbf24;border-radius:8px;padding:12px;margin-bottom:20px;"><p style="margin:0;font-size:14px;color:#92400e;">Total Paid: <strong>Ksh ${Number(order.total_amount).toLocaleString()}</strong></p><p style="margin:4px 0 0;font-size:12px;color:#92400e;">Full receipt will be sent shortly.</p></div>`}
      ${deliverySection}
      <div style="text-align:center;margin-top:24px;padding:16px;background:#f9f5ff;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#555;">Track your order:</p>
        <p style="margin:4px 0;font-size:14px;font-weight:bold;color:#7c3aed;">patrichiasstore-url.vercel.app/track-order</p>
        <p style="margin:8px 0 0;font-size:12px;color:#888;">Questions? Call/WhatsApp <strong>+254 726 075 180</strong></p>
      </div>
      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px;">Patrichia Kavingo Uniform Store · Uhuru Market Store F47 · Jogoo Road, Nairobi</p>
    </div>`;

    const text = `Payment Confirmed!\n\nHello ${order.customer_name},\nOrder: ${order.id.slice(0, 8).toUpperCase()}\nPayment Code: ${paymentCode}\nTotal: Ksh ${Number(order.total_amount).toLocaleString()}\n\n${isDelivery ? `Delivery to: ${order.delivery_location || 'TBD'}` : 'Pickup: Uhuru Market Store F47'}\n\nTrack: patrichiasstore-url.vercel.app/track-order\nCall: +254 726 075 180`;

    const emailResponse = await sendViaResend(customerEmail, `✅ Order Confirmed - ${order.id.slice(0, 8).toUpperCase()} | Patrichia Store`, html, text, resendApiKey);
    const emailBody = await emailResponse.text();

    if (!emailResponse.ok) {
      await logError(supabase, 'RECEIPT_EMAIL_SEND_FAILED', `Failed sending receipt for order ${orderId} to ${customerEmail}`, { orderId, customerEmail, status: emailResponse.status, body: emailBody }, 'error');
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('receipt_emails').insert({ order_id: orderId, email: customerEmail, sent_at: new Date().toISOString() });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
