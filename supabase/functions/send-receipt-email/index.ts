import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReceiptRequest {
  orderId: string;
  paymentCode: string;
  paymentMethod: 'pesapal' | 'mpesa';
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail =
      Deno.env.get('RECEIPT_FROM_EMAIL') ?? 'Patrichia Store <onboarding@resend.dev>';

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ success: false, error: 'Email service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { orderId, paymentCode, paymentMethod } = (await req.json()) as ReceiptRequest;

    console.log(`Receipt email request: orderId=${orderId}, code=${paymentCode}, method=${paymentMethod}`);

    if (!orderId || !paymentCode || !paymentMethod) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, total_amount, status, created_at, delivery_type, delivery_location, scheduled_delivery_date')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError);
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status !== 'confirmed' && order.status !== 'completed') {
      console.log(`Order status is '${order.status}', skipping email`);
      return new Response(JSON.stringify({ success: false, error: 'Order not paid' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: emailValue, error: emailError } = await supabase.rpc('get_order_contact_email', {
      _order_id: orderId,
    });

    if (emailError || !emailValue) {
      console.error('Email lookup error:', emailError, 'value:', emailValue);
      return new Response(
        JSON.stringify({ success: false, error: 'Customer email unavailable for this order' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const customerEmail = String(emailValue).trim().toLowerCase();
    console.log(`Sending receipt to: ${customerEmail}`);

    const { data: existingLog } = await supabase
      .from('receipt_emails')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingLog) {
      console.log('Receipt already sent for this order');
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, size, quantity, price_at_purchase, color')
      .eq('order_id', orderId);

    const itemRows = (items ?? [])
      .map((item) => {
        const name = escapeHtml(item.product_name ?? 'Item');
        const size = escapeHtml(item.size ?? '-');
        const color = item.color ? ` - ${escapeHtml(item.color)}` : '';
        return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${name}${color}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${size}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">Ksh ${Number(item.price_at_purchase).toLocaleString()}</td>
        </tr>`;
      })
      .join('');

    const safeName = escapeHtml(order.customer_name ?? 'Customer');
    const isDelivery = order.delivery_type === 'delivery';
    const deliveryLocation = order.delivery_location ? escapeHtml(order.delivery_location) : 'N/A';
    const scheduledDate = order.scheduled_delivery_date
      ? new Date(order.scheduled_delivery_date).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : null;

    const deliverySection = isDelivery
      ? `
        <div style="background:#e0f2fe;border-radius:8px;padding:16px;margin:20px 0;">
          <h3 style="margin:0 0 10px;color:#0369a1;font-size:16px;">🚚 Delivery Details</h3>
          <table style="width:100%;font-size:14px;">
            <tr>
              <td style="padding:4px 0;color:#666;">Delivery To:</td>
              <td style="padding:4px 0;font-weight:bold;">${deliveryLocation}</td>
            </tr>
            ${scheduledDate ? `<tr>
              <td style="padding:4px 0;color:#666;">Estimated Delivery:</td>
              <td style="padding:4px 0;font-weight:bold;color:#0369a1;">${scheduledDate}</td>
            </tr>` : `<tr>
              <td style="padding:4px 0;color:#666;">Delivery Date:</td>
              <td style="padding:4px 0;font-style:italic;color:#666;">Will be scheduled soon</td>
            </tr>`}
          </table>
          <p style="margin:10px 0 0;font-size:12px;color:#666;">You'll receive an update when your delivery is scheduled or dispatched.</p>
        </div>
      `
      : `
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:20px 0;">
          <h3 style="margin:0 0 6px;color:#166534;font-size:16px;">📍 Store Pickup</h3>
          <p style="margin:0;font-size:14px;color:#333;">Your order is ready for pickup at <strong>Uhuru Market, Store F47</strong>.</p>
          <p style="margin:6px 0 0;font-size:12px;color:#666;">We'll notify you when it's ready to collect.</p>
        </div>
      `;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);border-radius:12px 12px 0 0;padding:30px 20px;text-align:center;">
      <div style="width:60px;height:60px;margin:0 auto 12px;background:rgba(255,255,255,0.2);border-radius:50%;line-height:60px;">
        <span style="font-size:28px;color:#fff;font-weight:bold;">P</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:22px;">Payment Confirmed! ✓</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your order has been received and confirmed.</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:24px 20px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;font-size:15px;color:#333;">Hello <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#555;">Thank you for your purchase! Here's your order confirmation and receipt.</p>

      <!-- Order Info -->
      <div style="background:#faf5ff;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:4px 0;color:#666;">Order ID:</td>
            <td style="padding:4px 0;font-weight:bold;">${order.id.slice(0, 8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">Date:</td>
            <td style="padding:4px 0;">${new Date(order.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">Payment Method:</td>
            <td style="padding:4px 0;">${paymentMethod === 'pesapal' ? 'Pesapal' : 'M-Pesa Paybill'}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">Payment Code:</td>
            <td style="padding:4px 0;font-weight:bold;">${escapeHtml(paymentCode)}</td>
          </tr>
        </table>
      </div>

      <!-- Items -->
      <h3 style="margin:0 0 10px;color:#7c3aed;font-size:16px;">📦 Items Ordered</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <thead>
          <tr style="background:#faf5ff;">
            <th style="padding:10px 12px;text-align:left;color:#666;font-weight:600;">Item</th>
            <th style="padding:10px 12px;text-align:center;color:#666;font-weight:600;">Size</th>
            <th style="padding:10px 12px;text-align:center;color:#666;font-weight:600;">Qty</th>
            <th style="padding:10px 12px;text-align:right;color:#666;font-weight:600;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999;">No items</td></tr>'}</tbody>
      </table>

      <!-- Total -->
      <div style="background:#7c3aed;color:#fff;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <table style="width:100%;">
          <tr>
            <td style="font-size:16px;font-weight:bold;color:#fff;">Total Paid</td>
            <td style="text-align:right;font-size:20px;font-weight:bold;color:#fff;">Ksh ${Number(order.total_amount).toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <!-- Delivery/Pickup Section -->
      ${deliverySection}

      <!-- Order Tracking -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 6px;font-size:14px;color:#666;">Track your order status at:</p>
        <p style="margin:0;font-size:14px;font-weight:bold;color:#7c3aed;">patrichiastore.com/track-order</p>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #eee;padding-top:16px;margin-top:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;">Thank you for shopping with Patrichia's Store! 🙏</p>
        <p style="margin:0;font-size:12px;color:#999;">📍 Uhuru Market, Store F47 | 📞 0726075180</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Patrichia's Store - Payment Confirmed!\n\nHello ${order.customer_name},\n\nOrder: ${order.id.slice(0, 8).toUpperCase()}\nPayment Code: ${paymentCode}\nTotal Paid: Ksh ${Number(order.total_amount).toLocaleString()}\n\n${isDelivery ? `Delivery to: ${order.delivery_location || 'TBD'}\n${scheduledDate ? `Estimated Delivery: ${scheduledDate}` : 'Delivery date will be scheduled soon.'}` : 'Pickup at: Uhuru Market, Store F47'}\n\nTrack your order: patrichiastore.com/track-order\n\nThank you for shopping with us!`;

    console.log(`Sending email via Resend from: ${fromEmail} to: ${customerEmail}`);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customerEmail],
        subject: `Order Confirmed ✓ - Patrichia's Store (${paymentCode})`,
        html,
        text,
      }),
    });

    const resendBody = await resendResponse.text();
    console.log(`Resend response: status=${resendResponse.status}, body=${resendBody}`);

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendBody);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email', details: resendBody }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('receipt_emails').insert({
      order_id: orderId,
      recipient_email: customerEmail,
      payment_code: paymentCode,
    });

    console.log(`Receipt email sent successfully to ${customerEmail}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Receipt email error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Unable to send receipt email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
