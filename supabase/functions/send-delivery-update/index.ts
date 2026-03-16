import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

interface DeliveryUpdateRequest {
  orderId: string;
  scheduledDate?: string;
  statusUpdate?: 'processing' | 'out_for_delivery' | 'delivered';
}

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
    const { orderId, scheduledDate, statusUpdate } = (await req.json()) as DeliveryUpdateRequest;

    console.log(`Delivery update request: orderId=${orderId}, scheduled=${scheduledDate}, status=${statusUpdate}`);

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing order ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, total_amount, status, delivery_type, delivery_location, scheduled_delivery_date')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order fetch error:', orderError);
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: emailValue } = await supabase.rpc('get_order_contact_email', {
      _order_id: orderId,
    });

    if (!emailValue) {
      console.error('No email found for order:', orderId);
      return new Response(
        JSON.stringify({ success: false, error: 'Customer email unavailable' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const customerEmail = String(emailValue).trim().toLowerCase();
    const safeName = escapeHtml(order.customer_name ?? 'Customer');
    const deliveryLocation = order.delivery_location ? escapeHtml(order.delivery_location) : 'N/A';
    const effectiveDate = scheduledDate || order.scheduled_delivery_date;
    const formattedDate = effectiveDate
      ? new Date(effectiveDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : null;

    let subject = '';
    let headerTitle = '';
    let headerSubtitle = '';
    let headerColor = '';
    let bodyMessage = '';
    let statusBadge = '';

    if (scheduledDate && !statusUpdate) {
      subject = `Delivery Scheduled - Patrichia's Store`;
      headerTitle = '📅 Delivery Scheduled!';
      headerSubtitle = 'Your delivery date has been confirmed.';
      headerColor = 'linear-gradient(135deg,#0369a1,#0284c7)';
      bodyMessage = `Great news! Your delivery has been scheduled. Here are the details:`;
      statusBadge = `<span style="display:inline-block;background:#0369a1;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;">Delivery Scheduled</span>`;
    } else if (statusUpdate === 'out_for_delivery') {
      subject = `Order Out for Delivery - Patrichia's Store`;
      headerTitle = '🚚 Out for Delivery!';
      headerSubtitle = 'Your order is on its way to you.';
      headerColor = 'linear-gradient(135deg,#0891b2,#06b6d4)';
      bodyMessage = `Your order is now out for delivery! Our delivery team is on the way.`;
      statusBadge = `<span style="display:inline-block;background:#0891b2;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;">Out for Delivery</span>`;
    } else if (statusUpdate === 'delivered') {
      subject = `Order Delivered ✓ - Patrichia's Store`;
      headerTitle = '✅ Order Delivered!';
      headerSubtitle = 'Your order has been delivered successfully.';
      headerColor = 'linear-gradient(135deg,#16a34a,#22c55e)';
      bodyMessage = `Your order has been delivered! We hope you love your items.`;
      statusBadge = `<span style="display:inline-block;background:#16a34a;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;">Delivered</span>`;
    } else {
      subject = `Order Update - Patrichia's Store`;
      headerTitle = '📦 Order Update';
      headerSubtitle = 'Here\'s the latest on your order.';
      headerColor = 'linear-gradient(135deg,#7c3aed,#6d28d9)';
      bodyMessage = `Here's an update on your order:`;
      statusBadge = `<span style="display:inline-block;background:#7c3aed;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;">Updated</span>`;
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:20px;">
    <div style="background:${headerColor};border-radius:12px 12px 0 0;padding:30px 20px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;">${headerTitle}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${headerSubtitle}</p>
    </div>
    <div style="background:#fff;padding:24px 20px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 12px;font-size:15px;color:#333;">Hello <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#555;">${bodyMessage}</p>

      <div style="background:#f0f9ff;border-radius:8px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:4px 0;color:#666;">Order ID:</td>
            <td style="padding:4px 0;font-weight:bold;">${order.id.slice(0, 8).toUpperCase()}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">Status:</td>
            <td style="padding:4px 0;">${statusBadge}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">Delivery To:</td>
            <td style="padding:4px 0;font-weight:bold;">${deliveryLocation}</td>
          </tr>
          ${formattedDate ? `<tr>
            <td style="padding:4px 0;color:#666;">Delivery Date:</td>
            <td style="padding:4px 0;font-weight:bold;color:#0369a1;">${formattedDate}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:4px 0;color:#666;">Total:</td>
            <td style="padding:4px 0;font-weight:bold;">Ksh ${Number(order.total_amount).toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
        <p style="margin:0 0 6px;font-size:14px;color:#666;">Track your order:</p>
        <p style="margin:0;font-size:14px;font-weight:bold;color:#7c3aed;">patrichiastore.com/track-order</p>
      </div>

      <div style="border-top:1px solid #eee;padding-top:16px;margin-top:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;">Thank you for shopping with Patrichia's Store! 🙏</p>
        <p style="margin:0;font-size:12px;color:#999;">📍 Uhuru Market, Store F47 | 📞 0726075180</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `Patrichia's Store\n\n${headerTitle}\n\nHello ${order.customer_name},\n${bodyMessage}\n\nOrder: ${order.id.slice(0, 8).toUpperCase()}\nDelivery to: ${order.delivery_location || 'N/A'}\n${formattedDate ? `Delivery date: ${formattedDate}\n` : ''}Total: Ksh ${Number(order.total_amount).toLocaleString()}\n\nTrack: patrichiastore.com/track-order`;

    console.log(`Sending delivery update email to: ${customerEmail}`);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customerEmail],
        subject,
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Delivery update email error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Unable to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
