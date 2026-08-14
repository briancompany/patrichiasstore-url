import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendGmail } from '../_shared/gmail.ts';

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
  statusUpdate?: string;
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

    if (!Deno.env.get('GMAIL_USER') || !Deno.env.get('GMAIL_APP_PASSWORD')) {
      console.error('Gmail SMTP credentials not configured');
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
      .select('id, customer_name, total_amount, status, delivery_type, delivery_location, scheduled_delivery_date, is_special_order')
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
    } else if (statusUpdate) {
      const map: Record<string, { label: string; title: string; sub: string; body: string; color: string }> = {
        pending: {
          label: 'Pending',
          title: '🧾 Order Received',
          sub: 'We have your order and it is queued.',
          body: 'We have received your order and it is now in our queue.',
          color: 'linear-gradient(135deg,#0B1736,#1e3a8a)',
        },
        awaiting_payment: {
          label: 'Awaiting Payment',
          title: '⏳ Awaiting Payment',
          sub: 'We are waiting for your payment to reflect.',
          body: 'Your order is saved and waiting for payment confirmation.',
          color: 'linear-gradient(135deg,#b45309,#d97706)',
        },
        confirmed: {
          label: 'Payment Confirmed',
          title: '✅ Payment Confirmed',
          sub: 'Thank you — your payment has been confirmed.',
          body: 'Your payment has been confirmed and your order is moving to preparation.',
          color: 'linear-gradient(135deg,#0B1736,#D4AF37)',
        },
        processing: {
          label: 'Processing',
          title: '🧵 Order Being Prepared',
          sub: 'We are preparing your uniforms.',
          body: 'Our team is preparing your order right now.',
          color: 'linear-gradient(135deg,#4338ca,#6366f1)',
        },
        ready: {
          label: 'Ready',
          title: '📦 Order Ready',
          sub: 'Your order is ready.',
          body: 'Your order is ready for pickup or dispatch.',
          color: 'linear-gradient(135deg,#0f766e,#14b8a6)',
        },
        completed: {
          label: 'Completed',
          title: '🎉 Order Completed',
          sub: 'Your order is complete.',
          body: 'Your order has been completed. Thank you for shopping with us!',
          color: 'linear-gradient(135deg,#166534,#22c55e)',
        },
        new_school_setup: {
          label: 'School Setup',
          title: '🏫 Setting Up Your School',
          sub: 'We are adding your school to our catalogue.',
          body: 'We are setting up your school profile and will confirm your uniform details shortly.',
          color: 'linear-gradient(135deg,#7c2d12,#c2410c)',
        },
      };
      const info = map[statusUpdate] ?? {
        label: statusUpdate.replaceAll('_', ' '),
        title: '📦 Order Update',
        sub: "Here's the latest on your order.",
        body: "Here's an update on your order:",
        color: 'linear-gradient(135deg,#0B1736,#1e3a8a)',
      };
      subject = `${info.title.replace(/^[^\w]+\s*/, '')} - Patrichia's Store`;
      headerTitle = info.title;
      headerSubtitle = info.sub;
      headerColor = info.color;
      bodyMessage = order.is_special_order
        ? `${info.body} This is a priority special order, so we are treating it as urgent.`
        : info.body;
      statusBadge = `<span style="display:inline-block;background:#0B1736;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;text-transform:capitalize;">${info.label}</span>`;
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

    const sendResult = await sendGmail({ to: customerEmail, subject, html, text });

    if (!sendResult.success) {
      console.error('Gmail SMTP error:', sendResult.error);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email', details: sendResult.error }), {
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
