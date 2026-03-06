import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptRequest {
  orderId: string;
  paymentCode: string;
  paymentMethod: 'pesapal' | 'mpesa';
}

serve(async (req) => {
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
    const fromEmail = Deno.env.get('RECEIPT_FROM_EMAIL') ?? 'Patrichia Store <no-reply@patrichiastore.com>';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Email service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { orderId, paymentCode, paymentMethod } = (await req.json()) as ReceiptRequest;

    if (!orderId || !paymentCode || !paymentMethod) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, customer_email, total_amount, status, created_at')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!order.customer_email) {
      return new Response(JSON.stringify({ success: false, error: 'Customer email unavailable' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status !== 'confirmed' && order.status !== 'completed') {
      return new Response(JSON.stringify({ success: false, error: 'Order not paid' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existingLog } = await supabase
      .from('receipt_emails')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingLog) {
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, size, quantity, price_at_purchase')
      .eq('order_id', orderId);

    const itemRows = (items ?? [])
      .map(
        (item) =>
          `<tr><td>${item.product_name}</td><td>${item.size}</td><td>${item.quantity}</td><td>Ksh ${Number(item.price_at_purchase).toLocaleString()}</td></tr>`,
      )
      .join('');

    const html = `
      <h2>Patrichia's Store Receipt</h2>
      <p>Hello ${order.customer_name}, your payment has been confirmed.</p>
      <p><strong>Order:</strong> ${order.id}</p>
      <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
      <p><strong>Payment Method:</strong> ${paymentMethod === 'pesapal' ? 'Pesapal STK Push' : 'M-Pesa Paybill'}</p>
      <p><strong>Payment Code:</strong> ${paymentCode}</p>
      <p><strong>Total:</strong> Ksh ${Number(order.total_amount).toLocaleString()}</p>
      <h3>Items</h3>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
      </table>
      <p>Thank you for shopping with Patrichia's Store.</p>
    `;

    const text = `Patrichia's Store receipt\nOrder: ${order.id}\nPayment code: ${paymentCode}\nTotal: Ksh ${Number(order.total_amount).toLocaleString()}`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [order.customer_email],
        subject: `Payment Receipt - Patrichia's Store (${paymentCode})`,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('receipt_emails').insert({
      order_id: orderId,
      recipient_email: order.customer_email,
      payment_code: paymentCode,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Unable to send receipt email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
